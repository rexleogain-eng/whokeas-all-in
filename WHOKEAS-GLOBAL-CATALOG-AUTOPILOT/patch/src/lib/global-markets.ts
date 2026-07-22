import {
  calculateMarketSellingPrice,
  type AutomationMarketRule,
  type CatalogAutomationConfig,
} from "@/lib/automation-config";
import {
  catalogSql,
  ensureCatalogSchema,
} from "@/lib/catalog-schema";
import { cjNumber, cjRequest } from "@/lib/cj";

type FreightOption = {
  logisticAging?: string;
  logisticPrice?: number | string;
  totalPostageFee?: number | string;
  logisticName?: string;
};

export type MarketOffer = {
  marketKey: string;
  marketName: string;
  countryCode: string;
  currency: string;
  locale: string;
  primary: boolean;
  supplierCostUsd: number;
  freightUsd: number;
  fxRate: number;
  supplierCostLocal: number;
  shippingLocal: number;
  landedCostLocal: number;
  sellingPriceLocal: number;
  compareAtPriceLocal: number;
  estimatedProfitLocal: number;
  estimatedDeliveryDays: number | null;
  freightMethod: string | null;
  freightIsEstimate: boolean;
  available: boolean;
  warning: string | null;
};

const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  TZS: 2700,
  GBP: 0.79,
  EUR: 0.92,
  CAD: 1.36,
  AUD: 1.52,
  AED: 3.6725,
  KES: 129,
  ZAR: 18.2,
};

let globalSchemaPromise: Promise<void> | null = null;

export async function ensureGlobalMarketSchema() {
  if (!globalSchemaPromise) {
    globalSchemaPromise = (async () => {
      await ensureCatalogSchema();
      const sql = catalogSql();

      await sql`
        CREATE TABLE IF NOT EXISTS fx_rates (
          base_currency varchar(3) NOT NULL,
          quote_currency varchar(3) NOT NULL,
          rate numeric(20,8) NOT NULL,
          provider varchar(80) NOT NULL,
          provider_updated_at timestamptz,
          fetched_at timestamptz NOT NULL DEFAULT NOW(),
          PRIMARY KEY (base_currency, quote_currency)
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS product_market_prices (
          product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          market_key varchar(40) NOT NULL,
          market_name varchar(120) NOT NULL,
          country_code varchar(2) NOT NULL,
          currency varchar(3) NOT NULL,
          locale varchar(20) NOT NULL DEFAULT 'en-US',
          is_primary boolean NOT NULL DEFAULT false,
          supplier_cost_usd numeric(14,4) NOT NULL DEFAULT 0,
          freight_usd numeric(14,4) NOT NULL DEFAULT 0,
          fx_rate numeric(20,8) NOT NULL DEFAULT 1,
          supplier_cost_local numeric(16,2) NOT NULL DEFAULT 0,
          shipping_local numeric(16,2) NOT NULL DEFAULT 0,
          landed_cost_local numeric(16,2) NOT NULL DEFAULT 0,
          selling_price_local numeric(16,2) NOT NULL DEFAULT 0,
          compare_at_price_local numeric(16,2),
          estimated_profit_local numeric(16,2) NOT NULL DEFAULT 0,
          estimated_delivery_days integer,
          freight_method text,
          freight_is_estimate boolean NOT NULL DEFAULT false,
          available boolean NOT NULL DEFAULT false,
          warning text,
          updated_at timestamptz NOT NULL DEFAULT NOW(),
          PRIMARY KEY (product_id, market_key)
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS product_market_prices_market_idx
        ON product_market_prices (market_key, available, selling_price_local)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS product_market_prices_product_idx
        ON product_market_prices (product_id, is_primary)
      `;

      for (const [currency, rate] of Object.entries(FALLBACK_RATES)) {
        await sql`
          INSERT INTO fx_rates (
            base_currency,
            quote_currency,
            rate,
            provider,
            provider_updated_at,
            fetched_at
          )
          VALUES ('USD', ${currency}, ${rate}, 'WHOKEAS fallback', NULL, NOW())
          ON CONFLICT (base_currency, quote_currency) DO NOTHING
        `;
      }
    })().catch((error) => {
      globalSchemaPromise = null;
      throw error;
    });
  }

  return globalSchemaPromise;
}

type OpenRateResponse = {
  result?: string;
  provider?: string;
  time_last_update_unix?: number;
  time_last_update_utc?: string;
  rates?: Record<string, number>;
  [key: string]: unknown;
};

