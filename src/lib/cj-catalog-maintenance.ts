import {
  processCatalogueQueue,
  runDailyCatalogueExpansion,
} from "@/lib/catalogue-expansion";
import { syncCJProducts } from "@/lib/cj-sync";
import {
  repairHiddenStorefrontProducts,
  type StorefrontRepairReport,
} from "@/lib/storefront-catalog-health";

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
 * Delivery speed is no longer a reason to delete catalogue records.
 * Slow-but-valid products stay in the database and can carry their truthful
 * delivery estimate. This no-op is kept for compatibility with admin code
 * that imports the old cleanup function.
 */
export async function cleanupBlockedCJProducts(
  _requestedLimit = 100,
): Promise<BlockedProductCleanupReport> {
  return {
    considered: 0,
    removed: 0,
    archived: 0,
    failed: 0,
    products: [],
  };
}

/**
 * Rebuild the catalogue steadily without deleting products just because their
 * verified U.S. delivery estimate is longer than the fastest shipping tier.
 */
export async function runEnhancedCJCatalogueCycle() {
  const primary = await runDailyCatalogueExpansion();
  const desiredPasses = 8;
  const extraProcessing = [];

  for (let index = 1; index < desiredPasses; index += 1) {
    await sleep(1400);
    const result = await processCatalogueQueue({ trigger: "cron" });
    extraProcessing.push(result);
    if (result.status === "skipped" || result.failed > 0 || result.retried > 0) {
      break;
    }
  }

  const repair = await repairHiddenCJProductsSequential(10);

  return {
    primary,
    extraProcessing,
    repair,
    cleanup: await cleanupBlockedCJProducts(),
    message: `CJ catalogue cycle complete: ${1 + extraProcessing.length} queue pass(es), ${repair.repaired} hidden products repaired. Delivery speed no longer deletes catalogue products.`,
  };
}

export async function runEnhancedCJSynchronization() {
  // Keep the scheduled sync comfortably inside Vercel's 300s function limit.
  // The job runs repeatedly, so smaller batches preserve steady catalogue
  // maintenance without allowing one invocation to monopolize the runtime.
  const sync = await syncCJProducts(10);
  const repair = await repairHiddenCJProductsSequential(5);

  return {
    sync,
    repair,
    cleanup: await cleanupBlockedCJProducts(),
  };
}
