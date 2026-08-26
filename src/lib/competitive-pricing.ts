import { catalogSql } from "@/lib/catalog-schema";
import { ensureGlobalMarketSchema } from "@/lib/global-markets";

export const COMPETITOR_TARGET_DISCOUNT_PERCENT = 3;
export const COMPETITOR_MIN_SAFE_MARGIN_PERCENT = 8;
export const COMPETITOR_BENCHMARK_FRESHNESS_DAYS = 30;
export const COMPETITOR_BASELINE_MARGIN_PERCENT = 15;
export const COMPETITOR_PAYMENT_FEE_PERCENT = 3.5;

let competitiveSchemaPromise: Promise<void> | null = null;

function roundUpDollar(value: number) {
  return Math.ceil(Math.max(0, value));
}

function median(values: number[]) {
  const sorted = values
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function priceFromMargin(landedCost: number, marginPercent: number) {
  const marginRate = Math.max(0, marginPercent) / 100;
  const feeRate = COMPETITOR_PAYMENT_FEE_PERCENT / 100;
  const denominator = Math.max(0.05, 1 - marginRate - feeRate);
  return roundUpDollar(Math.max(0, landedCost) / denominator);
}

export type CompetitivePriceDecision = {
  baselinePriceUsd: number;
  safeFloorPriceUsd: number;
  benchmarkMedianUsd: number | null;
  benchmarkLowUsd: number | null;
  benchmarkHighUsd: number | null;
  benchmarkSourceCount: number;
  targetPriceUsd: number;
  estimatedProfitUsd: number;
  estimatedMarginPercent: number;
  decision: "baseline" | "beat-market" | "margin-floor";
};

export function calculateCompetitivePrice(input: {
  landedCostUsd: number;
  benchmarkPricesUsd: number[];
}): CompetitivePriceDecision {
  const landedCostUsd = Math.max(0, Number(input.landedCostUsd || 0));
  const benchmarks = input.benchmarkPricesUsd
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  const benchmarkMedianUsd = median(benchmarks);
  const benchmarkLowUsd = benchmarks.length > 0 ? benchmarks[0] : null;
  const benchmarkHighUsd = benchmarks.length > 0 ? benchmarks.at(-1) ?? null : null;
  const baselinePriceUsd = priceFromMargin(
    landedCostUsd,
    COMPETITOR_BASELINE_MARGIN_PERCENT,
  );
  const safeFloorPriceUsd = priceFromMargin(
    landedCostUsd,
    COMPETITOR_MIN_SAFE_MARGIN_PERCENT,
  );

  let targetPriceUsd = baselinePriceUsd;
  let decision: CompetitivePriceDecision["decision"] = "baseline";

  if (benchmarkMedianUsd !== null) {
    const desiredMarketPrice = roundUpDollar(
      benchmarkMedianUsd * (1 - COMPETITOR_TARGET_DISCOUNT_PERCENT / 100),
    );

    if (desiredMarketPrice < baselinePriceUsd) {
      if (desiredMarketPrice >= safeFloorPriceUsd) {
        targetPriceUsd = desiredMarketPrice;
        decision = "beat-market";
      } else {
        targetPriceUsd = safeFloorPriceUsd;
        decision = "margin-floor";
      }
    }
  }

  const feeUsd = targetPriceUsd * (COMPETITOR_PAYMENT_FEE_PERCENT / 100);
  const estimatedProfitUsd = Math.max(
    0,
    targetPriceUsd - landedCostUsd - feeUsd,
  );
  const estimatedMarginPercent =
    targetPriceUsd > 0 ? (estimatedProfitUsd / targetPriceUsd) * 100 : 0;

  return {
    baselinePriceUsd,
    safeFloorPriceUsd,
    benchmarkMedianUsd,
    benchmarkLowUsd,
    benchmarkHighUsd,
    benchmarkSourceCount: benchmarks.length,
    targetPriceUsd,
    estimatedProfitUsd,
    estimatedMarginPercent,
    decision,
  };
}

async function seedKnownCompetitorBenchmarks() {
  const sql = catalogSql();
  const seeds = [
    {
      slug: "portable-led-desk-storage-cosmetic-mirror-organizer-box-with-light-9e2081",
      sourceName: "Orvico",
      sourceUrl: "https://orvico.store/",
      priceUsd: 37.74,
      shippingUsd: 0,
      note: "Public retail benchmark found for the same product title.",
    },
    {
      slug: "makeup-storage-box-with-led-light-mirror-portable-travel-makeup-cosmetics-storage-box-touch-light-storage-organizer-172906",
      sourceName: "TikTok Shop US",
      sourceUrl: "https://shop.tiktok.com/us/k/light-makeup-box",
      priceUsd: 22.99,
      shippingUsd: 0,
      note: "Public U.S. retail benchmark for the same product title.",
    },
    {
      slug: "makeup-storage-box-with-led-light-mirror-portable-travel-makeup-cosmetics-storage-box-touch-light-storage-organizer-172906",
      sourceName: "She & She",
      sourceUrl: "https://ardealz.com/",
      priceUsd: 12.12,
      shippingUsd: 0,
      note: "Public retail benchmark for the same product title.",
    },
    {
      slug: "new-intelligent-g-shaped-led-lamp-bluetooth-speake-wireless-charger-atmosphere-lamp-app-control-for-bedroom-home-decor-171919",
      sourceName: "Walmart",
      sourceUrl: "https://www.walmart.com/ip/19311617864",
      priceUsd: 39.39,
      shippingUsd: 0,
      note: "Public U.S. retail benchmark for a matching US variant.",
    },
    {
      slug: "new-intelligent-g-shaped-led-lamp-bluetooth-speake-wireless-charger-atmosphere-lamp-app-control-for-bedroom-home-decor-171919",
      sourceName: "Walmart",
      sourceUrl: "https://www.walmart.com/ip/19499151199",
      priceUsd: 36.4,
      shippingUsd: 0,
      note: "Second public U.S. retail benchmark for a matching US variant.",
    },
    {
      slug: "new-intelligent-g-shaped-led-lamp-bluetooth-speake-wireless-charger-atmosphere-lamp-app-control-for-bedroom-home-decor-171919",
      sourceName: "Minixoshop",
      sourceUrl: "https://minixoshop.com/",
      priceUsd: 40,
      shippingUsd: 0,
      note: "Public retail benchmark for the same product title.",
    },
    {
      slug: "mini-fan-heater-wall-mounted-dormitory-warm-artifact-170510",
      sourceName: "eBay",
      sourceUrl: "https://www.ebay.com/itm/376465972277",
      priceUsd: 25,
      shippingUsd: 2.28,
      note: "Public U.S. listing; shipping included separately in benchmark.",
    },
    {
      slug: "mini-fan-heater-wall-mounted-dormitory-warm-artifact-170510",
      sourceName: "WGH",
      sourceUrl: "https://wgh.store/collections/home-appliance-parts",
      priceUsd: 20.38,
      shippingUsd: 0,
      note: "Public retail benchmark for the same product title.",
    },
    {
      slug: "mini-fan-heater-wall-mounted-dormitory-warm-artifact-170510",
      sourceName: "PristaBros",
      sourceUrl: "https://pristabros.com/",
      priceUsd: 24.99,
      shippingUsd: 0,
      note: "Public retail benchmark for a matching American Standard variant.",
    },
  ] as const;

  for (const seed of seeds) {
    await sql`
      INSERT INTO product_competitor_prices (
        product_id,
        source_name,
        source_url,
        price_usd,
        shipping_usd,
        observed_at,
        is_active,
        note,
        updated_at
      )
      SELECT
        p.id,
        ${seed.sourceName},
        ${seed.sourceUrl},
        ${seed.priceUsd},
        ${seed.shippingUsd},
        NOW(),
        true,
        ${seed.note},
        NOW()
      FROM products p
      WHERE p.slug = ${seed.slug}
      ON CONFLICT (product_id, source_url)
      DO NOTHING
    `;
  }
}

export async function ensureCompetitivePricingSchema() {
  if (!competitiveSchemaPromise) {
    competitiveSchemaPromise = (async () => {
      await ensureGlobalMarketSchema();
      const sql = catalogSql();

      await sql`
        CREATE TABLE IF NOT EXISTS product_competitor_prices (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          source_name varchar(120) NOT NULL,
          source_url text NOT NULL,
          price_usd numeric(14,2) NOT NULL,
          shipping_usd numeric(14,2) NOT NULL DEFAULT 0,
          observed_at timestamptz NOT NULL DEFAULT NOW(),
          is_active boolean NOT NULL DEFAULT true,
          note text,
          created_at timestamptz NOT NULL DEFAULT NOW(),
          updated_at timestamptz NOT NULL DEFAULT NOW(),
          UNIQUE (product_id, source_url)
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS product_competitor_prices_fresh_idx
        ON product_competitor_prices (product_id, is_active, observed_at DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS competitive_pricing_runs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          trigger varchar(30) NOT NULL DEFAULT 'manual',
          products_checked integer NOT NULL DEFAULT 0,
          products_repriced integer NOT NULL DEFAULT 0,
          products_at_floor integer NOT NULL DEFAULT 0,
          total_price_reduction_usd numeric(14,2) NOT NULL DEFAULT 0,
          created_at timestamptz NOT NULL DEFAULT NOW()
        )
      `;

      await seedKnownCompetitorBenchmarks();
    })().catch((error) => {
      competitiveSchemaPromise = null;
      throw error;
    });
  }

  return competitiveSchemaPromise;
}

export async function recordCompetitorPrice(input: {
  productId: string;
  sourceName: string;
  sourceUrl: string;
  priceUsd: number;
  shippingUsd?: number;
  note?: string | null;
}) {
  await ensureCompetitivePricingSchema();
  const sql = catalogSql();

  const sourceName = String(input.sourceName || "").trim().slice(0, 120);
  const sourceUrl = String(input.sourceUrl || "").trim();
  const priceUsd = Number(input.priceUsd);
  const shippingUsd = Math.max(0, Number(input.shippingUsd || 0));

  if (!sourceName) throw new Error("Competitor source name is required.");
  if (!/^https?:\/\//i.test(sourceUrl)) {
    throw new Error("Competitor source URL must start with http:// or https://.");
  }
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    throw new Error("Competitor price must be greater than zero.");
  }

  const rows = await sql`
    INSERT INTO product_competitor_prices (
      product_id,
      source_name,
      source_url,
      price_usd,
      shipping_usd,
      observed_at,
      is_active,
      note,
      updated_at
    )
    VALUES (
      ${input.productId},
      ${sourceName},
      ${sourceUrl},
      ${priceUsd},
      ${shippingUsd},
      NOW(),
      true,
      ${input.note ? String(input.note).slice(0, 1000) : null},
      NOW()
    )
    ON CONFLICT (product_id, source_url)
    DO UPDATE SET
      source_name = EXCLUDED.source_name,
      price_usd = EXCLUDED.price_usd,
      shipping_usd = EXCLUDED.shipping_usd,
      observed_at = NOW(),
      is_active = true,
      note = EXCLUDED.note,
      updated_at = NOW()
    RETURNING id::text AS id
  `;

  return String(rows[0]?.id || "");
}

