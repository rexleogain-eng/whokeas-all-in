import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import {
  prepareCJOrder,
  syncCJOrder,
} from "@/lib/cj-fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Context = {
  params: Promise<{ orderNumber: string }>;
};

export async function POST(request: Request, context: Context) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    const { orderNumber: rawOrderNumber } = await context.params;
    const orderNumber = decodeURIComponent(rawOrderNumber)
      .trim()
      .toUpperCase();
    const body = (await request.json()) as { action?: string };
    const action = String(body.action || "prepare");

    if (action === "prepare" || action === "retry") {
      const fulfillment = await prepareCJOrder(orderNumber);
      return NextResponse.json({ ok: true, fulfillment });
    }

    if (action === "sync") {
      const fulfillment = await syncCJOrder(orderNumber);
      return NextResponse.json({ ok: true, fulfillment });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid CJ fulfillment action." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "CJ fulfillment action failed.",
      },
      { status: 500 },
    );
  }
}
