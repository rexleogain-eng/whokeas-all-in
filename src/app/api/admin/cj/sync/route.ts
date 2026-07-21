import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { syncCJProducts } from "@/lib/cj-sync";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const report = await syncCJProducts(10);
    return NextResponse.json({ ok: true, ...report });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "CJ synchronization failed.",
      },
      { status: 500 },
    );
  }
}