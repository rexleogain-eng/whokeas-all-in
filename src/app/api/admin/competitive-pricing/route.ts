import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import {
  getCompetitivePricingDashboard,
  recordCompetitorPrice,
  runCompetitiveRepricing,
} from "@/lib/competitive-pricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    return NextResponse.json({
      ok: true,
      dashboard: await getCompetitivePricingDashboard(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not load competitive pricing.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "").trim().toLowerCase();

    if (action === "reprice") {
      const report = await runCompetitiveRepricing({ trigger: "manual" });
      return NextResponse.json({ ok: true, report });
    }

    if (action === "record") {
      const productId = String(body.productId || "").trim();
      const sourceName = String(body.sourceName || "").trim();
      const sourceUrl = String(body.sourceUrl || "").trim();
      const priceUsd = Number(body.priceUsd || 0);
      const shippingUsd = Number(body.shippingUsd || 0);

      if (!productId) throw new Error("Product is required.");

      const id = await recordCompetitorPrice({
        productId,
        sourceName,
        sourceUrl,
        priceUsd,
        shippingUsd,
        note: body.note ? String(body.note) : null,
      });
      const report = await runCompetitiveRepricing({
        productId,
        trigger: "benchmark",
      });

      return NextResponse.json({ ok: true, id, report }, { status: 201 });
    }

    return NextResponse.json(
      { ok: false, error: "Unknown action." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Competitive pricing action failed.",
      },
      { status: 400 },
    );
  }
}