export async function runCompetitiveRepricing(input?: {
  productId?: string;
  trigger?: "manual" | "cron" | "benchmark";
}) {
  await ensureCompetitivePricingSchema();
  const sql = catalogSql();
  const productId = input?.productId?.trim() || null;

  const rows = await sql`
    SELECT
      p.id::text AS "productId",
      p.name,
      p.slug,
      p.status::text AS status,
      market.selling_price_local::text AS "currentPriceUsd",
      market.landed_cost_local::text AS "landedCostUsd",
      market.compare_at_price_local::text AS "compareAtPriceUsd",
      COALESCE(
        json_agg(
          json_build_object(
            'sourceName', cp.source_name,
            'sourceUrl', cp.source_url,
            'priceUsd', cp.price_usd::text,
            'shippingUsd', cp.shipping_usd::text,
            'observedAt', cp.observed_at
          )
          ORDER BY cp.observed_at DESC
        ) FILTER (WHERE cp.id IS NOT NULL),
        '[]'::json
      ) AS benchmarks
    FROM products p
    JOIN product_market_prices market
      ON market.product_id = p.id
      AND market.country_code = 'US'
      AND UPPER(market.currency) = 'USD'
      AND market.is_primary = true
    LEFT JOIN product_competitor_prices cp
      ON cp.product_id = p.id
      AND cp.is_active = true
      AND cp.observed_at >= NOW() - (${COMPETITOR_BENCHMARK_FRESHNESS_DAYS} * INTERVAL '1 day')
    WHERE p.status::text = 'active'
      AND market.available = true
      AND market.landed_cost_local > 0
      AND (${productId}::text IS NULL OR p.id::text = ${productId})
    GROUP BY
      p.id,
      p.name,
      p.slug,
      p.status,
      market.selling_price_local,
      market.landed_cost_local,
      market.compare_at_price_local
    ORDER BY p.updated_at DESC
  `;

  let repriced = 0;
  let atFloor = 0;
  let totalReductionUsd = 0;

  const decisions = [] as Array<{
    productId: string;
    name: string;
    slug: string;
    previousPriceUsd: number;
    newPriceUsd: number;
    reductionUsd: number;
    decision: CompetitivePriceDecision["decision"];
    benchmarkMedianUsd: number | null;
    sourceCount: number;
    safeFloorPriceUsd: number;
    baselinePriceUsd: number;
    estimatedMarginPercent: number;
  }>;

  for (const row of rows) {
    const rawBenchmarks = Array.isArray(row.benchmarks)
      ? row.benchmarks
      : [];
    const benchmarkPrices = rawBenchmarks
      .map((item) => {
        if (!item || typeof item !== "object") return 0;
        const record = item as Record<string, unknown>;
        return Number(record.priceUsd || 0) + Number(record.shippingUsd || 0);
      })
      .filter((value) => value > 0);

    const decision = calculateCompetitivePrice({
      landedCostUsd: Number(row.landedCostUsd || 0),
      benchmarkPricesUsd: benchmarkPrices,
    });
    const previousPriceUsd = Number(row.currentPriceUsd || 0);
    const newPriceUsd = decision.targetPriceUsd;
    const reductionUsd = Math.max(0, previousPriceUsd - newPriceUsd);

    if (decision.decision === "margin-floor") atFloor += 1;

    if (newPriceUsd !== previousPriceUsd) {
      const previousCompareAt = Number(row.compareAtPriceUsd || 0);
      const nextCompareAt =
        newPriceUsd < previousPriceUsd
          ? Math.max(previousPriceUsd, previousCompareAt)
          : previousCompareAt > newPriceUsd
            ? previousCompareAt
            : null;

      await sql`
        UPDATE product_market_prices
        SET
          selling_price_local = ${newPriceUsd},
          compare_at_price_local = ${nextCompareAt},
          estimated_profit_local = ${decision.estimatedProfitUsd},
          warning = CASE
            WHEN ${decision.decision} = 'margin-floor'
              THEN 'Competitive benchmark is below the safe WHOKEAS margin floor.'
            ELSE warning
          END,
          updated_at = NOW()
        WHERE product_id = ${String(row.productId)}::uuid
          AND country_code = 'US'
          AND UPPER(currency) = 'USD'
      `;

      await sql`
        UPDATE products
        SET
          price = ${newPriceUsd},
          compare_at_price = ${nextCompareAt},
          currency = 'USD',
          updated_at = NOW()
        WHERE id = ${String(row.productId)}::uuid
      `;

      repriced += 1;
      totalReductionUsd += reductionUsd;
    }

    decisions.push({
      productId: String(row.productId),
      name: String(row.name),
      slug: String(row.slug),
      previousPriceUsd,
      newPriceUsd,
      reductionUsd,
      decision: decision.decision,
      benchmarkMedianUsd: decision.benchmarkMedianUsd,
      sourceCount: decision.benchmarkSourceCount,
      safeFloorPriceUsd: decision.safeFloorPriceUsd,
      baselinePriceUsd: decision.baselinePriceUsd,
      estimatedMarginPercent: decision.estimatedMarginPercent,
    });
  }

  await sql`
    INSERT INTO competitive_pricing_runs (
      trigger,
      products_checked,
      products_repriced,
      products_at_floor,
      total_price_reduction_usd
    )
    VALUES (
      ${input?.trigger || "manual"},
      ${rows.length},
      ${repriced},
      ${atFloor},
      ${Number(totalReductionUsd.toFixed(2))}
    )
  `;

  return {
    checked: rows.length,
    repriced,
    atFloor,
    totalReductionUsd: Number(totalReductionUsd.toFixed(2)),
    policy: {
      baselineMarginPercent: COMPETITOR_BASELINE_MARGIN_PERCENT,
      minimumSafeMarginPercent: COMPETITOR_MIN_SAFE_MARGIN_PERCENT,
      targetDiscountPercent: COMPETITOR_TARGET_DISCOUNT_PERCENT,
      benchmarkFreshnessDays: COMPETITOR_BENCHMARK_FRESHNESS_DAYS,
    },
    decisions,
  };
}