function providerDate(data: OpenRateResponse) {
  if (Number.isFinite(data.time_last_update_unix)) {
    return new Date(Number(data.time_last_update_unix) * 1000);
  }
  if (data.time_last_update_utc) {
    const parsed = new Date(data.time_last_update_utc);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export async function syncFxRates(input?: {
  force?: boolean;
  refreshHours?: number;
}) {
  await ensureGlobalMarketSchema();
  const sql = catalogSql();
  const refreshHours = Math.max(6, Math.min(168, input?.refreshHours || 20));

  if (!input?.force) {
    const recent = await sql`
      SELECT MAX(fetched_at) AS "fetchedAt"
      FROM fx_rates
      WHERE base_currency = 'USD'
        AND provider <> 'WHOKEAS fallback'
    `;
    const fetchedAt = recent[0]?.fetchedAt
      ? new Date(String(recent[0].fetchedAt))
      : null;
    if (
      fetchedAt &&
      Date.now() - fetchedAt.getTime() < refreshHours * 60 * 60 * 1000
    ) {
      return {
        updated: false,
        provider: "cached",
        fetchedAt: fetchedAt.toISOString(),
      };
    }
  }

  const endpoint =
    process.env.FX_API_URL?.trim() ||
    "https://open.er-api.com/v6/latest/USD";
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`FX provider returned HTTP ${response.status}.`);
  }

  const data = (await response.json()) as OpenRateResponse;
  if (data.result !== "success" || !data.rates) {
    throw new Error("FX provider returned an invalid rate response.");
  }

  const updatedAt = providerDate(data);
  const provider = String(data.provider || "ExchangeRate-API").slice(0, 80);
  const entries = Object.entries(data.rates)
    .filter(
      ([currency, rate]) =>
        /^[A-Z]{3}$/.test(currency) &&
        Number.isFinite(rate) &&
        Number(rate) > 0,
    )
    .slice(0, 250);

  for (const [currency, rate] of entries) {
    await sql`
      INSERT INTO fx_rates (
        base_currency,
        quote_currency,
        rate,
        provider,
        provider_updated_at,
        fetched_at
      )
      VALUES (
        'USD',
        ${currency},
        ${Number(rate)},
        ${provider},
        ${updatedAt.toISOString()},
        NOW()
      )
      ON CONFLICT (base_currency, quote_currency)
      DO UPDATE SET
        rate = EXCLUDED.rate,
        provider = EXCLUDED.provider,
        provider_updated_at = EXCLUDED.provider_updated_at,
        fetched_at = NOW()
    `;
  }

  return {
    updated: true,
    provider,
    currencies: entries.length,
    providerUpdatedAt: updatedAt.toISOString(),
    fetchedAt: new Date().toISOString(),
  };
}

export async function getFxRateMap(currencies: string[]) {
  await ensureGlobalMarketSchema();
  const sql = catalogSql();
  const wanted = [...new Set(currencies.map((item) => item.toUpperCase()))];
  const rows = await sql`
    SELECT quote_currency AS currency, rate::text AS rate
    FROM fx_rates
    WHERE base_currency = 'USD'
      AND quote_currency = ANY(${wanted}::varchar[])
  `;
  const map = new Map<string, number>();

  for (const row of rows) {
    map.set(String(row.currency), Number(row.rate));
  }

  for (const currency of wanted) {
    if (!map.has(currency)) {
      map.set(currency, FALLBACK_RATES[currency] || 1);
    }
  }

  return map;
}

function deliveryDays(value: string | null | undefined) {
  const matches = String(value || "").match(/\d+/g);
  if (!matches?.length) return null;
  return Math.max(1, Number(matches.at(-1)) || 21);
}

async function calculateFreight(input: {
  originCountryCode: string;
  destinationCountryCode: string;
  variantId: string;
}) {
  const freight = await cjRequest<FreightOption[]>(
    "/v1/logistic/freightCalculate",
    {
      method: "POST",
      body: JSON.stringify({
        startCountryCode: input.originCountryCode,
        endCountryCode: input.destinationCountryCode,
        products: [{ quantity: 1, vid: input.variantId }],
      }),
    },
  );

  const available = (Array.isArray(freight) ? freight : [])
    .map((option) => ({
      ...option,
      amount: cjNumber(option.totalPostageFee ?? option.logisticPrice),
    }))
    .filter((option) => option.amount > 0)
    .sort((left, right) => left.amount - right.amount);

  if (!available[0]) return null;

  return {
    freightUsd: available[0].amount,
    method: available[0].logisticName || null,
    aging: available[0].logisticAging || null,
    deliveryDays: deliveryDays(available[0].logisticAging),
  };
}

