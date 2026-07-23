import { randomUUID } from "node:crypto";

import {
  blockedProductReason,
  classifyAutomationProduct,
  DEFAULT_AUTOMATION_CONFIG,
  sanitizeAutomationConfig,
  type AutomationCategoryRule,
  type CatalogAutomationConfig,
} from "@/lib/automation-config";
import {
  catalogSql,
  ensureCatalogSchema,
} from "@/lib/catalog-schema";
import {
  CJProductAlreadyImportedError,
  importCJProduct,
} from "@/lib/cj-import";
import { cjNumber, cjRequest } from "@/lib/cj";
import {
  ensureGlobalMarketSchema,
  getGlobalMarketStats,
  syncFxRates,
} from "@/lib/global-markets";

type CJSearchProduct = {
  id?: string;
  pid?: string;
  nameEn?: string;
  productNameEn?: string;
  sku?: string;
  productSku?: string;
  bigImage?: string;
  productImage?: string;
  sellPrice?: string | number;
  nowPrice?: string | number;
  discountPrice?: string | number;
  categoryName?: string;
  oneCategoryName?: string;
  twoCategoryName?: string;
  threeCategoryName?: string;
  supplierName?: string;
  warehouseInventoryNum?: number;
  totalVerifiedInventory?: number;
  listedNum?: number;
  deliveryCycle?: string;
};

type CJSearchGroup = {
  productList?: CJSearchProduct[];
};

type CJSearchResponse = {
  content?: CJSearchGroup[];
  list?: CJSearchProduct[];
};

type AutomationCandidate = {
  pid: string;
  name: string;
  image: string;
  priceUsd: number;
  sourceCategory: string;
  inventory: number;
  listedNum: number;
  deliveryCycle: string | null;
  searchTerm: string;
  rule: AutomationCategoryRule;
  score: number;
};


export type AutomationDashboardData = {
  config: CatalogAutomationConfig;
  state: {
    lockedUntil: string | null;
    lastRunAt: string | null;
    lastRunStatus: string | null;
    lastRunSummary: Record<string, unknown> | null;
    updatedAt: string | null;
    cronSecretConfigured: boolean;
    cjApiConfigured: boolean;
    fxProvider: string | null;
    fxFetchedAt: string | null;
  };
  stats: {
    cjProducts: number;
    cjActive: number;
    cjDrafts: number;
    needsAttention: number;
    pricedProducts: number;
    globalOffers: number;
    verifiedOffers: number;
    markets: number;
  };
  runs: Array<{
    id: string;
    trigger: string;
    status: string;
    report: Record<string, unknown> | null;
    error: string | null;
    startedAt: string;
    finishedAt: string | null;
  }>;
};

export type AutomationRunReport = {
  runId: string | null;
  trigger: "manual" | "cron";
  status: "success" | "partial" | "failed" | "skipped";
  message: string;
  fetched: number;
  eligible: number;
  shortlisted: number;
  imported: number;
  published: number;
  drafts: number;
  skipped: number;
  failed: number;
  products: Array<{
    pid: string;
    name: string;
    category: string;
    score: number;
    status: string;
    reason?: string;
    productId?: string;
    sellingPriceTzs?: number;
  }>;
};

let automationSchemaPromise: Promise<void> | null = null;

export async function ensureCatalogAutomationSchema() {
  if (!automationSchemaPromise) {
    automationSchemaPromise = (async () => {
      await ensureCatalogSchema();
      await ensureGlobalMarketSchema();
      const sql = catalogSql();

      await sql`
        CREATE TABLE IF NOT EXISTS catalog_automation_settings (
          id text PRIMARY KEY,
          config jsonb NOT NULL,
          lock_token text,
          locked_until timestamptz,
          last_run_at timestamptz,
          last_run_status text,
          last_run_summary jsonb,
          updated_at timestamptz NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS catalog_automation_runs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          trigger_type text NOT NULL,
          status text NOT NULL,
          report jsonb,
          error text,
          started_at timestamptz NOT NULL DEFAULT NOW(),
          finished_at timestamptz
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS catalog_automation_runs_started_idx
        ON catalog_automation_runs (started_at DESC)
      `;

      await sql`
        INSERT INTO catalog_automation_settings (id, config, updated_at)
        VALUES (
          'default',
          ${JSON.stringify(DEFAULT_AUTOMATION_CONFIG)}::jsonb,
          NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `;
    })().catch((error) => {
      automationSchemaPromise = null;
      throw error;
    });
  }

  return automationSchemaPromise;
}

