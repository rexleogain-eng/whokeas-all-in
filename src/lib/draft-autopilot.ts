import { randomUUID } from "node:crypto";

import { catalogSql, ensureCatalogSchema } from "@/lib/catalog-schema";
import { ensureGlobalMarketSchema } from "@/lib/global-markets";

const RULES = {
  minimumInventory: 10,
  minimumImages: 2,
  minimumMarkets: 1,
  minimumMarginPercent: 30,
  maximumAttempts: 3,
  retryHours: 6,
  productsPerRun: 10,
} as const;

export type DraftAutopilotReport = {
  processed: number;
  published: number;
  retrying: number;
  archived: number;
  message: string;
  products: Array<{
    productId: string;
    name: string;
    status: "published" | "retry" | "archived";
    reason: string;
  }>;
};

type ClaimedDraft = {
  queueId: string;
  productId: string;
  attempts: number;
  lockToken: string;
};

type ProductMetrics = {
  productId: string;
  name: string;
  supplierPid: string | null;
  images: number;
  variants: number;
  stock: number;
  qualifiedMarkets: number;
};

export async function ensureDraftAutopilotSchema() {
  await ensureCatalogSchema();
  await ensureGlobalMarketSchema();

  const sql = catalogSql();

  await sql`
    CREATE TABLE IF NOT EXISTS draft_autopilot_runs (
      id TEXT PRIMARY KEY,
      processed INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 0,
      retrying INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      report JSONB NOT NULL DEFAULT '{}'::jsonb,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    )
  `;
}

async function claimDraft(): Promise<ClaimedDraft | null> {
  const sql = catalogSql();
  const lockToken = randomUUID();

  await sql`
    UPDATE catalogue_import_queue
    SET
      status = 'draft',
      available_at = NOW(),
      locked_at = NULL,
      locked_by = NULL,
      last_error = COALESCE(
        last_error,
        'Recovered after an interrupted Draft Autopilot operation.'
      ),
      updated_at = NOW()
    WHERE status = 'processing'
      AND locked_at < NOW() - INTERVAL '2 minutes'
  `;

  const rows = await sql`
    UPDATE catalogue_import_queue
    SET
      status = 'processing',
      attempts = attempts + 1,
      locked_at = NOW(),
      locked_by = ${lockToken},
      updated_at = NOW()
    WHERE id = (
      SELECT queue.id
      FROM catalogue_import_queue queue
      INNER JOIN products product
        ON product.id::text = queue.product_id::text
      WHERE queue.status = 'draft'
        AND product.status::text = 'draft'
        AND COALESCE(queue.available_at, NOW()) <= NOW()
      ORDER BY
        queue.attempts ASC,
        queue.updated_at ASC
      FOR UPDATE OF queue SKIP LOCKED
      LIMIT 1
    )
    RETURNING
      id::text AS "queueId",
      product_id::text AS "productId",
      attempts
  `;

  if (!rows[0]?.queueId || !rows[0]?.productId) {
    return null;
  }

  return {
    queueId: String(rows[0].queueId),
    productId: String(rows[0].productId),
    attempts: Number(rows[0].attempts || 1),
    lockToken,
  };
}

