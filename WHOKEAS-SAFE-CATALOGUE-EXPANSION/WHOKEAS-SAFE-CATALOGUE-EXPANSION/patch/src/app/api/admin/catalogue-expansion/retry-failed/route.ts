import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { retryFailedQueueItems } from "@/lib/catalogue-expansion";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const report = await retryFailedQueueItems();
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not retry failed products.",
      },
      { status: 500 },
    );
  }
}