export async function getAutomationSettings() {
  await ensureCatalogAutomationSchema();
  const sql = catalogSql();
  const rows = await sql`
    SELECT config
    FROM catalog_automation_settings
    WHERE id = 'default'
    LIMIT 1
  `;

  return sanitizeAutomationConfig(rows[0]?.config);
}

export async function saveAutomationSettings(value: unknown) {
  await ensureCatalogAutomationSchema();
  const config = sanitizeAutomationConfig(value);
  const sql = catalogSql();

  await sql`
    UPDATE catalog_automation_settings
    SET
      config = ${JSON.stringify(config)}::jsonb,
      updated_at = NOW()
    WHERE id = 'default'
  `;

  return config;
}

export async function getAutomationDashboardData(): Promise<AutomationDashboardData> {
  await ensureCatalogAutomationSchema();
  const sql = catalogSql();

  const [settingsRows, runs, productRows] = await Promise.all([
    sql`
      SELECT
        config,
        locked_until AS "lockedUntil",
        last_run_at AS "lastRunAt",
        last_run_status AS "lastRunStatus",
        last_run_summary AS "lastRunSummary",
        updated_at AS "updatedAt"
      FROM catalog_automation_settings
      WHERE id = 'default'
      LIMIT 1
    `,
    sql`
      SELECT
        id,
        trigger_type AS trigger,
        status,
        report,
        error,
        started_at AS "startedAt",
        finished_at AS "finishedAt"
      FROM catalog_automation_runs
      ORDER BY started_at DESC
      LIMIT 10
    `,
    sql`
      SELECT
        COUNT(*) FILTER (WHERE supplier_platform = 'cj')::int AS "cjProducts",
        COUNT(*) FILTER (
          WHERE supplier_platform = 'cj' AND status::text = 'active'
        )::int AS "cjActive",
        COUNT(*) FILTER (
          WHERE supplier_platform = 'cj' AND status::text = 'draft'
        )::int AS "cjDrafts",
        COUNT(*) FILTER (
          WHERE supplier_platform = 'cj'
            AND supplier_sync_error IS NOT NULL
            AND supplier_sync_error <> ''
        )::int AS "needsAttention"
      FROM products
    `,
  ]);

  const settings = settingsRows[0] || {};
  const statsRow = productRows[0] || {};
  const marketStats = await getGlobalMarketStats();

  return {
    config: sanitizeAutomationConfig(settings.config),
    state: {
      lockedUntil: settings.lockedUntil ? String(settings.lockedUntil) : null,
      lastRunAt: settings.lastRunAt ? String(settings.lastRunAt) : null,
      lastRunStatus: settings.lastRunStatus ? String(settings.lastRunStatus) : null,
      lastRunSummary:
        settings.lastRunSummary && typeof settings.lastRunSummary === "object"
          ? (settings.lastRunSummary as Record<string, unknown>)
          : null,
      updatedAt: settings.updatedAt ? String(settings.updatedAt) : null,
      cronSecretConfigured: Boolean(process.env.CRON_SECRET),
      cjApiConfigured: Boolean(process.env.CJ_API_KEY),
      fxProvider: marketStats.fxProvider || null,
      fxFetchedAt: marketStats.fxFetchedAt,
    },
    stats: {
      cjProducts: Number(statsRow.cjProducts || 0),
      cjActive: Number(statsRow.cjActive || 0),
      cjDrafts: Number(statsRow.cjDrafts || 0),
      needsAttention: Number(statsRow.needsAttention || 0),
      pricedProducts: marketStats.pricedProducts,
      globalOffers: marketStats.availableOffers,
      verifiedOffers: marketStats.verifiedOffers,
      markets: marketStats.markets,
    },
    runs: runs.map((run) => ({
      id: String(run.id),
      trigger: String(run.trigger || "manual"),
      status: String(run.status || "unknown"),
      report:
        run.report && typeof run.report === "object"
          ? (run.report as Record<string, unknown>)
          : null,
      error: run.error ? String(run.error) : null,
      startedAt: String(run.startedAt),
      finishedAt: run.finishedAt ? String(run.finishedAt) : null,
    })),
  };
}