async function loadMetrics(
  productId: string,
): Promise<ProductMetrics | null> {
  const sql = catalogSql();

  const rows = await sql`
    SELECT
      product.id::text AS "productId",
      product.name,
      product.supplier_external_product_id AS "supplierPid",

      COALESCE(images.count, 0)::int AS images,

      COALESCE(variants.count, 0)::int AS variants,

      COALESCE(variants.stock, 0)::int AS stock,

      COALESCE(markets.qualified, 0)::int AS "qualifiedMarkets"

    FROM products product

    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS count
      FROM product_images image
      WHERE image.product_id::text = product.id::text
    ) images ON TRUE

    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(variant.is_active, TRUE) = TRUE
        )::int AS count,

        COALESCE(
          SUM(
            CASE
              WHEN COALESCE(variant.is_active, TRUE) = TRUE
              THEN COALESCE(variant.stock_quantity, 0)
              ELSE 0
            END
          ),
          0
        )::int AS stock

      FROM product_variants variant
      WHERE variant.product_id::text = product.id::text
    ) variants ON TRUE

    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(market.available, FALSE) = TRUE

            AND COALESCE(
              market.selling_price_local,
              0
            ) > 0

            AND (
              COALESCE(
                market.estimated_profit_local,
                market.selling_price_local -
                  market.landed_cost_local
              )
              /
              NULLIF(market.selling_price_local, 0)
            ) * 100 >= ${RULES.minimumMarginPercent}
        )::int AS qualified

      FROM product_market_prices market
      WHERE market.product_id::text = product.id::text
    ) markets ON TRUE

    WHERE product.id::text = ${productId}
      AND product.status::text = 'draft'

    LIMIT 1
  `;

  if (!rows[0]) {
    return null;
  }

  return {
    productId: String(rows[0].productId),
    name: String(rows[0].name || "Draft product"),
    supplierPid: rows[0].supplierPid
      ? String(rows[0].supplierPid)
      : null,
    images: Number(rows[0].images || 0),
    variants: Number(rows[0].variants || 0),
    stock: Number(rows[0].stock || 0),
    qualifiedMarkets: Number(
      rows[0].qualifiedMarkets || 0
    ),
  };
}

function failureReasons(metrics: ProductMetrics) {
  const reasons: string[] = [];

  if (!metrics.supplierPid) {
    reasons.push("Supplier product ID is missing.");
  }

  if (metrics.images < RULES.minimumImages) {
    reasons.push(
      `${metrics.images}/${RULES.minimumImages} required images.`
    );
  }

  if (metrics.variants < 1) {
    reasons.push("No active variant.");
  }

  if (metrics.stock < RULES.minimumInventory) {
    reasons.push(
      `Inventory ${metrics.stock} is below ${RULES.minimumInventory}.`
    );
  }

  if (metrics.qualifiedMarkets < RULES.minimumMarkets) {
    reasons.push(
      `${metrics.qualifiedMarkets}/${RULES.minimumMarkets} international markets pass the fixed ${RULES.minimumMarginPercent}% margin gate.`
    );
  }

  return reasons;
}

async function publishDraft(
  claim: ClaimedDraft,
  metrics: ProductMetrics,
) {
  const sql = catalogSql();
  const reason =
    "Images, variants, stock and at least one international 30% margin offer passed.";

  await sql.transaction([
    sql`
      UPDATE products
      SET
        status = 'active',
        supplier_sync_enabled = TRUE,
        updated_at = NOW()
      WHERE id::text = ${claim.productId}
        AND status::text = 'draft'
    `,

    sql`
      UPDATE catalogue_import_queue
      SET
        status = 'published',
        locked_at = NULL,
        locked_by = NULL,
        last_error = NULL,
        updated_at = NOW()
      WHERE id::text = ${claim.queueId}
        AND locked_by = ${claim.lockToken}
    `,
  ]);

  return {
    productId: claim.productId,
    name: metrics.name,
    status: "published" as const,
    reason,
  };
}

async function retryDraft(
  claim: ClaimedDraft,
  metrics: ProductMetrics,
  reason: string,
) {
  const sql = catalogSql();

  await sql`
    UPDATE catalogue_import_queue
    SET
      status = 'draft',
      available_at =
        NOW() + (${RULES.retryHours} * INTERVAL '1 hour'),
      locked_at = NULL,
      locked_by = NULL,
      last_error = ${reason},
      updated_at = NOW()
    WHERE id::text = ${claim.queueId}
      AND locked_by = ${claim.lockToken}
  `;

  return {
    productId: claim.productId,
    name: metrics.name,
    status: "retry" as const,
    reason,
  };
}

