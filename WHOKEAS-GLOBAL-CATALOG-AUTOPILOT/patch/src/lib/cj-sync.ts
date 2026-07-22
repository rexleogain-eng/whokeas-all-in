import {
  calculateMarketSellingPrice,
  type AutomationCategoryRule,
} from "@/lib/automation-config";
import {
  catalogSql,
  ensureCatalogSchema,
} from "@/lib/catalog-schema";
import { getAutomationSettings } from "@/lib/catalog-automation";
import {
  primaryMarket,
  repriceStoredMarketOffers,
} from "@/lib/global-markets";
import { cjNumber, cjRequest } from "@/lib/cj";

type CJVariant = {
  vid?: string;
  variantNameEn?: string;
  variantName?: string;
  variantKey?: string;
  variantSellPrice?: number | string;
};

type CJProductDetail = {
  pid?: string;
  productSku?: string;
  status?: string | number;
  sellPrice?: number | string;
  variants?: CJVariant[];
};

type CJInventoryRow = {
  totalInventory?: number;
  totalInventoryNum?: number;
  storageNum?: number;
  cjInventory?: number;
  factoryInventory?: number;
};

type CJVariantInventory = {
  vid?: string;
  inventory?: CJInventoryRow[];
};

type CJStockBySku = {
  variantInventories?: CJVariantInventory[];
};

function ruleForCategory(
  categoryName: string,
  rules: AutomationCategoryRule[],
  fallbackPercent: number,
) {
  return (
    rules.find(
      (rule) =>
        rule.category.toLowerCase() === categoryName.toLowerCase(),
    ) || {
      key: "default",
      category: categoryName || "General",
      enabled: true,
      searchTerms: [],
      matchKeywords: [],
      markupPercent: fallbackPercent,
      maxImportsPerRun: 1,
    }
  );
}