export async function getCompetitivePricingDashboard() {
  await ensureCompetitivePricingSchema();
  const sql = catalogSql();

  const products = await sql`
    SELECT
      p.id::text AS id,
      p.name,
      p.slug,
      p.status::text AS status,
      market.selling_price_local::text AS "currentPriceUsd",
      market.landed_cost_local::text AS "landedCostUsd",
      COUNT(cp.id)::int AS "sourceCount",
      PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY (cp.price_usd + cp.shipping_usd)
      )::text AS "benchmarkMedianUsd",
      MIN(cp.price_usd + cp.shipping_usd)::text AS "benchmarkLowUsd",
      MAX(cp.price_usd + cp.shipping_usd)::text AS "benchmarkHighUsd"
    FROM products p
    JOIN product_market_prices market
      ON market.product_id = p.id
      AND market.country_code = 'US'
      AND UPPER(market.currency) = 'USD'
      AND market.is_primary = true
    LEFT JOIN product_competitor_prices cp
      ON cp.product_id = p.id
      AND cp.is_active = true
      AND cp.observed_at >= NOW() - (${COMPETITOR_BENCHMARK_FRESHNESS_DAYS} * INTERVAL '1 day')
    WHERE p.status::text = 'active'
      AND market.available = true
    GROUP BY
      p.id,
      p.name,
      p.slug,
      p.status,
      market.selling_price_local,
      market.landed_cost_local
    ORDER BY p.updated_at DESC
  `;

  const shapedProducts = products.map((row) => {
    const benchmarkMedianUsd = row.benchmarkMedianUsd
      ? Number(row.benchmarkMedianUsd)
      : null;
    const decision = calculateCompetitivePrice({
      landedCostUsd: Number(row.landedCostUsd || 0),
      benchmarkPricesUsd: benchmarkMedianUsd ? [benchmarkMedianUsd] : [],
    });

    return {
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      status: String(row.status),
      currentPriceUsd: Number(row.currentPriceUsd || 0),
      landedCostUsd: Number(row.landedCostUsd || 0),
      sourceCount: Number(row.sourceCount || 0),
      benchmarkMedianUsd,
      benchmarkLowUsd: row.benchmarkLowUsd ? Number(row.benchmarkLowUsd) : null,
      benchmarkHighUsd: row.benchmarkHighUsd ? Number(row.benchmarkHighUsd) : null,
      baselinePriceUsd: decision.baselinePriceUsd,
      safeFloorPriceUsd: decision.safeFloorPriceUsd,
      recommendedPriceUsd: decision.targetPriceUsd,
      decision: decision.decision,
    };
  });

  const [run] = await sql`
    SELECT
      trigger,
      products_checked AS "productsChecked",
      products_repriced AS "productsRepriced",
      products_at_floor AS "productsAtFloor",
      total_price_reduction_usd::text AS "totalPriceReductionUsd",
      created_at AS "createdAt"
    FROM competitive_pricing_runs
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return {
    policy: {
      baselineMarginPercent: COMPETITOR_BASELINE_MARGIN_PERCENT,
      minimumSafeMarginPercent: COMPETITOR_MIN_SAFE_MARGIN_PERCENT,
      targetDiscountPercent: COMPETITOR_TARGET_DISCOUNT_PERCENT,
      benchmarkFreshnessDays: COMPETITOR_BENCHMARK_FRESHNESS_DAYS,
      rule:
        "Use the lower of the 15% cost-based baseline or 3% below the fresh competitor median, but never price below an 8% post-fee margin floor.",
    },
    products: shapedProducts,
    lastRun: run
      ? {
          trigger: String(run.trigger),
          productsChecked: Number(run.productsChecked || 0),
          productsRepriced: Number(run.productsRepriced || 0),
          productsAtFloor: Number(run.productsAtFloor || 0),
          totalPriceReductionUsd: Number(run.totalPriceReductionUsd || 0),
          createdAt: String(run.createdAt),
        }
      : null,
  };
}
