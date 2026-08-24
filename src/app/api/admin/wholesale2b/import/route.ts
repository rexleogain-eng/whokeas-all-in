import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { importWholesale2BProducts } from "@/lib/wholesale2b";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(25, Number(body?.limit || 10)));
    const report = await importWholesale2BProducts(limit);
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Wholesale2B import failed." },
      { status: 500 },
    );
  }
}
