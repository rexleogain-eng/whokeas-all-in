import {
  getCatalogueExpansionSettings,
  processCatalogueQueue,
  runDailyCatalogueExpansion,
} from "@/lib/catalogue-expansion";
import { catalogSql, ensureCatalogSchema } from "@/lib/catalog-schema";
import { syncCJProducts } from "@/lib/cj-sync";
import { ensureGlobalMarketSchema } from "@/lib/global-markets";
import {
  repairHiddenStorefrontProducts,
  type StorefrontRepairReport,
} from "@/lib/storefront-catalog-health";
import {
  US_SHIPPING_MAX_DAYS,
  US_TARGET_COUNTRY_CODE,
} from "@/lib/seo";

export type BlockedProductCleanupReport = {
  considered: number;
  removed: number;
  archived: number;
  failed: number;
  products: Array<{
    id: string;
    name: string;
    reason: string;
    action: "removed" | "archived" | "failed";
    message?: string;
  }>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function emptyRepairReport(): StorefrontRepairReport {
  return {
    attempted: 0,
    repaired: 0,
    stillHidden: 0,
    drafted: 0,
    failed: 0,
    products: [],
  };
}

function mergeRepairReport(
  target: StorefrontRepairReport,
  source: StorefrontRepairReport,
) {
  target.attempted += source.attempted;
  target.repaired += source.repaired;
  target.stillHidden += source.stillHidden;
  target.drafted += source.drafted;
  target.failed += source.failed;
  target.products.push(...source.products);
}

/**
 * repairHiddenStorefrontProducts intentionally handles at most five products
 * per API call. This helper keeps that low-level throttle but can run several
 * serialized batches when an admin or cron wants a larger maintenance pass.
 */
export async function repairHiddenCJProductsSequential(
  requestedLimit = 10,
): Promise<StorefrontRepairReport> {
  const total = Math.max(1, Math.min(25, Math.floor(requestedLimit || 10)));
  const merged = emptyRepairReport();

  while (merged.attempted < total) {
    const remaining = total - merged.attempted;
    const batch = await repairHiddenStorefrontProducts(Math.min(5, remaining));
    mergeRepairReport(merged, batch);

    if (batch.attempted === 0 || batch.attempted < Math.min(5, remaining)) {
      break;
    }

    if (merged.failed > 0) break;
    await sleep(1800);
  }

  return merged;
}

/**
 * Removes CJ products that are definitively unsuitable for the U.S. store:
 * an existing U.S. offer is unavailable, or its delivery estimate is above
 * the store's published maximum. Missing offers and price errors are kept for
 * repair because they may be data problems rather than bad products.
 *
 * Products referenced by an order are archived instead of deleted so order
 * history remains intact. Product images/variants/market offers cascade when
 * a product is deleted. CJ image URLs are remote references, not uploaded
 * image bytes in Supabase Storage.
 */
export async function cleanupBlockedCJProducts(
  requestedLimit = 100,
): Promise<BlockedProductCleanupReport> {
  await ensureCatalogSchema();
  await ensureGlobalMarketSchema();
  const sql = catalogSql();
  const limit = Math.max(1, Math.min(250, Math.floor(requestedLimit || 100)));

  const candidates = await sql`
    WITH latest_us AS (
      SELECT DISTINCT ON (market.product_id)
        market.product_id,
        market.available,
        market.estimated_delivery_days,
        market.updated_at
      FROM product_market_prices market
      WHERE market.country_code = ${US_TARGET_COUNTRY_CODE}
        AND market.currency = 'USD'
      ORDER BY
        market.product_id,
        market.is_primary DESC,
        market.updated_at DESC
    )
    SELECT
      p.id,
      p.name,
      p.supplier_external_product_id AS "externalProductId",
      CASE
        WHEN latest_us.available IS NOT TRUE THEN 'us_shipping_unavailable'
        ELSE 'delivery_over_limit'
      END AS reason,
      EXISTS (
        SELECT 1
        FROM order_items item
        WHERE item.product_id = p.id
      ) AS "hasOrderHistory"
    FROM products p
    JOIN latest_us ON latest_us.product_id = p.id
    WHERE p.supplier_platform = 'cj'
      AND p.status::text = 'active'
      AND (
        latest_us.available IS NOT TRUE
        OR (
          latest_us.estimated_delivery_days IS NOT NULL
          AND latest_us.estimated_delivery_days > ${US_SHIPPING_MAX_DAYS}
        )
      )
    ORDER BY latest_us.updated_at ASC, p.updated_at ASC
    LIMIT ${limit}
  `;

  const report: BlockedProductCleanupReport = {
    considered: candidates.length,
    removed: 0,
    archived: 0,
    failed: 0,
    products: [],
  };

  for (const candidate of candidates) {
    const id = String(candidate.id);
    const name = String(candidate.name || "CJ product");
    const externalProductId = String(candidate.externalProductId || "");
    const reason = String(candidate.reason || "blocked");
    const reasonMessage =
      reason === "us_shipping_unavailable"
        ? "Removed from U.S. catalogue: CJ shipping is unavailable."
        : `Removed from U.S. catalogue: delivery exceeds ${US_SHIPPING_MAX_DAYS} days.`;

    try {
      if (Boolean(candidate.hasOrderHistory)) {
        await sql`
          UPDATE products
          SET
            status = 'archived',
            supplier_sync_enabled = false,
            supplier_sync_error = ${reasonMessage},
            updated_at = NOW()
          WHERE id = ${id}
        `;

        await sql`
          UPDATE catalogue_import_queue
          SET
            status = 'rejected',
            imported_status = 'archived',
            last_error = ${reasonMessage},
            updated_at = NOW()
          WHERE product_id = ${id}
             OR (
               supplier_platform = 'cj'
               AND supplier_external_product_id = ${externalProductId}
             )
        `;

        report.archived += 1;
        report.products.push({
          id,
          name,
          reason,
          action: "archived",
        });
        continue;
      }

      await sql`
        UPDATE catalogue_import_queue
        SET
          status = 'rejected',
          product_id = NULL,
          imported_status = 'removed',
          last_error = ${reasonMessage},
          updated_at = NOW()
        WHERE product_id = ${id}
           OR (
             supplier_platform = 'cj'
             AND supplier_external_product_id = ${externalProductId}
           )
      `;

      try {
        await sql`DELETE FROM products WHERE id = ${id}`;
        report.removed += 1;
        report.products.push({
          id,
          name,
          reason,
          action: "removed",
        });
      } catch (deleteError) {
        const fallbackMessage =
          deleteError instanceof Error
            ? `Delete was blocked by related data, so the product was archived instead: ${deleteError.message}`
            : "Delete was blocked by related data, so the product was archived instead.";

        await sql`
          UPDATE products
          SET
            status = 'archived',
            supplier_sync_enabled = false,
            supplier_sync_error = ${reasonMessage},
            updated_at = NOW()
          WHERE id = ${id}
        `;

        report.archived += 1;
        report.products.push({
          id,
          name,
          reason,
          action: "archived",
          message: fallbackMessage,
        });
      }
    } catch (error) {
      report.failed += 1;
      report.products.push({
        id,
        name,
        reason,
        action: "failed",
        message: error instanceof Error ? error.message : "Blocked product cleanup failed.",
      });
    }
  }

  return report;
}

/**
 * Catalogue Fill used to process only one queue item even when the admin
 * setting requested a larger safe batch. This enhanced cycle keeps each CJ
 * request sequential, but allows up to three queue imports in the same cron.
 */
export async function runEnhancedCJCatalogueCycle() {
  const primary = await runDailyCatalogueExpansion();
  const config = await getCatalogueExpansionSettings();
  const desiredImports = Math.max(1, Math.min(3, config.processBatchSize || 3));
  const extraProcessing = [];

  for (let index = 1; index < desiredImports; index += 1) {
    await sleep(1800);
    const result = await processCatalogueQueue({ trigger: "cron" });
    extraProcessing.push(result);
    if (result.status === "skipped" || result.failed > 0 || result.retried > 0) {
      break;
    }
  }

  const repair = await repairHiddenCJProductsSequential(10);
  const cleanup = await cleanupBlockedCJProducts(100);

  return {
    primary,
    extraProcessing,
    repair,
    cleanup,
    message: `CJ catalogue cycle complete: ${1 + extraProcessing.length} queue pass(es), ${repair.repaired} hidden products repaired, ${cleanup.removed} blocked products removed and ${cleanup.archived} archived.`,
  };
}

export async function runEnhancedCJSynchronization() {
  const sync = await syncCJProducts(20);
  const repair = await repairHiddenCJProductsSequential(10);
  const cleanup = await cleanupBlockedCJProducts(100);

  return {
    sync,
    repair,
    cleanup,
  };
}