export async function syncCJProducts(limit = 10) {
  await ensureCatalogSchema();
  const sql = catalogSql();
  const config = await getAutomationSettings();
  const primaryRule = primaryMarket(config);

  const products = await sql`
    SELECT
      p.id,
      p.supplier_external_product_id AS "externalProductId",
      COALESCE(c.name, 'General') AS "categoryName"
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.supplier_platform = 'cj'
      AND p.supplier_sync_enabled = true
      AND p.supplier_external_product_id IS NOT NULL
    ORDER BY p.last_supplier_sync_at NULLS FIRST, p.updated_at ASC
    LIMIT ${Math.max(1, Math.min(25, limit))}
  `;

  const report: Array<Record<string, unknown>> = [];

  for (const product of products) {
    const productId = String(product.id);
    const externalProductId = String(product.externalProductId);
    const categoryName = String(product.categoryName || "General");
    const pricingRule = ruleForCategory(
      categoryName,
      config.categoryRules,
      config.defaultMarkupPercent,
    );

    try {
      const detail = await cjRequest<CJProductDetail>(
        `/v1/product/query?pid=${encodeURIComponent(externalProductId)}`,
      );

      let variants = Array.isArray(detail.variants) ? detail.variants : [];

      if (variants.length === 0) {
        variants = await cjRequest<CJVariant[]>(
          `/v1/product/variant/query?pid=${encodeURIComponent(externalProductId)}`,
        );
      }

      variants = variants.filter((variant) => variant.vid).slice(0, 100);
      const supplierActive = String(detail.status ?? "3") === "3";
      let knownStockRows = 0;
      let totalStock = 0;
      const stockByVariant = new Map<string, number>();

      if (detail.productSku) {
        try {
          const stockData = await cjRequest<CJStockBySku>(
            `/v1/product/stock/queryBySku?sku=${encodeURIComponent(detail.productSku)}`,
          );

          for (const item of stockData.variantInventories || []) {
            if (!item.vid) continue;
            const stock = Math.max(
              0,
              Math.floor(
                (item.inventory || []).reduce(
                  (sum, row) =>
                    sum +
                    cjNumber(
                      row.totalInventory ??
                        row.totalInventoryNum ??
                        row.storageNum ??
                        row.cjInventory ??
                        row.factoryInventory,
                    ),
                  0,
                ),
              ),
            );
            stockByVariant.set(String(item.vid), stock);
          }
        } catch {
          // Price synchronization continues when CJ inventory is unavailable.
        }
      }

      const supplierPrices = variants
        .map((variant) => cjNumber(variant.variantSellPrice ?? detail.sellPrice))
        .filter((price) => price > 0);
      const productSupplierPriceUsd =
        supplierPrices.length > 0
          ? Math.min(...supplierPrices)
          : cjNumber(detail.sellPrice);

      if (productSupplierPriceUsd <= 0) {
        throw new Error("CJ returned an invalid supplier price.");
      }

      const offers = await repriceStoredMarketOffers({
        productId,
        supplierCostUsd: productSupplierPriceUsd,
        categoryMarkupPercent: pricingRule.markupPercent,
        config,
      });
      const primaryOffer =
        offers.find((offer) => offer.marketKey === primaryRule.key) || offers[0];

      if (!primaryOffer) {
        throw new Error("No primary market price is configured.");
      }

      let minimumCostPrimary = Number.POSITIVE_INFINITY;
      let minimumSellingPrimary = Number.POSITIVE_INFINITY;

      for (const variant of variants) {
        if (!variant.vid) continue;

        const supplierPriceUsd = cjNumber(
          variant.variantSellPrice ?? detail.sellPrice,
        );
        const pricing = calculateMarketSellingPrice({
          supplierCostUsd: supplierPriceUsd,
          freightUsd: primaryOffer.freightUsd,
          fxRate: primaryOffer.fxRate,
          reserveLocal: primaryRule.riskReserveLocal,
          markupPercent: Math.max(
            pricingRule.markupPercent,
            primaryRule.markupPercent,
          ),
          minimumProfitLocal: primaryRule.minimumProfitLocal,
          paymentFeePercent: primaryRule.paymentFeePercent,
          roundingIncrementLocal: primaryRule.roundingIncrementLocal,
        });
        const stock = stockByVariant.has(String(variant.vid))
          ? stockByVariant.get(String(variant.vid)) ?? null
          : null;

        if (stock !== null) {
          knownStockRows += 1;
          totalStock += stock;
        }

        minimumCostPrimary = Math.min(
          minimumCostPrimary,
          pricing.supplierCostLocal,
        );
        minimumSellingPrimary = Math.min(
          minimumSellingPrimary,
          pricing.sellingPriceLocal,
        );

        await sql`
          UPDATE product_variants
          SET
            name = COALESCE(
              ${variant.variantNameEn || variant.variantName || variant.variantKey || null},
              name
            ),
            cost = ${pricing.supplierCostLocal},
            price = ${pricing.sellingPriceLocal},
            stock_quantity = COALESCE(${stock}, stock_quantity),
            supplier_price_usd = ${supplierPriceUsd},
            is_active = ${supplierActive}
          WHERE product_id = ${productId}
            AND external_variant_id = ${variant.vid}
        `;
      }

      if (!Number.isFinite(minimumCostPrimary)) {
        minimumCostPrimary = primaryOffer.supplierCostLocal;
      }
      if (!Number.isFinite(minimumSellingPrimary)) {
        minimumSellingPrimary = primaryOffer.sellingPriceLocal;
      }

      const availableMarkets = offers.filter((offer) => offer.available).length;
      const shouldDraftForStock =
        knownStockRows > 0 && totalStock < config.minimumInventory;
      const shouldDraftForMarkets =
        !primaryOffer.available ||
        availableMarkets < config.minimumMarketsAvailable;
      const shouldDraftForPrice =
        minimumSellingPrimary > primaryRule.maximumSellingPriceLocal;
      const warning = !supplierActive
        ? "CJ product is no longer on sale."
        : shouldDraftForStock
          ? `Stock ${totalStock} is below the automation minimum of ${config.minimumInventory}.`
          : shouldDraftForMarkets
            ? `Only ${availableMarkets} global markets are available; ${config.minimumMarketsAvailable} are required.`
            : shouldDraftForPrice
              ? `Automatic price exceeds ${primaryRule.currency} ${primaryRule.maximumSellingPriceLocal}.`
              : null;

      await sql`
        UPDATE products
        SET
          base_cost = ${minimumCostPrimary},
          price = ${minimumSellingPrimary},
          compare_at_price = ${primaryOffer.compareAtPriceLocal},
          estimated_shipping_cost = ${primaryOffer.shippingLocal},
          estimated_delivery_days = ${primaryOffer.estimatedDeliveryDays},
          currency = ${primaryOffer.currency},
          supplier_price_usd = ${productSupplierPriceUsd},
          status = CASE
            WHEN ${supplierActive} = false THEN 'draft'
            WHEN ${shouldDraftForStock} = true THEN 'draft'
            WHEN ${shouldDraftForMarkets} = true THEN 'draft'
            WHEN ${shouldDraftForPrice} = true THEN 'draft'
            ELSE status
          END,
          last_supplier_sync_at = NOW(),
          supplier_sync_error = ${warning},
          updated_at = NOW()
        WHERE id = ${productId}
      `;

      report.push({
        id: productId,
        externalProductId,
        ok: true,
        variants: variants.length,
        stockChecked: knownStockRows,
        stock: totalStock,
        primaryCurrency: primaryOffer.currency,
        primaryPrice: minimumSellingPrimary,
        markets: availableMarkets,
        warning,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown CJ synchronization error.";

      await sql`
        UPDATE products
        SET
          last_supplier_sync_at = NOW(),
          supplier_sync_error = ${message},
          updated_at = NOW()
        WHERE id = ${productId}
      `;

      report.push({
        id: productId,
        externalProductId,
        ok: false,
        error: message,
      });
    }
  }

  return {
    processed: products.length,
    successful: report.filter((entry) => entry.ok).length,
    failed: report.filter((entry) => !entry.ok).length,
    report,
  };
}