function median(values: number[]) {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function priceOffer(input: {
  market: AutomationMarketRule;
  supplierCostUsd: number;
  freightUsd: number;
  fxRate: number;
  categoryMarkupPercent: number;
  freightMethod: string | null;
  freightIsEstimate: boolean;
  deliveryDays: number | null;
  available: boolean;
  warning: string | null;
}): MarketOffer {
  const markupPercent = Math.max(
    input.categoryMarkupPercent,
    input.market.markupPercent,
  );
  const pricing = calculateMarketSellingPrice({
    supplierCostUsd: input.supplierCostUsd,
    freightUsd: input.freightUsd,
    fxRate: input.fxRate,
    reserveLocal: input.market.riskReserveLocal,
    markupPercent,
    minimumProfitLocal: input.market.minimumProfitLocal,
    paymentFeePercent: input.market.paymentFeePercent,
    roundingIncrementLocal: input.market.roundingIncrementLocal,
  });
  const withinMaximum =
    pricing.sellingPriceLocal > 0 &&
    pricing.sellingPriceLocal <= input.market.maximumSellingPriceLocal;
  const available = input.available && withinMaximum;
  const warning = !withinMaximum
    ? `Price exceeds ${input.market.currency} ${input.market.maximumSellingPriceLocal}.`
    : input.warning;
  const compareAtPriceLocal = Math.max(
    pricing.sellingPriceLocal,
    Math.ceil(
      (pricing.sellingPriceLocal * 1.12) /
        input.market.roundingIncrementLocal,
    ) * input.market.roundingIncrementLocal,
  );

  return {
    marketKey: input.market.key,
    marketName: input.market.name,
    countryCode: input.market.countryCode,
    currency: input.market.currency,
    locale: input.market.locale,
    primary: input.market.primary,
    supplierCostUsd: input.supplierCostUsd,
    freightUsd: input.freightUsd,
    fxRate: input.fxRate,
    supplierCostLocal: pricing.supplierCostLocal,
    shippingLocal: pricing.shippingLocal,
    landedCostLocal: pricing.landedCostLocal,
    sellingPriceLocal: pricing.sellingPriceLocal,
    compareAtPriceLocal,
    estimatedProfitLocal: pricing.estimatedProfitLocal,
    estimatedDeliveryDays: input.deliveryDays,
    freightMethod: input.freightMethod,
    freightIsEstimate: input.freightIsEstimate,
    available,
    warning: warning || null,
  };
}

export async function buildMarketOffers(input: {
  supplierCostUsd: number;
  trialVariantId: string;
  originCountryCode: string;
  categoryMarkupPercent: number;
  config: CatalogAutomationConfig;
}) {
  await ensureGlobalMarketSchema();
  try {
    await syncFxRates({ refreshHours: input.config.fxRefreshHours });
  } catch {
    // The database fallback/cached rates keep pricing operational.
  }

  const markets = input.config.markets
    .filter((market) => market.enabled)
    .sort((left, right) => Number(right.primary) - Number(left.primary));
  const fxRates = await getFxRateMap(markets.map((market) => market.currency));
  const exactCandidates = markets
    .filter((market) => market.exactFreight || market.primary)
    .slice(0, input.config.maximumExactFreightMarkets);
  const exactKeys = new Set(exactCandidates.map((market) => market.key));
  const freightByMarket = new Map<
    string,
    {
      freightUsd: number;
      method: string | null;
      deliveryDays: number | null;
      warning: string | null;
    }
  >();

  if (input.trialVariantId) {
    for (const market of exactCandidates) {
      try {
        const result = await calculateFreight({
          originCountryCode: input.originCountryCode,
          destinationCountryCode: market.countryCode,
          variantId: input.trialVariantId,
        });
        freightByMarket.set(
          market.key,
          result
            ? {
                freightUsd: result.freightUsd,
                method: result.method,
                deliveryDays: result.deliveryDays,
                warning: null,
              }
            : {
                freightUsd: 0,
                method: null,
                deliveryDays: null,
                warning: `CJ returned no shipping option to ${market.name}.`,
              },
        );
      } catch (error) {
        freightByMarket.set(market.key, {
          freightUsd: 0,
          method: null,
          deliveryDays: null,
          warning: `Freight check failed for ${market.name}: ${
            error instanceof Error ? error.message : "unknown CJ error"
          }`,
        });
      }
    }
  }

  const exactFreightValues = [...freightByMarket.values()]
    .map((item) => item.freightUsd)
    .filter((value) => value > 0);
  const baselineFreightUsd =
    median(exactFreightValues) ||
    Math.max(4.5, input.supplierCostUsd * 0.45);
  const baselineDelivery = Math.max(
    7,
    Math.round(
      median(
        [...freightByMarket.values()]
          .map((item) => item.deliveryDays || 0)
          .filter(Boolean),
      ) || 18,
    ),
  );

  return markets.map((market) => {
    const exact = freightByMarket.get(market.key);
    const isExactMarket = exactKeys.has(market.key);
    const freightUsd = isExactMarket
      ? exact?.freightUsd || 0
      : baselineFreightUsd * input.config.estimatedFreightMultiplier;
    const available = isExactMarket ? freightUsd > 0 : baselineFreightUsd > 0;
    const warning = isExactMarket
      ? exact?.warning || null
      : "Shipping is a conservative estimate and must be recalculated at checkout.";

    return priceOffer({
      market,
      supplierCostUsd: input.supplierCostUsd,
      freightUsd,
      fxRate: fxRates.get(market.currency) || 1,
      categoryMarkupPercent: input.categoryMarkupPercent,
      freightMethod: isExactMarket ? exact?.method || null : "Estimated global freight",
      freightIsEstimate: !isExactMarket,
      deliveryDays: isExactMarket
        ? exact?.deliveryDays || null
        : Math.ceil(baselineDelivery * 1.15),
      available,
      warning,
    });
  });
}

export async function persistProductMarketOffers(
  productId: string,
  offers: MarketOffer[],
) {
  await ensureGlobalMarketSchema();
  const sql = catalogSql();

  for (const offer of offers) {
    await sql`
      INSERT INTO product_market_prices (
        product_id,
        market_key,
        market_name,
        country_code,
        currency,
        locale,
        is_primary,
        supplier_cost_usd,
        freight_usd,
        fx_rate,
        supplier_cost_local,
        shipping_local,
        landed_cost_local,
        selling_price_local,
        compare_at_price_local,
        estimated_profit_local,
        estimated_delivery_days,
        freight_method,
        freight_is_estimate,
        available,
        warning,
        updated_at
      )
      VALUES (
        ${productId},
        ${offer.marketKey},
        ${offer.marketName},
        ${offer.countryCode},
        ${offer.currency},
        ${offer.locale},
        ${offer.primary},
        ${offer.supplierCostUsd},
        ${offer.freightUsd},
        ${offer.fxRate},
        ${offer.supplierCostLocal},
        ${offer.shippingLocal},
        ${offer.landedCostLocal},
        ${offer.sellingPriceLocal},
        ${offer.compareAtPriceLocal},
        ${offer.estimatedProfitLocal},
        ${offer.estimatedDeliveryDays},
        ${offer.freightMethod},
        ${offer.freightIsEstimate},
        ${offer.available},
        ${offer.warning},
        NOW()
      )
      ON CONFLICT (product_id, market_key)
      DO UPDATE SET
        market_name = EXCLUDED.market_name,
        country_code = EXCLUDED.country_code,
        currency = EXCLUDED.currency,
        locale = EXCLUDED.locale,
        is_primary = EXCLUDED.is_primary,
        supplier_cost_usd = EXCLUDED.supplier_cost_usd,
        freight_usd = EXCLUDED.freight_usd,
        fx_rate = EXCLUDED.fx_rate,
        supplier_cost_local = EXCLUDED.supplier_cost_local,
        shipping_local = EXCLUDED.shipping_local,
        landed_cost_local = EXCLUDED.landed_cost_local,
        selling_price_local = EXCLUDED.selling_price_local,
        compare_at_price_local = EXCLUDED.compare_at_price_local,
        estimated_profit_local = EXCLUDED.estimated_profit_local,
        estimated_delivery_days = EXCLUDED.estimated_delivery_days,
        freight_method = EXCLUDED.freight_method,
        freight_is_estimate = EXCLUDED.freight_is_estimate,
        available = EXCLUDED.available,
        warning = EXCLUDED.warning,
        updated_at = NOW()
    `;
  }

  const keys = offers.map((offer) => offer.marketKey);
  if (keys.length > 0) {
    await sql`
      DELETE FROM product_market_prices
      WHERE product_id = ${productId}
        AND NOT (market_key = ANY(${keys}::varchar[]))
    `;
  }
}

export async function repriceStoredMarketOffers(input: {
  productId: string;
  supplierCostUsd: number;
  categoryMarkupPercent: number;
  config: CatalogAutomationConfig;
}) {
  await ensureGlobalMarketSchema();
  try {
    await syncFxRates({ refreshHours: input.config.fxRefreshHours });
  } catch {
    // Cached/fallback rates are sufficient for continuity.
  }
  const sql = catalogSql();
  const current = await sql`
    SELECT
      market_key AS "marketKey",
      freight_usd::text AS "freightUsd",
      freight_method AS "freightMethod",
      freight_is_estimate AS "freightIsEstimate",
      estimated_delivery_days AS "estimatedDeliveryDays",
      warning
    FROM product_market_prices
    WHERE product_id = ${input.productId}
  `;
  const markets = input.config.markets.filter((market) => market.enabled);
  const fxRates = await getFxRateMap(markets.map((market) => market.currency));
  const currentByKey = new Map(
    current.map((row) => [String(row.marketKey), row]),
  );
  const fallbackFreight =
    median(current.map((row) => Number(row.freightUsd || 0))) ||
    Math.max(4.5, input.supplierCostUsd * 0.45);

  const offers = markets.map((market) => {
    const stored = currentByKey.get(market.key);
    const freightUsd = stored
      ? Number(stored.freightUsd || 0)
      : fallbackFreight * input.config.estimatedFreightMultiplier;
    return priceOffer({
      market,
      supplierCostUsd: input.supplierCostUsd,
      freightUsd,
      fxRate: fxRates.get(market.currency) || 1,
      categoryMarkupPercent: input.categoryMarkupPercent,
      freightMethod: stored?.freightMethod
        ? String(stored.freightMethod)
        : "Estimated global freight",
      freightIsEstimate: stored
        ? Boolean(stored.freightIsEstimate)
        : true,
      deliveryDays: stored?.estimatedDeliveryDays
        ? Number(stored.estimatedDeliveryDays)
        : 21,
      available: freightUsd > 0,
      warning: stored?.warning ? String(stored.warning) : null,
    });
  });

  await persistProductMarketOffers(input.productId, offers);
  return offers;
}

export async function getGlobalMarketStats() {
  await ensureGlobalMarketSchema();
  const sql = catalogSql();
  const [stats] = await sql`
    SELECT
      COUNT(DISTINCT market_key)::int AS markets,
      COUNT(*) FILTER (WHERE available = true)::int AS "availableOffers",
      COUNT(*) FILTER (WHERE freight_is_estimate = false AND available = true)::int AS "verifiedOffers",
      COUNT(DISTINCT product_id)::int AS "pricedProducts"
    FROM product_market_prices
  `;
  const [fx] = await sql`
    SELECT
      MAX(fetched_at) AS "fetchedAt",
      MAX(provider) FILTER (WHERE provider <> 'WHOKEAS fallback') AS provider
    FROM fx_rates
    WHERE base_currency = 'USD'
  `;

  return {
    markets: Number(stats?.markets || 0),
    availableOffers: Number(stats?.availableOffers || 0),
    verifiedOffers: Number(stats?.verifiedOffers || 0),
    pricedProducts: Number(stats?.pricedProducts || 0),
    fxFetchedAt: fx?.fetchedAt ? String(fx.fetchedAt) : null,
    fxProvider: fx?.provider ? String(fx.provider) : "WHOKEAS fallback",
  };
}

export function primaryMarket(config: CatalogAutomationConfig) {
  return (
    config.markets.find((market) => market.enabled && market.primary) ||
    config.markets.find((market) => market.enabled) ||
    config.markets[0]
  );
}

const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE",
  "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT",
  "RO", "SK", "SI", "ES", "SE",
]);

export function marketKeyForCountry(
  countryCode: string | null | undefined,
  config: CatalogAutomationConfig,
) {
  const country = String(countryCode || "").toUpperCase();
  if (EU_COUNTRIES.has(country)) {
    const eu = config.markets.find((market) => market.enabled && market.key === "eu");
    if (eu) return eu.key;
  }
  const direct = config.markets.find(
    (market) => market.enabled && market.countryCode === country,
  );
  return direct?.key || primaryMarket(config)?.key || "tz";
}