function normalizeSearchProducts(
  data: CJSearchResponse,
  rule: AutomationCategoryRule,
  searchTerm: string,
  config: CatalogAutomationConfig,
) {
  const products = Array.isArray(data.content)
    ? data.content.flatMap((group) =>
        Array.isArray(group.productList) ? group.productList : [],
      )
    : Array.isArray(data.list)
      ? data.list
      : [];

  return products
    .map((product): AutomationCandidate | null => {
      const pid = String(product.id || product.pid || "").trim();
      const name = String(
        product.nameEn || product.productNameEn || "",
      ).trim();
      const priceUsd = cjNumber(
        product.discountPrice ?? product.nowPrice ?? product.sellPrice,
      );
      const inventory = Math.max(
        0,
        Math.floor(
          cjNumber(
            product.totalVerifiedInventory ?? product.warehouseInventoryNum,
          ),
        ),
      );
      const listedNum = Math.max(0, Math.floor(cjNumber(product.listedNum)));
      const image = String(product.bigImage || product.productImage || "").trim();
      const sourceCategory = String(
        product.threeCategoryName ||
          product.categoryName ||
          product.twoCategoryName ||
          product.oneCategoryName ||
          "General",
      ).trim();

      if (!pid || !name || !image || priceUsd <= 0) return null;
      if (
        priceUsd < config.minimumSupplierPriceUsd ||
        priceUsd > config.maximumSupplierPriceUsd
      ) {
        return null;
      }
      if (inventory < config.minimumInventory) return null;
      if (blockedProductReason(`${name} ${sourceCategory}`, config)) return null;

      const classifiedRule = classifyAutomationProduct(
        name,
        sourceCategory,
        rule,
        config,
      );
      const affordability = Math.max(
        0,
        20 -
          (priceUsd / Math.max(1, config.maximumSupplierPriceUsd)) * 12,
      );
      const inventoryScore = Math.min(25, Math.log10(inventory + 1) * 8);
      const popularityScore = Math.min(20, Math.log10(listedNum + 1) * 5);
      const deliveryScore = product.deliveryCycle ? 8 : 2;
      const categoryMatch = classifiedRule.key === rule.key ? 12 : 7;
      const score = Math.round(
        affordability +
          inventoryScore +
          popularityScore +
          deliveryScore +
          categoryMatch +
          10,
      );

      return {
        pid,
        name,
        image,
        priceUsd,
        sourceCategory,
        inventory,
        listedNum,
        deliveryCycle: product.deliveryCycle || null,
        searchTerm,
        rule: classifiedRule,
        score,
      };
    })
    .filter((item): item is AutomationCandidate => Boolean(item));
}

async function fetchCandidatesForRule(
  rule: AutomationCategoryRule,
  config: CatalogAutomationConfig,
) {
  const dayIndex = Math.floor(Date.now() / 86400000);
  const searchTerm =
    rule.searchTerms[dayIndex % Math.max(1, rule.searchTerms.length)] ||
    rule.category;
  const params = new URLSearchParams({
    page: "1",
    size: String(config.searchResultsPerCategory),
    keyWord: searchTerm,
    orderBy: "4",
    sort: "desc",
    startSellPrice: String(config.minimumSupplierPriceUsd),
    endSellPrice: String(config.maximumSupplierPriceUsd),
    startWarehouseInventory: String(config.minimumInventory),
    verifiedWarehouse: "1",
  });
  const data = await cjRequest<CJSearchResponse>(
    `/v1/product/listV2?${params.toString()}`,
  );

  return normalizeSearchProducts(data, rule, searchTerm, config);
}

