import { sanitizeAutomationConfig } from "@/lib/automation-config";
import { getAutomationSettings } from "@/lib/catalog-automation";
import { catalogSql, ensureCatalogSchema } from "@/lib/catalog-schema";
import {
  buildMarketOffers,
  ensureGlobalMarketSchema,
  persistProductMarketOffers,
} from "@/lib/global-markets";
import { cjNumber, cjRequest } from "@/lib/cj";
import {
  US_SHIPPING_MAX_DAYS,
  US_TARGET_COUNTRY_CODE,
} from "@/lib/seo";

export type StorefrontCatalogHealth = {
  totalProducts: number;
  supplierProducts: number;
  activeSupplierProducts: number;
  draftSupplierProducts: number;
  storefrontEligible: number;
  supplierEligible: number;
  hiddenActiveSupplierProducts: number;
  missingUsOffer: number;
  unavailableUsOffer: number;
  invalidUsdPrice: number;
  slowUsDelivery: number;
  repairable: number;
  eligibleWithExactFreight: number;
  eligibleWithEstimatedFreight: number;
  lastUsOfferUpdatedAt: string | null;
  checkedAt: string;
};

export type StorefrontRepairReport = {
  attempted: number;
  repaired: number;
  stillHidden: number;
  drafted: number;
  failed: number;
  products: Array<{
    id: string;
    name: string;
    before: string;
    after: string;
    message: string | null;
  }>;
};

type CJInventory = {
  countryCode?: string;
};

type CJVariant = {
  vid?: string;
  variantSellPrice?: string | number;
  inventories?: CJInventory[];
};

type CJProductDetail = {
  pid?: string;
  productNameEn?: string;
  sellPrice?: string | number;
  status?: string | number;
  variants?: CJVariant[];
};

function visibilityReason(input: {
  hasOffer: boolean;
  available: boolean;
  price: number;
  deliveryDays: number | null;
}) {
  if (!input.hasOffer) return "missing_us_offer";
  if (!input.available) return "unavailable_us_offer";
  if (!(input.price > 0)) return "invalid_usd_price";
  if (
    input.deliveryDays !== null &&
    input.deliveryDays > US_SHIPPING_MAX_DAYS
  ) {
    return "slow_us_delivery";
  }
  return "eligible";
}