async function archiveDraft(
  claim: ClaimedDraft,
  metrics: ProductMetrics,
  reason: string,
) {
  const sql = catalogSql();
  const finalReason =
    `${reason} Maximum automatic review attempts reached.`;

  await sql.transaction([
    sql`
      UPDATE products
      SET
        status = 'archived',
        supplier_sync_enabled = FALSE,
        updated_at = NOW()
      WHERE id::text = ${claim.productId}
        AND status::text = 'draft'
    `,

    sql`
      UPDATE catalogue_import_queue
      SET
        status = 'rejected',
        locked_at = NULL,
        locked_by = NULL,
        last_error = ${finalReason},
        updated_at = NOW()
      WHERE id::text = ${claim.queueId}
        AND locked_by = ${claim.lockToken}
    `,
  ]);

  return {
    productId: claim.productId,
    name: metrics.name,
    status: "archived" as const,
    reason: finalReason,
  };
}

export async function processDraftAutopilot(
  requestedLimit = RULES.productsPerRun,
): Promise<DraftAutopilotReport> {
  await ensureDraftAutopilotSchema();

  const limit = Math.max(
    1,
    Math.min(
      20,
      Math.round(Number(requestedLimit) || RULES.productsPerRun)
    )
  );

  const sql = catalogSql();
  const runId = randomUUID();

  const report: DraftAutopilotReport = {
    processed: 0,
    published: 0,
    retrying: 0,
    archived: 0,
    message: "Draft Autopilot completed.",
    products: [],
  };

  await sql`
    INSERT INTO draft_autopilot_runs (
      id,
      started_at
    )
    VALUES (
      ${runId},
      NOW()
    )
  `;

  try {
    for (let index = 0; index < limit; index += 1) {
      const claim = await claimDraft();

      if (!claim) {
        break;
      }

      try {
        const metrics = await loadMetrics(claim.productId);

        if (!metrics) {
          await sql`
            UPDATE catalogue_import_queue
            SET
              status = 'skipped',
              locked_at = NULL,
              locked_by = NULL,
              last_error =
                'Product is no longer an eligible private draft.',
              updated_at = NOW()
            WHERE id::text = ${claim.queueId}
              AND locked_by = ${claim.lockToken}
          `;

          continue;
        }

        const reasons = failureReasons(metrics);
        let result;

        if (reasons.length === 0) {
          result = await publishDraft(claim, metrics);
          report.published += 1;
        }
        else if (claim.attempts >= RULES.maximumAttempts) {
          result = await archiveDraft(
            claim,
            metrics,
            reasons.join(" ")
          );
          report.archived += 1;
        }
        else {
          result = await retryDraft(
            claim,
            metrics,
            reasons.join(" ")
          );
          report.retrying += 1;
        }

        report.processed += 1;
        report.products.push(result);
      }
      catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Automatic draft review failed.";

        await sql`
          UPDATE catalogue_import_queue
          SET
            status = 'draft',
            available_at = NOW() + INTERVAL '1 hour',
            locked_at = NULL,
            locked_by = NULL,
            last_error = ${message},
            updated_at = NOW()
          WHERE id::text = ${claim.queueId}
            AND locked_by = ${claim.lockToken}
        `;

        report.retrying += 1;
        report.processed += 1;
      }
    }

    report.message =
      `${report.processed} drafts operated: ` +
      `${report.published} published, ` +
      `${report.retrying} scheduled for retry and ` +
      `${report.archived} archived.`;

    await sql`
      UPDATE draft_autopilot_runs
      SET
        processed = ${report.processed},
        published = ${report.published},
        retrying = ${report.retrying},
        archived = ${report.archived},
        report = ${JSON.stringify(report)}::jsonb,
        finished_at = NOW()
      WHERE id = ${runId}
    `;

    return report;
  }
  catch (error) {
    await sql`
      UPDATE draft_autopilot_runs
      SET
        report = ${JSON.stringify(report)}::jsonb,
        finished_at = NOW()
      WHERE id = ${runId}
    `;

    throw error;
  }
}