function selectDiverseCandidates(
  candidates: AutomationCandidate[],
  config: CatalogAutomationConfig,
  existingIds: Set<string>,
  activeByCategory: Map<string, number>,
) {
  const sorted = candidates
    .filter((candidate) => !existingIds.has(candidate.pid))
    .sort((left, right) => right.score - left.score);
  const selected: AutomationCandidate[] = [];
  const selectedByCategory = new Map<string, number>();

  for (const candidate of sorted) {
    if (selected.length >= config.productsPerRun) break;

    const categoryKey = candidate.rule.category.toLowerCase();
    const activeCount = activeByCategory.get(categoryKey) || 0;
    const selectedCount = selectedByCategory.get(categoryKey) || 0;

    if (
      activeCount + selectedCount >= config.maximumActivePerCategory ||
      selectedCount >= candidate.rule.maxImportsPerRun
    ) {
      continue;
    }

    selected.push(candidate);
    selectedByCategory.set(categoryKey, selectedCount + 1);
  }

  return selected;
}

export async function runCatalogAutomation(input: {
  trigger: "manual" | "cron";
  force?: boolean;
}): Promise<AutomationRunReport> {
  await ensureCatalogAutomationSchema();
  const sql = catalogSql();
  const config = await getAutomationSettings();

  if (!config.enabled && !input.force) {
    return {
      runId: null,
      trigger: input.trigger,
      status: "skipped",
      message: "Catalogue automation is disabled.",
      fetched: 0,
      eligible: 0,
      shortlisted: 0,
      imported: 0,
      published: 0,
      drafts: 0,
      skipped: 0,
      failed: 0,
      products: [],
    };
  }

  const lockToken = randomUUID();
  const lock = await sql`
    UPDATE catalog_automation_settings
    SET
      lock_token = ${lockToken},
      locked_until = NOW() + INTERVAL '15 minutes'
    WHERE id = 'default'
      AND (locked_until IS NULL OR locked_until < NOW())
    RETURNING id
  `;

  if (lock.length === 0) {
    return {
      runId: null,
      trigger: input.trigger,
      status: "skipped",
      message: "Another automation run is already in progress.",
      fetched: 0,
      eligible: 0,
      shortlisted: 0,
      imported: 0,
      published: 0,
      drafts: 0,
      skipped: 0,
      failed: 0,
      products: [],
    };
  }

  const runId = randomUUID();
  await sql`
    INSERT INTO catalog_automation_runs (
      id,
      trigger_type,
      status,
      started_at
    )
    VALUES (${runId}, ${input.trigger}, 'running', NOW())
  `;

  const report: AutomationRunReport = {
    runId,
    trigger: input.trigger,
    status: "success",
    message: "Global catalogue automation completed.",
    fetched: 0,
    eligible: 0,
    shortlisted: 0,
    imported: 0,
    published: 0,
    drafts: 0,
    skipped: 0,
    failed: 0,
    products: [],
  };

  try {
    try {
      await syncFxRates({ refreshHours: config.fxRefreshHours });
    } catch (error) {
      report.products.push({
        pid: "fx",
        name: "Currency synchronization",
        category: "Global pricing",
        score: 0,
        status: "warning",
        reason:
          error instanceof Error
            ? `${error.message} Cached rates were used.`
            : "Cached currency rates were used.",
      });
    }

    const allEnabledRules = config.categoryRules.filter((rule) => rule.enabled);
    const dayIndex = Math.floor(Date.now() / 86400000);
    const enabledRules = Array.from(
      { length: Math.min(config.categoriesPerRun, allEnabledRules.length) },
      (_, index) =>
        allEnabledRules[(dayIndex + index) % Math.max(1, allEnabledRules.length)],
    ).filter(Boolean);
    const allCandidates: AutomationCandidate[] = [];

    for (const rule of enabledRules) {
      try {
        const candidates = await fetchCandidatesForRule(rule, config);
        report.fetched += config.searchResultsPerCategory;
        report.eligible += candidates.length;
        allCandidates.push(...candidates);
      } catch (error) {
        report.failed += 1;
        report.products.push({
          pid: "search",
          name: `${rule.category} search`,
          category: rule.category,
          score: 0,
          status: "failed",
          reason:
            error instanceof Error ? error.message : "CJ search failed.",
        });
      }
    }

    const [existingRows, categoryRows] = await Promise.all([
      sql`
        SELECT supplier_external_product_id AS id
        FROM products
        WHERE supplier_platform = 'cj'
          AND supplier_external_product_id IS NOT NULL
      `,
      sql`
        SELECT
          LOWER(COALESCE(c.name, 'general')) AS category,
          COUNT(*) FILTER (WHERE p.status::text = 'active')::int AS active
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        GROUP BY LOWER(COALESCE(c.name, 'general'))
      `,
    ]);

    const existingIds = new Set(
      existingRows.map((row) => String(row.id || "")).filter(Boolean),
    );
    const activeByCategory = new Map(
      categoryRows.map((row) => [
        String(row.category || "general"),
        Number(row.active || 0),
      ]),
    );
    const unique = new Map<string, AutomationCandidate>();

    for (const candidate of allCandidates) {
      const current = unique.get(candidate.pid);
      if (!current || candidate.score > current.score) {
        unique.set(candidate.pid, candidate);
      }
    }

    const selected = selectDiverseCandidates(
      [...unique.values()],
      config,
      existingIds,
      activeByCategory,
    );
    report.shortlisted = selected.length;
    report.skipped = Math.max(0, unique.size - selected.length);

    for (const candidate of selected) {
      try {
        const imported = await importCJProduct({
          pid: candidate.pid,
          inventoryHint: candidate.inventory,
          categoryName: candidate.rule.category,
          source: "autopilot",
          runId,
          candidateScore: candidate.score,
          sourceSearchTerm: candidate.searchTerm,
          autoPublish: config.autoPublish,
          minimumInventory: config.minimumInventory,
          maximumSellingPriceTzs: config.maximumSellingPriceTzs,
          automationConfig: config,
          markupPercent: candidate.rule.markupPercent,
          usdToTzsRate: config.usdToTzsRate,
          reserveTzs: config.riskReserveTzs,
        });

        report.imported += 1;
        if (imported.published) report.published += 1;
        else report.drafts += 1;
        report.products.push({
          pid: candidate.pid,
          name: imported.name,
          category: imported.categoryName,
          score: candidate.score,
          status: imported.status,
          reason: imported.warning || undefined,
          productId: imported.id,
          sellingPriceTzs: imported.sellingPriceTzs,
        });
      } catch (error) {
        if (error instanceof CJProductAlreadyImportedError) {
          report.skipped += 1;
          report.products.push({
            pid: candidate.pid,
            name: candidate.name,
            category: candidate.rule.category,
            score: candidate.score,
            status: "skipped",
            reason: error.message,
            productId: error.existingProductId,
          });
          continue;
        }

        report.failed += 1;
        report.products.push({
          pid: candidate.pid,
          name: candidate.name,
          category: candidate.rule.category,
          score: candidate.score,
          status: "failed",
          reason:
            error instanceof Error ? error.message : "Import failed.",
        });
      }
    }

    report.status = report.failed > 0 ? "partial" : "success";
    report.message =
      report.imported > 0
        ? `${report.imported} products imported: ${report.published} published and ${report.drafts} retained as drafts.`
        : "No new globally eligible products met the automation rules during this run.";

    await sql`
      UPDATE catalog_automation_runs
      SET
        status = ${report.status},
        report = ${JSON.stringify(report)}::jsonb,
        finished_at = NOW()
      WHERE id = ${runId}
    `;

    await sql`
      UPDATE catalog_automation_settings
      SET
        last_run_at = NOW(),
        last_run_status = ${report.status},
        last_run_summary = ${JSON.stringify(report)}::jsonb,
        lock_token = NULL,
        locked_until = NULL,
        updated_at = NOW()
      WHERE id = 'default'
        AND lock_token = ${lockToken}
    `;

    return report;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Catalogue automation failed.";
    report.status = "failed";
    report.message = message;
    report.failed += 1;

    await sql`
      UPDATE catalog_automation_runs
      SET
        status = 'failed',
        report = ${JSON.stringify(report)}::jsonb,
        error = ${message},
        finished_at = NOW()
      WHERE id = ${runId}
    `;

    await sql`
      UPDATE catalog_automation_settings
      SET
        last_run_at = NOW(),
        last_run_status = 'failed',
        last_run_summary = ${JSON.stringify(report)}::jsonb,
        lock_token = NULL,
        locked_until = NULL,
        updated_at = NOW()
      WHERE id = 'default'
        AND lock_token = ${lockToken}
    `;

    return report;
  }
}