function reasonLabel(reason: string) {
  switch (reason) {
    case "missing_us_offer":
      return "Missing U.S. market offer";
    case "unavailable_us_offer":
      return "U.S. shipping unavailable";
    case "invalid_usd_price":
      return "Invalid U.S. selling price";
    case "slow_us_delivery":
      return `U.S. delivery exceeds ${US_SHIPPING_MAX_DAYS} days`;
    case "eligible":
      return "Eligible for the U.S. storefront";
    default:
      return reason.replace(/_/g, " ");
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

export async function getStorefrontCatalogHealth(): Promise<StorefrontCatalogHealth> {
  await ensureCatalogSchema();
  await ensureGlobalMarketSchema();
  const sql = catalogSql();

  const [row] = await sql`
    WITH latest_us AS (
      SELECT DISTINCT ON (market.product_id)
        market.product_id,
        market.available,
        market.selling_price_local,
        market.estimated_delivery_days,
        market.freight_is_estimate,
        market.updated_at
      FROM product_market_prices market
      WHERE market.country_code = ${US_TARGET_COUNTRY_CODE}
        AND market.currency = 'USD'
      ORDER BY
        market.product_id,
        market.is_primary DESC,
        market.updated_at DESC
    ),
    classified AS (
      SELECT
        p.id,
        p.status::text AS status,
        p.supplier_platform,
        p.supplier_external_product_id,
        p.supplier_sync_enabled,
        latest_us.product_id AS us_product_id,
        latest_us.available AS us_available,
        latest_us.selling_price_local AS us_price,
        latest_us.estimated_delivery_days AS us_delivery_days,
        latest_us.freight_is_estimate AS us_freight_is_estimate,
        CASE
          WHEN p.status::text <> 'active' THEN 'inactive'
          WHEN latest_us.product_id IS NULL THEN 'missing_us_offer'
          WHEN latest_us.available IS NOT TRUE THEN 'unavailable_us_offer'
          WHEN COALESCE(latest_us.selling_price_local, 0) <= 0 THEN 'invalid_usd_price'
          WHEN latest_us.estimated_delivery_days IS NOT NULL
            AND latest_us.estimated_delivery_days > ${US_SHIPPING_MAX_DAYS}
            THEN 'slow_us_delivery'
          ELSE 'eligible'
        END AS visibility_reason
      FROM products p
      LEFT JOIN latest_us ON latest_us.product_id = p.id
    )
    SELECT
      (SELECT COUNT(*)::int FROM products) AS "totalProducts",
      COUNT(*) FILTER (
        WHERE supplier_platform IS NOT NULL
          AND supplier_platform <> ''
      )::int AS "supplierProducts",
      COUNT(*) FILTER (
        WHERE supplier_platform IS NOT NULL
          AND supplier_platform <> ''
          AND status = 'active'
      )::int AS "activeSupplierProducts",
      COUNT(*) FILTER (
        WHERE supplier_platform IS NOT NULL
          AND supplier_platform <> ''
          AND status = 'draft'
      )::int AS "draftSupplierProducts",
      COUNT(*) FILTER (WHERE visibility_reason = 'eligible')::int AS "storefrontEligible",
      COUNT(*) FILTER (
        WHERE supplier_platform IS NOT NULL
          AND supplier_platform <> ''
          AND visibility_reason = 'eligible'
      )::int AS "supplierEligible",
      COUNT(*) FILTER (
        WHERE supplier_platform IS NOT NULL
          AND supplier_platform <> ''
          AND status = 'active'
          AND visibility_reason <> 'eligible'
      )::int AS "hiddenActiveSupplierProducts",
      COUNT(*) FILTER (
        WHERE supplier_platform IS NOT NULL
          AND supplier_platform <> ''
          AND status = 'active'
          AND visibility_reason = 'missing_us_offer'
      )::int AS "missingUsOffer",
      COUNT(*) FILTER (
        WHERE supplier_platform IS NOT NULL
          AND supplier_platform <> ''
          AND status = 'active'
          AND visibility_reason = 'unavailable_us_offer'
      )::int AS "unavailableUsOffer",
      COUNT(*) FILTER (
        WHERE supplier_platform IS NOT NULL
          AND supplier_platform <> ''
          AND status = 'active'
          AND visibility_reason = 'invalid_usd_price'
      )::int AS "invalidUsdPrice",
      COUNT(*) FILTER (
        WHERE supplier_platform IS NOT NULL
          AND supplier_platform <> ''
          AND status = 'active'
          AND visibility_reason = 'slow_us_delivery'
      )::int AS "slowUsDelivery",
      COUNT(*) FILTER (
        WHERE supplier_platform = 'cj'
          AND status = 'active'
          AND visibility_reason <> 'eligible'
          AND supplier_sync_enabled = true
          AND supplier_external_product_id IS NOT NULL
          AND supplier_external_product_id <> ''
      )::int AS repairable,
      COUNT(*) FILTER (
        WHERE visibility_reason = 'eligible'
          AND COALESCE(us_freight_is_estimate, false) = false
      )::int AS "eligibleWithExactFreight",
      COUNT(*) FILTER (
        WHERE visibility_reason = 'eligible'
          AND us_freight_is_estimate = true
      )::int AS "eligibleWithEstimatedFreight",
      (
        SELECT MAX(updated_at)::text
        FROM latest_us
      ) AS "lastUsOfferUpdatedAt"
    FROM classified
  `;

  return {
    totalProducts: Number(row?.totalProducts || 0),
    supplierProducts: Number(row?.supplierProducts || 0),
    activeSupplierProducts: Number(row?.activeSupplierProducts || 0),
    draftSupplierProducts: Number(row?.draftSupplierProducts || 0),
    storefrontEligible: Number(row?.storefrontEligible || 0),
    supplierEligible: Number(row?.supplierEligible || 0),
    hiddenActiveSupplierProducts: Number(row?.hiddenActiveSupplierProducts || 0),
    missingUsOffer: Number(row?.missingUsOffer || 0),
    unavailableUsOffer: Number(row?.unavailableUsOffer || 0),
    invalidUsdPrice: Number(row?.invalidUsdPrice || 0),
    slowUsDelivery: Number(row?.slowUsDelivery || 0),
    repairable: Number(row?.repairable || 0),
    eligibleWithExactFreight: Number(row?.eligibleWithExactFreight || 0),
    eligibleWithEstimatedFreight: Number(row?.eligibleWithEstimatedFreight || 0),
    lastUsOfferUpdatedAt: row?.lastUsOfferUpdatedAt
      ? String(row.lastUsOfferUpdatedAt)
      : null,
    checkedAt: new Date().toISOString(),
  };
}

export async function repairHiddenStorefrontProducts(
  requestedLimit = 5,
): Promise<StorefrontRepairReport> {
  await ensureCatalogSchema();
  await ensureGlobalMarketSchema();
  const sql = catalogSql();
  const baseConfig = await getAutomationSettings();
  const config = sanitizeAutomationConfig({
    ...baseConfig,
    maximumExactFreightMarkets: 1,
  });
  const limit = Math.max(1, Math.min(5, Math.floor(requestedLimit || 5)));

  const candidates = await sql`
    WITH latest_us AS (
      SELECT DISTINCT ON (market.product_id)
        market.product_id,
        market.available,
        market.selling_price_local,
        market.estimated_delivery_days
      FROM product_market_prices market
      WHERE market.country_code = ${US_TARGET_COUNTRY_CODE}
        AND market.currency = 'USD'
      ORDER BY
        market.product_id,
        market.is_primary DESC,
        market.updated_at DESC
    ),
    classified AS (
      SELECT
        p.id,
        p.name,
        p.supplier_external_product_id AS "externalProductId",
        p.last_supplier_sync_at AS "lastSupplierSyncAt",
        p.updated_at AS "updatedAt",
        COALESCE(c.name, 'General') AS "categoryName",
        CASE
          WHEN latest_us.product_id IS NULL THEN 'missing_us_offer'
          WHEN latest_us.available IS NOT TRUE THEN 'unavailable_us_offer'
          WHEN COALESCE(latest_us.selling_price_local, 0) <= 0 THEN 'invalid_usd_price'
          WHEN latest_us.estimated_delivery_days IS NOT NULL
            AND latest_us.estimated_delivery_days > ${US_SHIPPING_MAX_DAYS}
            THEN 'slow_us_delivery'
          ELSE 'eligible'
        END AS reason
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN latest_us ON latest_us.product_id = p.id
      WHERE p.supplier_platform = 'cj'
        AND p.status::text = 'active'
        AND p.supplier_sync_enabled = true
        AND p.supplier_external_product_id IS NOT NULL
        AND p.supplier_external_product_id <> ''
    )
    SELECT *
    FROM classified
    WHERE reason <> 'eligible'
    ORDER BY "lastSupplierSyncAt" NULLS FIRST, "updatedAt" ASC
    LIMIT ${limit}
  `;

  const report: StorefrontRepairReport = {
    attempted: candidates.length,
    repaired: 0,
    stillHidden: 0,
    drafted: 0,
    failed: 0,
    products: [],
  };

  for (const candidate of candidates) {
    const id = String(candidate.id);
    const name = String(candidate.name || "CJ product");
    const externalProductId = String(candidate.externalProductId || "");
    const categoryName = String(candidate.categoryName || "General");
    const before = String(candidate.reason || "unknown");

    try {
      const detail = await cjRequest<CJProductDetail>(
        `/v1/product/query?pid=${encodeURIComponent(externalProductId)}`,
      );
      const supplierActive = String(detail.status ?? "3") === "3";

      if (!supplierActive) {
        const message = "CJ product is no longer on sale.";
        await sql`
          UPDATE products
          SET
            status = 'draft',
            supplier_sync_error = ${message},
            last_supplier_sync_at = NOW(),
            updated_at = NOW()
          WHERE id = ${id}
        `;
        report.drafted += 1;
        report.products.push({
          id,
          name,
          before,
          after: "draft",
          message,
        });
        await sleep(900);
        continue;
      }

      let variants = Array.isArray(detail.variants)
        ? detail.variants.filter((variant) => variant.vid)
        : [];
      if (variants.length === 0) {
        variants = await cjRequest<CJVariant[]>(
          `/v1/product/variant/query?pid=${encodeURIComponent(externalProductId)}`,
        );
      }
      variants = variants.filter((variant) => variant.vid).slice(0, 60);

      const supplierPrices = variants
        .map((variant) => cjNumber(variant.variantSellPrice ?? detail.sellPrice))
        .filter((price) => price > 0);
      const supplierCostUsd =
        supplierPrices.length > 0
          ? Math.min(...supplierPrices)
          : cjNumber(detail.sellPrice);

      if (!(supplierCostUsd > 0)) {
        throw new Error("CJ returned an invalid supplier price.");
      }

      const trialVariant = variants[0];
      if (!trialVariant?.vid) {
        throw new Error("CJ returned no shippable variant for an exact U.S. freight check.");
      }

      const originCountryCode =
        trialVariant.inventories?.find((item) => item.countryCode)?.countryCode ||
        "CN";
      const categoryRule = config.categoryRules.find(
        (rule) => rule.category.toLowerCase() === categoryName.toLowerCase(),
      );
      const categoryMarkupPercent =
        categoryRule?.markupPercent ?? config.defaultMarkupPercent;

      const offers = await buildMarketOffers({
        supplierCostUsd,
        trialVariantId: String(trialVariant.vid),
        originCountryCode,
        categoryMarkupPercent,
        config,
      });
      await persistProductMarketOffers(id, offers);

      const usOffer = offers.find(
        (offer) =>
          offer.countryCode === US_TARGET_COUNTRY_CODE &&
          offer.currency === "USD",
      );
      const after = visibilityReason({
        hasOffer: Boolean(usOffer),
        available: Boolean(usOffer?.available),
        price: Number(usOffer?.sellingPriceLocal || 0),
        deliveryDays:
          usOffer?.estimatedDeliveryDays === null ||
          usOffer?.estimatedDeliveryDays === undefined
            ? null
            : Number(usOffer.estimatedDeliveryDays),
      });
      const message = after === "eligible" ? null : reasonLabel(after);

      if (usOffer) {
        await sql`
          UPDATE products
          SET
            base_cost = ${usOffer.supplierCostLocal},
            price = ${usOffer.sellingPriceLocal},
            compare_at_price = ${usOffer.compareAtPriceLocal},
            estimated_shipping_cost = ${usOffer.shippingLocal},
            estimated_delivery_days = ${usOffer.estimatedDeliveryDays},
            currency = 'USD',
            supplier_price_usd = ${supplierCostUsd},
            supplier_sync_error = ${message},
            last_supplier_sync_at = NOW(),
            updated_at = NOW()
          WHERE id = ${id}
        `;
      } else {
        await sql`
          UPDATE products
          SET
            supplier_price_usd = ${supplierCostUsd},
            supplier_sync_error = ${message || "No U.S. market offer was generated."},
            last_supplier_sync_at = NOW(),
            updated_at = NOW()
          WHERE id = ${id}
        `;
      }

      if (after === "eligible") report.repaired += 1;
      else report.stillHidden += 1;

      report.products.push({
        id,
        name,
        before,
        after,
        message,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown storefront repair error.";
      report.failed += 1;
      report.products.push({
        id,
        name,
        before,
        after: "failed",
        message,
      });

      await sql`
        UPDATE products
        SET
          supplier_sync_error = ${message},
          last_supplier_sync_at = NOW(),
          updated_at = NOW()
        WHERE id = ${id}
      `;
    }

    await sleep(1400);
  }

  return report;
}
