import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from .env.local");
  }

  const {
    getAutomationSettings,
    saveAutomationSettings,
  } = await import("@/lib/catalog-automation");
  const { ensureGlobalMarketSchema } = await import("@/lib/global-markets");
  const { syncCJProducts } = await import("@/lib/cj-sync");
  const { catalogSql } = await import("@/lib/catalog-schema");

  await ensureGlobalMarketSchema();

  const current = await getAutomationSettings();
  const fixed = await saveAutomationSettings({
    ...current,
    enabled: true,
    autoPublish: true,
    defaultMarkupPercent: 30,
    minimumProfitTzs: 0,
    categoryRules: current.categoryRules.map((rule) => ({
      ...rule,
      markupPercent: 30,
    })),
    markets: current.markets.map((market) => ({
      ...market,
      markupPercent: 30,
      minimumProfitLocal: 0,
    })),
  });

  const sql = catalogSql();

  // Reprice every existing international offer immediately from the landed
  // cost already stored in Neon. This does not depend on a fresh CJ request.
  const repricedOffers = await sql`
    WITH basis AS (
      SELECT
        product_id,
        market_key,
        landed_cost_local,
        CASE
          WHEN market_key = 'tz' THEN 0.03::numeric
          ELSE 0.035::numeric
        END AS fee_rate,
        CASE market_key
          WHEN 'tz' THEN 500::numeric
          WHEN 'ae' THEN 5::numeric
          WHEN 'ke' THEN 50::numeric
          WHEN 'za' THEN 10::numeric
          ELSE 1::numeric
        END AS rounding_increment
      FROM product_market_prices
    ),
    calculated AS (
      SELECT
        product_id,
        market_key,
        landed_cost_local,
        fee_rate,
        rounding_increment,
        CEIL(
          (
            landed_cost_local /
            GREATEST(0.05::numeric, 1::numeric - 0.30::numeric - fee_rate)
          ) / rounding_increment
        ) * rounding_increment AS selling_price
      FROM basis
    )
    UPDATE product_market_prices mp
    SET
      selling_price_local = calculated.selling_price,
      compare_at_price_local = CEIL(
        (calculated.selling_price * 1.12::numeric) /
        calculated.rounding_increment
      ) * calculated.rounding_increment,
      estimated_profit_local = GREATEST(
        0,
        calculated.selling_price -
        calculated.landed_cost_local -
        calculated.selling_price * calculated.fee_rate
      ),
      updated_at = NOW()
    FROM calculated
    WHERE mp.product_id = calculated.product_id
      AND mp.market_key = calculated.market_key
    RETURNING mp.product_id, mp.market_key
  `;

  const repricedProducts = await sql`
    UPDATE products p
    SET
      base_cost = primary_offer.supplier_cost_local,
      estimated_shipping_cost = primary_offer.shipping_local,
      price = primary_offer.selling_price_local,
      compare_at_price = primary_offer.compare_at_price_local,
      updated_at = NOW()
    FROM product_market_prices primary_offer
    WHERE p.id = primary_offer.product_id
      AND primary_offer.is_primary = true
    RETURNING p.id
  `;

  const repricedVariants = await sql`
    WITH primary_market AS (
      SELECT
        product_id,
        market_key,
        fx_rate,
        shipping_local,
        GREATEST(
          0,
          landed_cost_local - supplier_cost_local - shipping_local
        ) AS reserve_local,
        CASE
          WHEN market_key = 'tz' THEN 0.03::numeric
          ELSE 0.035::numeric
        END AS fee_rate,
        CASE market_key
          WHEN 'tz' THEN 500::numeric
          WHEN 'ae' THEN 5::numeric
          WHEN 'ke' THEN 50::numeric
          WHEN 'za' THEN 10::numeric
          ELSE 1::numeric
        END AS rounding_increment
      FROM product_market_prices
      WHERE is_primary = true
    ),
    variant_basis AS (
      SELECT
        v.id,
        COALESCE(
          NULLIF(v.supplier_price_usd, 0) * pm.fx_rate,
          NULLIF(v.cost, 0),
          0
        ) AS supplier_cost_local,
        pm.shipping_local,
        pm.reserve_local,
        pm.fee_rate,
        pm.rounding_increment
      FROM product_variants v
      JOIN primary_market pm ON pm.product_id = v.product_id
    ),
    calculated AS (
      SELECT
        id,
        supplier_cost_local,
        CEIL(
          (
            (supplier_cost_local + shipping_local + reserve_local) /
            GREATEST(0.05::numeric, 1::numeric - 0.30::numeric - fee_rate)
          ) / rounding_increment
        ) * rounding_increment AS selling_price
      FROM variant_basis
    )
    UPDATE product_variants v
    SET
      cost = calculated.supplier_cost_local,
      price = calculated.selling_price
    FROM calculated
    WHERE v.id = calculated.id
    RETURNING v.id
  `;

  // A fresh CJ synchronization is useful for current stock and freight, but a
  // temporary CJ outage must not undo the local pricing repair.
  let synchronization: { successful: number; failed: number } = {
    successful: 0,
    failed: 0,
  };
  let synchronizationWarning: string | null = null;

  try {
    const result = await syncCJProducts(25);
    synchronization = {
      successful: result.successful,
      failed: result.failed,
    };
  } catch (error) {
    synchronizationWarning =
      error instanceof Error ? error.message : "CJ synchronization failed.";
  }

  // Publish only products that pass the existing safety, stock and market
  // availability gates. Rejected products remain drafts for manual review.
  const publication = await sql`
    WITH eligible AS (
      SELECT p.id
      FROM products p
      WHERE p.supplier_platform = 'cj'
        AND p.supplier_sync_enabled = true
        AND COALESCE(p.supplier_sync_error, '') = ''
        AND (
          SELECT COALESCE(SUM(v.stock_quantity), 0)
          FROM product_variants v
          WHERE v.product_id = p.id
            AND v.is_active = true
        ) >= ${fixed.minimumInventory}
        AND (
          SELECT COUNT(*)
          FROM product_market_prices mp
          WHERE mp.product_id = p.id
            AND mp.available = true
        ) >= ${fixed.minimumMarketsAvailable}
        AND EXISTS (
          SELECT 1
          FROM product_market_prices primary_offer
          WHERE primary_offer.product_id = p.id
            AND primary_offer.is_primary = true
            AND primary_offer.available = true
        )
    )
    UPDATE products p
    SET
      status = 'active',
      updated_at = NOW()
    FROM eligible
    WHERE p.id = eligible.id
    RETURNING p.id, p.name, p.slug
  `;

  const counts = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status::text = 'active')::int AS active,
      COUNT(*) FILTER (WHERE status::text = 'draft')::int AS drafts,
      COUNT(*) FILTER (WHERE supplier_platform = 'cj')::int AS cj_products
    FROM products
  `;

  console.log("WHOKEAS fixed 30% gross-margin pricing is active.");
  console.log({
    repricedOffers: repricedOffers.length,
    repricedProducts: repricedProducts.length,
    repricedVariants: repricedVariants.length,
    synchronized: synchronization.successful,
    syncFailed: synchronization.failed,
    synchronizationWarning,
    publishedEligible: publication.length,
    catalogue: counts[0],
  });
}

main().catch((error) => {
  console.error("30% margin and publication migration failed:", error);
  process.exit(1);
});
