import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { cleanTrialProducts } from "@/lib/catalogue-expansion";

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
    const report = await cleanTrialProducts({ trigger: "manual" });
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Trial-product cleanup failed.",
      },
      { status: 500 },
    );
  }
}
