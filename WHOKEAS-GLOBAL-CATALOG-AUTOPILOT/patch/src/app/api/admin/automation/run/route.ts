import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { runCatalogAutomation } from "@/lib/catalog-automation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const report = await runCatalogAutomation({
      trigger: "manual",
      force: true,
    });

    return NextResponse.json({
      ok: report.status !== "failed",
      report,
    }, { status: report.status === "failed" ? 500 : 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Catalogue automation failed.",
      },
      { status: 500 },
    );
  }
}
