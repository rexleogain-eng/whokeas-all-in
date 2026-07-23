import { randomUUID } from "node:crypto";

import {
  blockedProductReason,
  classifyAutomationProduct,
  sanitizeAutomationConfig,
  type AutomationCategoryRule,
  type CatalogAutomationConfig,
} from "@/lib/automation-config";
import {
  ensureCatalogAutomationSchema,
  getAutomationSettings,
} from "@/lib/catalog-automation";
import { catalogSql, ensureCatalogSchema } from "@/lib/catalog-schema";
import {
  CJProductAlreadyImportedError,
  importCJProduct,
} from "@/lib/cj-import";
import {
  CJRequestError,
  cjNumber,
  cjRequest,
  isCJThrottleError,
} from "@/lib/cj";
import { ensureGlobalMarketSchema } from "@/lib/global-markets";

export type CatalogueTarget = {
  key: string;
  category: string;
  target: number;
  enabled: boolean;
};

export type CatalogueExpansionConfig = {
  enabled: boolean;
  paused: boolean;
  autoPublish: boolean;
  targetTotal: number;
  discoveryCategoriesPerRun: number;
  searchResultsPerCategory: number;
  processBatchSize: number;
  minimumScore: number;
  minimumInventory: number;
  minimumImages: number;
  maximumAttempts: number;
  queueRefillThreshold: number;
  exactFreightMarketsPerImport: number;
  delayBetweenProductsMs: number;
  targets: CatalogueTarget[];
};

export type CatalogueQueueStatus =
  | "queued"
  | "processing"
  | "published"
  | "draft"
  | "skipped"
  | "rejected"
  | "failed";

export type CatalogueExpansionDashboard = {
  config: CatalogueExpansionConfig;
  stats: {
    totalProducts: number;
    realSupplierProducts: number;
    activeProducts: number;
    draftProducts: number;
    trialCandidates: number;
    queued: number;
    processing: number;
    published: number;
    retainedDrafts: number;
    rejected: number;
    failed: number;
    importedToday: number;
    targetTotal: number;
    completionPercent: number;
  };
  categoryProgress: Array<{
    key: string;
    category: string;
    target: number;
    current: number;
    active: number;
    drafts: number;
    queued: number;
    remaining: number;
  }>;
  queue: Array<{
    id: string;
    pid: string;
    name: string;
    category: string;
    score: number;
    inventory: number;
    priceUsd: number;
    status: string;
    attempts: number;
    reason: string | null;
    productId: string | null;
    updatedAt: string;
  }>;
  runs: Array<{
    id: string;
    action: string;
    status: string;
    report: Record<string, unknown> | null;
    error: string | null;
    startedAt: string;
    finishedAt: string | null;
  }>;
};

export type DiscoveryReport = {
  runId: string;
  status: "success" | "partial" | "failed" | "skipped";
  message: string;
  searches: number;
  fetched: number;
  eligible: number;
  queued: number;
  duplicates: number;
  rejected: number;
  throttled: number;
  failed: number;
  categories: Array<{
    category: string;
    term: string;
    page: number;
    fetched: number;
    queued: number;
    reason?: string;
  }>;
};

export type ProcessingReport = {
  runId: string;
  status: "success" | "partial" | "failed" | "skipped";
  message: string;
  claimed: number;
  processed: number;
  published: number;
  drafts: number;
  skipped: number;
  retried: number;
  failed: number;
  products: Array<{
    pid: string;
    name: string;
    category: string;
    status: string;
    reason?: string;
    productId?: string;
  }>;
};

