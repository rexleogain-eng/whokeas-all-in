import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

async function main() {
  const {
    getAutomationSettings,
    saveAutomationSettings,
  } = await import("@/lib/catalog-automation");
  const { syncCJProducts } = await import("@/lib/cj-sync");
  const { catalogSql } = await import("@/lib/catalog-schema");

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

  const synchronization = await syncCJProducts(25);
  const sql = catalogSql();

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
    repriced: synchronization.successful,
    syncFailed: synchronization.failed,
    publishedEligible: publication.length,
    catalogue: counts[0],
  });
}

main().catch((error) => {
  console.error("30% margin migration failed:", error);
  process.exit(1);
});
