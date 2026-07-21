import {
  catalogSql,
  ensureCatalogSchema,
} from "@/lib/catalog-schema";
import {
  calculateSellingPrice,
  cjNumber,
  cjRequest,
  pricingDefaults,
} from "@/lib/cj";

type CJVariant = {
  vid?: string;
  variantNameEn?: string;
  variantName?: string;
  variantKey?: string;
  variantSellPrice?: number | string;
};

type CJProductDetail = {
  pid?: string;
  status?: string | number;
  sellPrice?: number | string;
  variants?: CJVariant[];
};

type CJStock = {
  vid?: string;
  storageNum?: number;
  totalInventoryNum?: number;
};

export async function syncCJProducts(limit = 10) {
  await ensureCatalogSchema();
  const sql = catalogSql();
  const defaults = pricingDefaults();

  const products = await sql`
    SELECT
      id,
      supplier_external_product_id AS "externalProductId",
      estimated_shipping_cost::text AS "shippingTzs"
    FROM products
    WHERE supplier_platform = 'cj'
      AND supplier_sync_enabled = true
      AND supplier_external_product_id IS NOT NULL
    ORDER BY last_supplier_sync_at NULLS FIRST, updated_at ASC
    LIMIT ${Math.max(1, Math.min(25, limit))}
  `;

  const report: Array<Record<string, unknown>> = [];

  for (const product of products) {
    const productId = String(product.id);
    const externalProductId = String(product.externalProductId);
    const shippingTzs = cjNumber(product.shippingTzs);

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

      const supplierActive = String(detail.status ?? "3") === "3";
      let minimumCostTzs = Number.POSITIVE_INFINITY;
      let minimumSellingPrice = Number.POSITIVE_INFINITY;
      let knownStockRows = 0;
      let totalStock = 0;

      for (const variant of variants.slice(0, 100)) {
        if (!variant.vid) continue;

        const supplierPriceUsd = cjNumber(
          variant.variantSellPrice ?? detail.sellPrice,
        );
        const supplierCostTzs = Math.ceil(
          supplierPriceUsd * defaults.usdToTzsRate,
        );
        const sellingPrice = calculateSellingPrice(
          supplierCostTzs,
          shippingTzs,
          defaults.reserveTzs,
          defaults.marginPercent,
        );

        let stock: number | null = null;

        try {
          const inventory = await cjRequest<CJStock[]>(
            `/v1/product/stock/queryByVid?vid=${encodeURIComponent(variant.vid)}`,
          );
          stock = Math.max(
            0,
            Math.floor(
              (Array.isArray(inventory) ? inventory : []).reduce(
                (sum, row) =>
                  sum +
                  cjNumber(row.totalInventoryNum ?? row.storageNum),
                0,
              ),
            ),
          );
          knownStockRows += 1;
          totalStock += stock;
        } catch {
          stock = null;
        }

        minimumCostTzs = Math.min(minimumCostTzs, supplierCostTzs);
        minimumSellingPrice = Math.min(
          minimumSellingPrice,
          sellingPrice,
        );

        await sql`
          UPDATE product_variants
          SET
            name = COALESCE(
              ${variant.variantNameEn || variant.variantName || variant.variantKey || null},
              name
            ),
            cost = ${supplierCostTzs},
            price = ${sellingPrice},
            stock_quantity = COALESCE(${stock}, stock_quantity),
            supplier_price_usd = ${supplierPriceUsd},
            is_active = ${supplierActive}
          WHERE product_id = ${productId}
            AND external_variant_id = ${variant.vid}
        `;
      }

      const productSupplierPriceUsd = cjNumber(detail.sellPrice);

      if (!Number.isFinite(minimumCostTzs)) {
        minimumCostTzs = Math.ceil(
          productSupplierPriceUsd * defaults.usdToTzsRate,
        );
      }

      if (!Number.isFinite(minimumSellingPrice)) {
        minimumSellingPrice = calculateSellingPrice(
          minimumCostTzs,
          shippingTzs,
          defaults.reserveTzs,
          defaults.marginPercent,
        );
      }

      const shouldDraftForStock = knownStockRows > 0 && totalStock <= 0;

      await sql`
        UPDATE products
        SET
          base_cost = ${minimumCostTzs},
          price = ${minimumSellingPrice},
          supplier_price_usd = ${productSupplierPriceUsd},
          status = CASE
            WHEN ${supplierActive} = false THEN 'draft'
            WHEN ${shouldDraftForStock} = true THEN 'draft'
            ELSE status
          END,
          last_supplier_sync_at = NOW(),
          supplier_sync_error = NULL,
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