type CJSearchProduct = {
  id?: string;
  pid?: string;
  nameEn?: string;
  productNameEn?: string;
  bigImage?: string;
  productImage?: string;
  sellPrice?: string | number;
  nowPrice?: string | number;
  discountPrice?: string | number;
  categoryName?: string;
  oneCategoryName?: string;
  twoCategoryName?: string;
  threeCategoryName?: string;
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

type QueueCandidate = {
  pid: string;
  name: string;
  image: string;
  category: string;
  searchTerm: string;
  sourceCategory: string;
  priceUsd: number;
  inventory: number;
  score: number;
  fingerprint: string;
};

const DEFAULT_TARGETS: CatalogueTarget[] = [
  { key: "tech", category: "Tech", target: 40, enabled: true },
  { key: "home", category: "Home", target: 35, enabled: true },
  { key: "fashion", category: "Fashion", target: 30, enabled: true },
  { key: "study", category: "Study", target: 25, enabled: true },
  { key: "beauty", category: "Beauty", target: 20, enabled: true },
  { key: "accessories", category: "Accessories", target: 20, enabled: true },
];

export const DEFAULT_CATALOGUE_EXPANSION_CONFIG: CatalogueExpansionConfig = {
  enabled: true,
  paused: false,
  autoPublish: true,
  targetTotal: 170,
  discoveryCategoriesPerRun: 4,
  searchResultsPerCategory: 20,
  processBatchSize: 2,
  minimumScore: 42,
  minimumInventory: 20,
  minimumImages: 2,
  maximumAttempts: 4,
  queueRefillThreshold: 12,
  exactFreightMarketsPerImport: 1,
  delayBetweenProductsMs: 2400,
  targets: DEFAULT_TARGETS,
};

const TRIAL_SLUGS = [
  "wireless-earbuds",
  "foldable-laptop-stand",
  "focus-study-lamp",
  "desk-organizer",
  "wai-signature-tee",
  "smart-storage-set",
];

const TRIAL_NAMES = [
  "Wireless Earbuds",
  "Foldable Laptop Stand",
  "Focus Study Lamp",
  "Desk Organizer",
  "WAI Signature Tee",
  "Smart Storage Set",
];

let schemaPromise: Promise<void> | null = null;

function numberWithin(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function targetKey(value: unknown, fallback: string) {
  const key = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return key || fallback;
}

function sanitizeTargets(value: unknown) {
  if (!Array.isArray(value)) return DEFAULT_TARGETS;

  const targets = value
    .map((item, index): CatalogueTarget | null => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const fallback =
        DEFAULT_TARGETS.find(
          (candidate) =>
            candidate.key === String(record.key || "").toLowerCase(),
        ) || DEFAULT_TARGETS[index];
      const category = String(record.category || fallback?.category || "")
        .trim()
        .slice(0, 120);
      if (!category) return null;

      return {
        key: targetKey(record.key, fallback?.key || `category-${index + 1}`),
        category,
        target: Math.floor(
          numberWithin(record.target, fallback?.target || 20, 0, 500),
        ),
        enabled: record.enabled !== false,
      };
    })
    .filter((item): item is CatalogueTarget => Boolean(item));

  return targets.length > 0 ? targets.slice(0, 20) : DEFAULT_TARGETS;
}

export function sanitizeCatalogueExpansionConfig(
  value: unknown,
): CatalogueExpansionConfig {
  const input =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const targets = sanitizeTargets(input.targets);
  const targetSum = targets
    .filter((target) => target.enabled)
    .reduce((sum, target) => sum + target.target, 0);

  return {
    enabled: input.enabled !== false,
    paused: input.paused === true,
    autoPublish: input.autoPublish !== false,
    targetTotal: Math.floor(
      numberWithin(
        input.targetTotal,
        targetSum || DEFAULT_CATALOGUE_EXPANSION_CONFIG.targetTotal,
        1,
        3000,
      ),
    ),
    discoveryCategoriesPerRun: Math.floor(
      numberWithin(
        input.discoveryCategoriesPerRun,
        DEFAULT_CATALOGUE_EXPANSION_CONFIG.discoveryCategoriesPerRun,
        1,
        10,
      ),
    ),
    searchResultsPerCategory: Math.floor(
      numberWithin(
        input.searchResultsPerCategory,
        DEFAULT_CATALOGUE_EXPANSION_CONFIG.searchResultsPerCategory,
        5,
        50,
      ),
    ),
    processBatchSize: Math.floor(
      numberWithin(
        input.processBatchSize,
        DEFAULT_CATALOGUE_EXPANSION_CONFIG.processBatchSize,
        1,
        3,
      ),
    ),
    minimumScore: Math.floor(
      numberWithin(
        input.minimumScore,
        DEFAULT_CATALOGUE_EXPANSION_CONFIG.minimumScore,
        0,
        100,
      ),
    ),
    minimumInventory: Math.floor(
      numberWithin(
        input.minimumInventory,
        DEFAULT_CATALOGUE_EXPANSION_CONFIG.minimumInventory,
        0,
        1000000,
      ),
    ),
    minimumImages: Math.floor(
      numberWithin(
        input.minimumImages,
        DEFAULT_CATALOGUE_EXPANSION_CONFIG.minimumImages,
        1,
        10,
      ),
    ),
    maximumAttempts: Math.floor(
      numberWithin(
        input.maximumAttempts,
        DEFAULT_CATALOGUE_EXPANSION_CONFIG.maximumAttempts,
        1,
        10,
      ),
    ),
    queueRefillThreshold: Math.floor(
      numberWithin(
        input.queueRefillThreshold,
        DEFAULT_CATALOGUE_EXPANSION_CONFIG.queueRefillThreshold,
        2,
        250,
      ),
    ),
    exactFreightMarketsPerImport: Math.floor(
      numberWithin(
        input.exactFreightMarketsPerImport,
        DEFAULT_CATALOGUE_EXPANSION_CONFIG.exactFreightMarketsPerImport,
        1,
        4,
      ),
    ),
    delayBetweenProductsMs: Math.floor(
      numberWithin(
        input.delayBetweenProductsMs,
        DEFAULT_CATALOGUE_EXPANSION_CONFIG.delayBetweenProductsMs,
        1000,
        15000,
      ),
    ),
    targets,
  };
}

export async function ensureCatalogueExpansionSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await ensureCatalogSchema();
      await ensureGlobalMarketSchema();
      await ensureCatalogAutomationSchema();
      const sql = catalogSql();

      await sql`
        CREATE TABLE IF NOT EXISTS catalogue_expansion_settings (
          id text PRIMARY KEY,
          config jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS catalogue_search_cursors (
          category_key varchar(60) PRIMARY KEY,
          search_term_index integer NOT NULL DEFAULT 0,
          page_number integer NOT NULL DEFAULT 1,
          updated_at timestamptz NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS catalogue_import_queue (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          supplier_platform varchar(40) NOT NULL DEFAULT 'cj',
          supplier_external_product_id varchar(220) NOT NULL,
          product_name text NOT NULL,
          name_fingerprint varchar(220) NOT NULL,
          image_url text,
          category_name varchar(120) NOT NULL,
          source_category text,
          source_search_term text,
          supplier_price_usd numeric(14,4) NOT NULL DEFAULT 0,
          inventory integer NOT NULL DEFAULT 0,
          score integer NOT NULL DEFAULT 0,
          status varchar(30) NOT NULL DEFAULT 'queued',
          attempts integer NOT NULL DEFAULT 0,
          available_at timestamptz NOT NULL DEFAULT NOW(),
          locked_at timestamptz,
          locked_by text,
          product_id uuid REFERENCES products(id) ON DELETE SET NULL,
          imported_status varchar(30),
          last_error text,
          created_at timestamptz NOT NULL DEFAULT NOW(),
          updated_at timestamptz NOT NULL DEFAULT NOW(),
          UNIQUE (supplier_platform, supplier_external_product_id)
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS catalogue_import_queue_work_idx
        ON catalogue_import_queue (
          status,
          available_at,
          score DESC,
          created_at
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS catalogue_import_queue_category_idx
        ON catalogue_import_queue (LOWER(category_name), status)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS catalogue_import_queue_fingerprint_idx
        ON catalogue_import_queue (name_fingerprint)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS catalogue_expansion_runs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          action varchar(40) NOT NULL,
          trigger_type varchar(40) NOT NULL DEFAULT 'manual',
          status varchar(30) NOT NULL,
          report jsonb,
          error text,
          started_at timestamptz NOT NULL DEFAULT NOW(),
          finished_at timestamptz
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS catalogue_expansion_runs_started_idx
        ON catalogue_expansion_runs (started_at DESC)
      `;

      await sql`
        INSERT INTO catalogue_expansion_settings (id, config, updated_at)
        VALUES (
          'default',
          ${JSON.stringify(DEFAULT_CATALOGUE_EXPANSION_CONFIG)}::jsonb,
          NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `;

      // Jobs interrupted by a deployment or closed browser are safely returned
      // to the queue after twenty minutes.
      await sql`
        UPDATE catalogue_import_queue
        SET
          status = 'queued',
          locked_at = NULL,
          locked_by = NULL,
          available_at = NOW(),
          last_error = COALESCE(last_error, 'Recovered after an interrupted job.'),
          updated_at = NOW()
        WHERE status = 'processing'
          AND locked_at < NOW() - INTERVAL '20 minutes'
      `;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  return schemaPromise;
}

