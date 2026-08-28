import { catalogSql, ensureCatalogSchema } from "@/lib/catalog-schema";
import { cjRequest } from "@/lib/cj";
import { collectCJProductIdentifiers } from "@/lib/merchant-identifiers";

type CJVariant = {
  vid?: string;
  variantSku?: string;
  barcode?: string;
  barcode2?: string;
};

type CJProductDetail = {
  variants?: CJVariant[];
};

type BackfillRow = {
  id: string;
  externalProductId: string;
};

export async function backfillCJMerchantIdentifiers(limit = 50) {
  await ensureCatalogSchema();
  const sql = catalogSql();
  const safeLimit = Math.max(1, Math.min(60, Math.floor(limit)));

  const rows = await sql`
    SELECT
      p.id::text AS id,
      p.supplier_external_product_id AS "externalProductId"
    FROM products p
    WHERE p.supplier_platform = 'cj'
      AND p.supplier_sync_enabled = true
      AND p.supplier_external_product_id IS NOT NULL
      AND COALESCE(
        p.supplier_raw_data #>> '{cj,identifiers,updatedAt}',
        ''
      ) = ''
    ORDER BY p.created_at ASC
    LIMIT ${safeLimit}
  ` as unknown as BackfillRow[];

  const report: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const productId = String(row.id);
    const externalProductId = String(row.externalProductId);

    try {
      const detail = await cjRequest<CJProductDetail>(
        `/v1/product/query?pid=${encodeURIComponent(externalProductId)}`,
      );

      let variants = Array.isArray(detail.variants)
        ? detail.variants.filter((variant) => variant.vid)
        : [];

      if (variants.length === 0) {
        try {
          variants = await cjRequest<CJVariant[]>(
            `/v1/product/variant/query?pid=${encodeURIComponent(externalProductId)}`,
          );
        } catch {
          variants = [];
        }
      }

      const identifiers = collectCJProductIdentifiers(
        variants.filter((variant) => variant.vid).slice(0, 100),
      );
      const identifiersJson = JSON.stringify(identifiers);

      await sql`
        UPDATE products
        SET
          supplier_raw_data = COALESCE(supplier_raw_data, '{}'::jsonb)
            || jsonb_build_object(
              'cj',
              COALESCE(supplier_raw_data -> 'cj', '{}'::jsonb)
                || jsonb_build_object(
                  'identifiers',
                  ${identifiersJson}::jsonb
                )
            ),
          updated_at = NOW()
        WHERE id = ${productId}
      `;

      report.push({
        id: productId,
        externalProductId,
        ok: true,
        variants: variants.length,
        gtins: identifiers.gtins.length,
        primaryGtin: identifiers.primaryGtin,
      });
    } catch (error) {
      report.push({
        id: productId,
        externalProductId,
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown CJ identifier backfill error.",
      });
    }
  }

  return {
    processed: rows.length,
    successful: report.filter((entry) => entry.ok).length,
    failed: report.filter((entry) => !entry.ok).length,
    productsWithGtins: report.filter(
      (entry) => entry.ok && Number(entry.gtins || 0) > 0,
    ).length,
    report,
  };
}
