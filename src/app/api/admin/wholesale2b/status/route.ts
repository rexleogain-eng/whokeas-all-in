import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { getWholesale2BStatus } from "@/lib/wholesale2b";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const status = await getWholesale2BStatus();
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Wholesale2B status failed." },
      { status: 500 },
    );
  }
}