export async function getCatalogueExpansionSettings() {
  await ensureCatalogueExpansionSchema();
  const sql = catalogSql();
  const rows = await sql`
    SELECT config
    FROM catalogue_expansion_settings
    WHERE id = 'default'
    LIMIT 1
  `;
  return sanitizeCatalogueExpansionConfig(rows[0]?.config);
}

export async function saveCatalogueExpansionSettings(value: unknown) {
  await ensureCatalogueExpansionSchema();
  const config = sanitizeCatalogueExpansionConfig(value);
  const sql = catalogSql();

  await sql`
    UPDATE catalogue_expansion_settings
    SET config = ${JSON.stringify(config)}::jsonb, updated_at = NOW()
    WHERE id = 'default'
  `;

  return config;
}

function nameFingerprint(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(new|hot|sale|2024|2025|2026|with|for|and|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 14)
    .sort()
    .join("-")
    .slice(0, 220);
}

function validImage(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeSearchProducts(
  data: CJSearchResponse,
  fallbackRule: AutomationCategoryRule,
  searchTerm: string,
  automationConfig: CatalogAutomationConfig,
  expansionConfig: CatalogueExpansionConfig,
) {
  const products = Array.isArray(data.content)
    ? data.content.flatMap((group) =>
        Array.isArray(group.productList) ? group.productList : [],
      )
    : Array.isArray(data.list)
      ? data.list
      : [];

  const candidates: QueueCandidate[] = [];
  let rejected = 0;

  for (const product of products) {
    const pid = String(product.id || product.pid || "").trim();
    const name = String(
      product.nameEn || product.productNameEn || "",
    ).trim();
    const image = String(product.bigImage || product.productImage || "").trim();
    const sourceCategory = String(
      product.threeCategoryName ||
        product.categoryName ||
        product.twoCategoryName ||
        product.oneCategoryName ||
        "General",
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

    const blocked = blockedProductReason(
      `${name} ${sourceCategory}`,
      automationConfig,
    );
    const invalid =
      !pid ||
      name.length < 8 ||
      !validImage(image) ||
      priceUsd < automationConfig.minimumSupplierPriceUsd ||
      priceUsd > automationConfig.maximumSupplierPriceUsd ||
      inventory < expansionConfig.minimumInventory ||
      Boolean(blocked);

    if (invalid) {
      rejected += 1;
      continue;
    }

    const rule = classifyAutomationProduct(
      name,
      sourceCategory,
      fallbackRule,
      automationConfig,
    );
    const affordability = Math.max(
      0,
      24 -
        (priceUsd /
          Math.max(1, automationConfig.maximumSupplierPriceUsd)) *
          15,
    );
    const inventoryScore = Math.min(28, Math.log10(inventory + 1) * 8.5);
    const popularityScore = Math.min(20, Math.log10(listedNum + 1) * 5.5);
    const categoryScore = rule.key === fallbackRule.key ? 15 : 9;
    const deliveryScore = product.deliveryCycle ? 7 : 2;
    const score = Math.round(
      affordability +
        inventoryScore +
        popularityScore +
        categoryScore +
        deliveryScore +
        8,
    );

    if (score < expansionConfig.minimumScore) {
      rejected += 1;
      continue;
    }

    candidates.push({
      pid,
      name: name.slice(0, 500),
      image,
      category: rule.category,
      searchTerm,
      sourceCategory,
      priceUsd,
      inventory,
      score,
      fingerprint: nameFingerprint(name),
    });
  }

  return { candidates, rejected, fetched: products.length };
}

async function nextSearch(rule: AutomationCategoryRule) {
  const sql = catalogSql();
  const rows = await sql`
    INSERT INTO catalogue_search_cursors (
      category_key,
      search_term_index,
      page_number,
      updated_at
    )
    VALUES (${rule.key}, 0, 1, NOW())
    ON CONFLICT (category_key)
    DO UPDATE SET updated_at = catalogue_search_cursors.updated_at
    RETURNING search_term_index AS "termIndex", page_number AS page
  `;

  const termIndex = Math.max(0, Number(rows[0]?.termIndex || 0));
  const page = Math.max(1, Number(rows[0]?.page || 1));
  const terms = rule.searchTerms.length > 0 ? rule.searchTerms : [rule.category];
  const term = terms[termIndex % terms.length] || rule.category;

  const nextPage = page >= 5 ? 1 : page + 1;
  const nextIndex = page >= 5 ? (termIndex + 1) % terms.length : termIndex;

  await sql`
    UPDATE catalogue_search_cursors
    SET
      search_term_index = ${nextIndex},
      page_number = ${nextPage},
      updated_at = NOW()
    WHERE category_key = ${rule.key}
  `;

  return { term, page };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

async function startRun(action: string, trigger: string) {
  const sql = catalogSql();
  const id = randomUUID();
  await sql`
    INSERT INTO catalogue_expansion_runs (
      id, action, trigger_type, status, started_at
    )
    VALUES (${id}, ${action}, ${trigger}, 'running', NOW())
  `;
  return id;
}

async function finishRun(
  id: string,
  status: string,
  report: unknown,
  error?: string | null,
) {
  const sql = catalogSql();
  await sql`
    UPDATE catalogue_expansion_runs
    SET
      status = ${status},
      report = ${JSON.stringify(report)}::jsonb,
      error = ${error || null},
      finished_at = NOW()
    WHERE id = ${id}
  `;
}

async function categoryCounts(): Promise<
  Map<string, { current: number; active: number; drafts: number }>
> {
  const sql = catalogSql();
  const rows = await sql`
    SELECT
      LOWER(COALESCE(c.name, 'general')) AS category,
      COUNT(*) FILTER (
        WHERE p.supplier_platform IS NOT NULL
          AND p.supplier_platform <> ''
      )::int AS current,
      COUNT(*) FILTER (
        WHERE p.supplier_platform IS NOT NULL
          AND p.supplier_platform <> ''
          AND p.status::text = 'active'
      )::int AS active,
      COUNT(*) FILTER (
        WHERE p.supplier_platform IS NOT NULL
          AND p.supplier_platform <> ''
          AND p.status::text = 'draft'
      )::int AS drafts
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    GROUP BY LOWER(COALESCE(c.name, 'general'))
  `;

  return new Map<string, { current: number; active: number; drafts: number }>(
    rows.map((row: Record<string, unknown>) => [
      String(row.category || "general"),
      {
        current: Number(row.current || 0),
        active: Number(row.active || 0),
        drafts: Number(row.drafts || 0),
      },
    ]),
  );
}

function activeRulesForTargets(
  automationConfig: CatalogAutomationConfig,
  expansionConfig: CatalogueExpansionConfig,
  counts: Map<string, { current: number; active: number; drafts: number }>,
) {
  const result: Array<{
    target: CatalogueTarget;
    rule: AutomationCategoryRule;
    remaining: number;
  }> = [];

  for (const target of expansionConfig.targets) {
    if (!target.enabled || target.target <= 0) continue;
    const rule = automationConfig.categoryRules.find(
      (candidate) =>
        candidate.key === target.key ||
        candidate.category.toLowerCase() === target.category.toLowerCase(),
    );
    if (!rule || !rule.enabled) continue;

    const progress = counts.get(target.category.toLowerCase())?.current || 0;
    const remaining = Math.max(0, target.target - progress);
    if (remaining <= 0) continue;

    result.push({ target, rule, remaining });
  }

  return result.sort((left, right) => right.remaining - left.remaining);
}

export async function discoverCatalogueCandidates(input?: {
  trigger?: "manual" | "cron";
  force?: boolean;
}): Promise<DiscoveryReport> {
  await ensureCatalogueExpansionSchema();
  const trigger = input?.trigger || "manual";
  const expansionConfig = await getCatalogueExpansionSettings();
  const automationConfig = await getAutomationSettings();
  const runId = await startRun("discover", trigger);
  const report: DiscoveryReport = {
    runId,
    status: "success",
    message: "Catalogue discovery completed.",
    searches: 0,
    fetched: 0,
    eligible: 0,
    queued: 0,
    duplicates: 0,
    rejected: 0,
    throttled: 0,
    failed: 0,
    categories: [],
  };

  try {
    if (
      (!expansionConfig.enabled || expansionConfig.paused) &&
      !input?.force
    ) {
      report.status = "skipped";
      report.message = "Catalogue expansion is paused or disabled.";
      await finishRun(runId, report.status, report);
      return report;
    }

    const sql = catalogSql();
    const existingCountRows = await sql`
      SELECT COUNT(*)::int AS count
      FROM products
      WHERE supplier_platform IS NOT NULL
        AND supplier_platform <> ''
    `;
    const realCount = Number(existingCountRows[0]?.count || 0);
    if (realCount >= expansionConfig.targetTotal) {
      report.status = "skipped";
      report.message = `Catalogue target of ${expansionConfig.targetTotal} real products has been reached.`;
      await finishRun(runId, report.status, report);
      return report;
    }

    const counts = await categoryCounts();
    const targets = activeRulesForTargets(
      automationConfig,
      expansionConfig,
      counts,
    ).slice(0, expansionConfig.discoveryCategoriesPerRun);

    if (targets.length === 0) {
      report.status = "skipped";
      report.message = "Every enabled category target has been reached.";
      await finishRun(runId, report.status, report);
      return report;
    }

    for (const { rule } of targets) {
      const cursor = await nextSearch(rule);
      const categoryReport = {
        category: rule.category,
        term: cursor.term,
        page: cursor.page,
        fetched: 0,
        queued: 0,
        reason: undefined as string | undefined,
      };

      try {
        const params = new URLSearchParams({
          page: String(cursor.page),
          size: String(expansionConfig.searchResultsPerCategory),
          keyWord: cursor.term,
          orderBy: "4",
          sort: "desc",
          startSellPrice: String(automationConfig.minimumSupplierPriceUsd),
          endSellPrice: String(automationConfig.maximumSupplierPriceUsd),
          startWarehouseInventory: String(expansionConfig.minimumInventory),
          verifiedWarehouse: "1",
          features: "enable_category",
        });
        const data = await cjRequest<CJSearchResponse>(
          `/v1/product/listV2?${params.toString()}`,
        );
        report.searches += 1;

        const normalized = normalizeSearchProducts(
          data,
          rule,
          cursor.term,
          automationConfig,
          expansionConfig,
        );
        report.fetched += normalized.fetched;
        report.eligible += normalized.candidates.length;
        report.rejected += normalized.rejected;
        categoryReport.fetched = normalized.fetched;

        for (const candidate of normalized.candidates) {
          const duplicate = await sql`
            SELECT 1
            FROM products
            WHERE (
              supplier_platform = 'cj'
              AND supplier_external_product_id = ${candidate.pid}
            )
            OR (
              supplier_platform IS NOT NULL
              AND supplier_platform <> ''
              AND LOWER(name) = LOWER(${candidate.name})
            )
            LIMIT 1
          `;

          if (duplicate.length > 0) {
            report.duplicates += 1;
            continue;
          }

          const queueDuplicate = await sql`
            SELECT 1
            FROM catalogue_import_queue
            WHERE name_fingerprint = ${candidate.fingerprint}
              AND status NOT IN ('failed', 'rejected')
            LIMIT 1
          `;

          if (queueDuplicate.length > 0) {
            report.duplicates += 1;
            continue;
          }

          const queued = await sql`
            INSERT INTO catalogue_import_queue (
              supplier_platform,
              supplier_external_product_id,
              product_name,
              name_fingerprint,
              image_url,
              category_name,
              source_category,
              source_search_term,
              supplier_price_usd,
              inventory,
              score,
              status,
              available_at,
              created_at,
              updated_at
            )
            VALUES (
              'cj',
              ${candidate.pid},
              ${candidate.name},
              ${candidate.fingerprint},
              ${candidate.image},
              ${candidate.category},
              ${candidate.sourceCategory},
              ${candidate.searchTerm},
              ${candidate.priceUsd},
              ${candidate.inventory},
              ${candidate.score},
              'queued',
              NOW(),
              NOW(),
              NOW()
            )
            ON CONFLICT (supplier_platform, supplier_external_product_id)
            DO NOTHING
            RETURNING id
          `;

          if (queued.length > 0) {
            report.queued += 1;
            categoryReport.queued += 1;
          } else {
            report.duplicates += 1;
          }
        }
      } catch (error) {
        if (isCJThrottleError(error)) {
          report.throttled += 1;
          categoryReport.reason =
            "CJ throttled this search. It will continue during the next safe run.";
        } else {
          report.failed += 1;
          categoryReport.reason =
            error instanceof Error ? error.message : "CJ search failed.";
        }
      }

      report.categories.push(categoryReport);
      await sleep(1800);
    }

    report.status =
      report.failed > 0 || report.throttled > 0 ? "partial" : "success";
    report.message =
      report.queued > 0
        ? `${report.queued} quality CJ candidates added to the safe import queue.`
        : "No new candidates were queued during this discovery cycle.";
    await finishRun(runId, report.status, report);
    return report;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Catalogue discovery failed.";
    report.status = "failed";
    report.message = message;
    report.failed += 1;
    await finishRun(runId, report.status, report, message);
    return report;
  }
}

function retryDelayMinutes(attempt: number) {
  return Math.min(360, Math.max(2, 2 ** Math.max(1, attempt)));
}

async function claimQueue(batchSize: number, lockToken: string) {
  const sql = catalogSql();
  return sql`
    WITH selected AS (
      SELECT id
      FROM catalogue_import_queue
      WHERE status = 'queued'
        AND available_at <= NOW()
      ORDER BY score DESC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    )
    UPDATE catalogue_import_queue AS queue
    SET
      status = 'processing',
      locked_at = NOW(),
      locked_by = ${lockToken},
      attempts = queue.attempts + 1,
      updated_at = NOW()
    FROM selected
    WHERE queue.id = selected.id
    RETURNING
      queue.id,
      queue.supplier_external_product_id AS pid,
      queue.product_name AS name,
      queue.category_name AS category,
      queue.source_search_term AS "searchTerm",
      queue.inventory,
      queue.score,
      queue.attempts
  `;
}

export async function processCatalogueQueue(input?: {
  trigger?: "manual" | "cron";
  force?: boolean;
}): Promise<ProcessingReport> {
  await ensureCatalogueExpansionSchema();
  const trigger = input?.trigger || "manual";
  const expansionConfig = await getCatalogueExpansionSettings();
  const baseAutomationConfig = await getAutomationSettings();
  const runId = await startRun("process", trigger);
  const report: ProcessingReport = {
    runId,
    status: "success",
    message: "Safe import queue completed.",
    claimed: 0,
    processed: 0,
    published: 0,
    drafts: 0,
    skipped: 0,
    retried: 0,
    failed: 0,
    products: [],
  };

  try {
    if (
      (!expansionConfig.enabled || expansionConfig.paused) &&
      !input?.force
    ) {
      report.status = "skipped";
      report.message = "Catalogue expansion is paused or disabled.";
      await finishRun(runId, report.status, report);
      return report;
    }

    const sql = catalogSql();
    const totals = await sql`
      SELECT COUNT(*)::int AS count
      FROM products
      WHERE supplier_platform IS NOT NULL
        AND supplier_platform <> ''
    `;
    if (Number(totals[0]?.count || 0) >= expansionConfig.targetTotal) {
      report.status = "skipped";
      report.message = `Catalogue target of ${expansionConfig.targetTotal} real products has been reached.`;
      await finishRun(runId, report.status, report);
      return report;
    }

    const lockToken = randomUUID();
    const claimed = await claimQueue(
      expansionConfig.processBatchSize,
      lockToken,
    );
    report.claimed = claimed.length;

    if (claimed.length === 0) {
      report.status = "skipped";
      report.message = "The safe import queue is empty. Run discovery first.";
      await finishRun(runId, report.status, report);
      return report;
    }

    const bulkAutomationConfig = sanitizeAutomationConfig({
      ...baseAutomationConfig,
      autoPublish: expansionConfig.autoPublish,
      minimumInventory: expansionConfig.minimumInventory,
      maximumExactFreightMarkets:
        expansionConfig.exactFreightMarketsPerImport,
      productsPerRun: expansionConfig.processBatchSize,
    });

    for (const item of claimed) {
      const pid = String(item.pid || "");
      const name = String(item.name || "CJ product");
      const category = String(item.category || "General");
      const attempts = Number(item.attempts || 1);

      try {
        const imported = await importCJProduct({
          pid,
          inventoryHint: Number(item.inventory || 0),
          categoryName: category,
          source: "autopilot",
          runId,
          candidateScore: Number(item.score || 0),
          sourceSearchTerm: String(item.searchTerm || "bulk catalogue"),
          autoPublish: expansionConfig.autoPublish,
          minimumInventory: expansionConfig.minimumInventory,
          minimumImages: expansionConfig.minimumImages,
          automationConfig: bulkAutomationConfig,
          markupPercent: 30,
          marginPercent: 30,
        });

        const nextStatus: CatalogueQueueStatus = imported.published
          ? "published"
          : "draft";
        await sql`
          UPDATE catalogue_import_queue
          SET
            status = ${nextStatus},
            product_id = ${imported.id},
            imported_status = ${imported.status},
            locked_at = NULL,
            locked_by = NULL,
            last_error = ${imported.warning || null},
            updated_at = NOW()
          WHERE id = ${String(item.id)}
            AND locked_by = ${lockToken}
        `;

        report.processed += 1;
        if (imported.published) report.published += 1;
        else report.drafts += 1;
        report.products.push({
          pid,
          name: imported.name,
          category: imported.categoryName,
          status: nextStatus,
          reason: imported.warning || undefined,
          productId: imported.id,
        });
      } catch (error) {
        if (error instanceof CJProductAlreadyImportedError) {
          await sql`
            UPDATE catalogue_import_queue
            SET
              status = 'skipped',
              product_id = ${error.existingProductId || null},
              locked_at = NULL,
              locked_by = NULL,
              last_error = ${error.message},
              updated_at = NOW()
            WHERE id = ${String(item.id)}
              AND locked_by = ${lockToken}
          `;
          report.skipped += 1;
          report.products.push({
            pid,
            name,
            category,
            status: "skipped",
            reason: error.message,
            productId: error.existingProductId,
          });
        } else {
          const retryable =
            isCJThrottleError(error) ||
            (error instanceof CJRequestError && error.retryable);
          const canRetry = retryable && attempts < expansionConfig.maximumAttempts;
          const message =
            error instanceof Error ? error.message : "CJ import failed.";

          if (canRetry) {
            const minutes = retryDelayMinutes(attempts);
            await sql`
              UPDATE catalogue_import_queue
              SET
                status = 'queued',
                available_at = NOW() + (${minutes} * INTERVAL '1 minute'),
                locked_at = NULL,
                locked_by = NULL,
                last_error = ${message},
                updated_at = NOW()
              WHERE id = ${String(item.id)}
                AND locked_by = ${lockToken}
            `;
            report.retried += 1;
            report.products.push({
              pid,
              name,
              category,
              status: "retry queued",
              reason: `${message} Retrying after ${minutes} minutes.`,
            });
          } else {
            await sql`
              UPDATE catalogue_import_queue
              SET
                status = 'failed',
                locked_at = NULL,
                locked_by = NULL,
                last_error = ${message},
                updated_at = NOW()
              WHERE id = ${String(item.id)}
                AND locked_by = ${lockToken}
            `;
            report.failed += 1;
            report.products.push({
              pid,
              name,
              category,
              status: "failed",
              reason: message,
            });
          }
        }
      }

      await sleep(expansionConfig.delayBetweenProductsMs);
    }

    report.status =
      report.failed > 0 || report.retried > 0 ? "partial" : "success";
    report.message =
      report.processed > 0
        ? `${report.processed} products imported safely: ${report.published} published and ${report.drafts} retained as drafts.`
        : report.retried > 0
          ? `${report.retried} throttled products were returned to the queue for automatic retry.`
          : "No products were imported in this cycle.";
    await finishRun(runId, report.status, report);
    return report;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Catalogue processing failed.";
    report.status = "failed";
    report.message = message;
    report.failed += 1;
    await finishRun(runId, report.status, report, message);
    return report;
  }
}

export async function runDailyCatalogueExpansion() {
  await ensureCatalogueExpansionSchema();
  const config = await getCatalogueExpansionSettings();
  if (!config.enabled || config.paused) {
    return {
      discovery: null,
      processing: null,
      message: "Catalogue expansion is paused or disabled.",
    };
  }

  const sql = catalogSql();
  const queueRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM catalogue_import_queue
    WHERE status = 'queued'
      AND available_at <= NOW()
  `;
  const queueCount = Number(queueRows[0]?.count || 0);
  const discovery =
    queueCount < config.queueRefillThreshold
      ? await discoverCatalogueCandidates({ trigger: "cron" })
      : null;
  const processing = await processCatalogueQueue({ trigger: "cron" });

  return {
    discovery,
    processing,
    message: processing.message,
  };
}

export async function cleanTrialProducts(input?: {
  trigger?: "manual" | "installer";
}) {
  await ensureCatalogueExpansionSchema();
  const sql = catalogSql();
  const runId = await startRun("cleanup", input?.trigger || "manual");

  const candidates = await sql`
    SELECT id, name, slug, status::text AS status
    FROM products
    WHERE (
      slug = ANY(${TRIAL_SLUGS}::text[])
      OR name = ANY(${TRIAL_NAMES}::text[])
    )
      AND COALESCE(supplier_platform, '') = ''
      AND COALESCE(supplier_external_product_id, '') = ''
    ORDER BY name
  `;

  const report = {
    runId,
    candidates: candidates.length,
    deleted: 0,
    archived: 0,
    names: [] as string[],
  };

  try {
    for (const product of candidates) {
      const id = String(product.id);
      const history = await sql`
        SELECT COUNT(*)::int AS count
        FROM order_items
        WHERE product_id = ${id}
      `;

      if (Number(history[0]?.count || 0) > 0) {
        await sql`
          UPDATE products
          SET
            status = 'archived',
            supplier_sync_enabled = false,
            updated_at = NOW()
          WHERE id = ${id}
        `;
        report.archived += 1;
      } else {
        await sql.transaction([
          sql`DELETE FROM product_market_prices WHERE product_id = ${id}`,
          sql`DELETE FROM product_images WHERE product_id = ${id}`,
          sql`DELETE FROM product_variants WHERE product_id = ${id}`,
          sql`DELETE FROM products WHERE id = ${id}`,
        ]);
        report.deleted += 1;
      }
      report.names.push(String(product.name));
    }

    await finishRun(runId, "success", report);
    return report;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Trial-product cleanup failed.";
    await finishRun(runId, "failed", report, message);
    throw error;
  }
}

export async function setCatalogueExpansionPaused(paused: boolean) {
  const current = await getCatalogueExpansionSettings();
  return saveCatalogueExpansionSettings({ ...current, paused });
}

export async function retryFailedQueueItems() {
  await ensureCatalogueExpansionSchema();
  const config = await getCatalogueExpansionSettings();
  const sql = catalogSql();
  const rows = await sql`
    UPDATE catalogue_import_queue
    SET
      status = 'queued',
      available_at = NOW(),
      locked_at = NULL,
      locked_by = NULL,
      updated_at = NOW()
    WHERE status = 'failed'
      AND attempts < ${config.maximumAttempts}
    RETURNING id
  `;
  return { reset: rows.length };
}

export async function getCatalogueExpansionDashboard(): Promise<CatalogueExpansionDashboard> {
  await ensureCatalogueExpansionSchema();
  const config = await getCatalogueExpansionSettings();
  const sql = catalogSql();

  const [productRows, queueRows, queueList, runRows, countMap] =
    await Promise.all([
      sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (
            WHERE supplier_platform IS NOT NULL
              AND supplier_platform <> ''
          )::int AS real,
          COUNT(*) FILTER (WHERE status::text = 'active')::int AS active,
          COUNT(*) FILTER (WHERE status::text = 'draft')::int AS drafts,
          COUNT(*) FILTER (
            WHERE (
              slug = ANY(${TRIAL_SLUGS}::text[])
              OR name = ANY(${TRIAL_NAMES}::text[])
            )
              AND COALESCE(supplier_platform, '') = ''
              AND COALESCE(supplier_external_product_id, '') = ''
          )::int AS "trialCandidates"
        FROM products
      `,
      sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'queued')::int AS queued,
          COUNT(*) FILTER (WHERE status = 'processing')::int AS processing,
          COUNT(*) FILTER (WHERE status = 'published')::int AS published,
          COUNT(*) FILTER (WHERE status = 'draft')::int AS drafts,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
          COUNT(*) FILTER (
            WHERE status IN ('published', 'draft')
              AND updated_at >= CURRENT_DATE
          )::int AS "importedToday"
        FROM catalogue_import_queue
      `,
      sql`
        SELECT
          id,
          supplier_external_product_id AS pid,
          product_name AS name,
          category_name AS category,
          score,
          inventory,
          supplier_price_usd::text AS "priceUsd",
          status,
          attempts,
          last_error AS reason,
          product_id AS "productId",
          updated_at AS "updatedAt"
        FROM catalogue_import_queue
        ORDER BY
          CASE status
            WHEN 'processing' THEN 0
            WHEN 'queued' THEN 1
            WHEN 'failed' THEN 2
            ELSE 3
          END,
          score DESC,
          updated_at DESC
        LIMIT 40
      `,
      sql`
        SELECT
          id,
          action,
          status,
          report,
          error,
          started_at AS "startedAt",
          finished_at AS "finishedAt"
        FROM catalogue_expansion_runs
        ORDER BY started_at DESC
        LIMIT 12
      `,
      categoryCounts(),
    ]);

  const product = productRows[0] || {};
  const queue = queueRows[0] || {};
  const realProducts = Number(product.real || 0);

  const categoryProgress = config.targets.map((target) => {
    const counts = countMap.get(target.category.toLowerCase()) || {
      current: 0,
      active: 0,
      drafts: 0,
    };
    const queued = queueList.filter(
      (item: Record<string, unknown>) =>
        String(item.category || "").toLowerCase() ===
          target.category.toLowerCase() &&
        ["queued", "processing"].includes(String(item.status)),
    ).length;
    return {
      key: target.key,
      category: target.category,
      target: target.target,
      current: counts.current,
      active: counts.active,
      drafts: counts.drafts,
      queued,
      remaining: Math.max(0, target.target - counts.current),
    };
  });

  return {
    config,
    stats: {
      totalProducts: Number(product.total || 0),
      realSupplierProducts: realProducts,
      activeProducts: Number(product.active || 0),
      draftProducts: Number(product.drafts || 0),
      trialCandidates: Number(product.trialCandidates || 0),
      queued: Number(queue.queued || 0),
      processing: Number(queue.processing || 0),
      published: Number(queue.published || 0),
      retainedDrafts: Number(queue.drafts || 0),
      rejected: Number(queue.rejected || 0),
      failed: Number(queue.failed || 0),
      importedToday: Number(queue.importedToday || 0),
      targetTotal: config.targetTotal,
      completionPercent: Math.min(
        100,
        Math.round((realProducts / Math.max(1, config.targetTotal)) * 100),
      ),
    },
    categoryProgress,
    queue: queueList.map((item: Record<string, unknown>) => ({
      id: String(item.id),
      pid: String(item.pid || ""),
      name: String(item.name || ""),
      category: String(item.category || "General"),
      score: Number(item.score || 0),
      inventory: Number(item.inventory || 0),
      priceUsd: Number(item.priceUsd || 0),
      status: String(item.status || "queued"),
      attempts: Number(item.attempts || 0),
      reason: item.reason ? String(item.reason) : null,
      productId: item.productId ? String(item.productId) : null,
      updatedAt: String(item.updatedAt),
    })),
    runs: runRows.map((run: Record<string, unknown>) => ({
      id: String(run.id),
      action: String(run.action || "unknown"),
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
