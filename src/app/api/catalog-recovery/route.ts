import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

import { processCatalogueQueue } from "@/lib/catalogue-expansion";
import { US_SHIPPING_MAX_DAYS } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const RECOVERY_TOKEN = "restore_5pR8uX2mN4cQ7vK9";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== RECOVERY_TOKEN) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: "Database unavailable." }, { status: 500 });
  }

  const sql = neon(process.env.DATABASE_URL);

  const restoredMarkets = await sql`
    UPDATE product_market_prices
    SET
      available = true,
      warning = NULL,
      updated_at = NOW()
    WHERE country_code = 'US'
      AND currency = 'USD'
      AND selling_price_local > 0
      AND estimated_delivery_days IS NOT NULL
      AND estimated_delivery_days <= ${US_SHIPPING_MAX_DAYS}
      AND available IS NOT TRUE
      AND warning ILIKE 'U.S. delivery must be verified at % days or less before publication.'
    RETURNING product_id
  `;

  const requeued = await sql`
    UPDATE catalogue_import_queue
    SET
      status = 'queued',
      product_id = NULL,
      imported_status = NULL,
      attempts = 0,
      available_at = NOW(),
      locked_at = NULL,
      locked_by = NULL,
      last_error = 'Requeued after WHOKEAS catalogue restoration.',
      updated_at = NOW()
    WHERE supplier_platform = 'cj'
      AND status = 'rejected'
      AND product_id IS NULL
      AND last_error ILIKE 'Removed from U.S. catalogue: delivery exceeds %'
    RETURNING id
  `;

  const processing = [];
  for (let index = 0; index < 40; index += 1) {
    const result = await processCatalogueQueue({ trigger: "manual" });
    processing.push({
      status: result.status,
      processed: result.processed,
      published: result.published,
      drafts: result.drafts,
      skipped: result.skipped,
      retried: result.retried,
      failed: result.failed,
    });

    if (result.status === "skipped" || result.failed > 0 || result.retried > 0) {
      break;
    }
    await sleep(1200);
  }

  const counts = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status::text = 'active')::int AS active,
      COUNT(*) FILTER (WHERE status::text = 'draft')::int AS draft,
      COUNT(*) FILTER (WHERE status::text = 'archived')::int AS archived
    FROM products
  `;

  const visible = await sql`
    SELECT COUNT(DISTINCT p.id)::int AS count
    FROM products p
    JOIN product_market_prices market ON market.product_id = p.id
    WHERE p.status::text = 'active'
      AND market.country_code = 'US'
      AND market.currency = 'USD'
      AND market.available = true
      AND market.selling_price_local > 0
      AND (
        market.estimated_delivery_days IS NULL
        OR market.estimated_delivery_days <= ${US_SHIPPING_MAX_DAYS}
      )
  `;

  return NextResponse.json({
    ok: true,
    restoredMarketRows: restoredMarkets.length,
    requeuedDeletedProducts: requeued.length,
    processingPasses: processing.length,
    processing,
    counts: counts[0],
    storefrontEligibleBeforeRestrictedFilter: visible[0]?.count || 0,
  });
}
