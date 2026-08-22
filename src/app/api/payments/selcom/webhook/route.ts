import { NextResponse } from "next/server";

import { reconcileSelcomPayment } from "@/lib/selcom-orders";
import { verifySelcomWebhook } from "@/lib/selcom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!payload || !verifySelcomWebhook(request.headers, payload)) {
    return NextResponse.json({ ok: false, error: "Invalid Selcom webhook signature." }, { status: 401 });
  }

  const orderNumber = String(payload.order_id || "")
    .trim()
    .toUpperCase()
    .slice(0, 40);

  if (!orderNumber) {
    return NextResponse.json({ ok: false, error: "Missing order_id." }, { status: 400 });
  }

  try {
    const result = await reconcileSelcomPayment(orderNumber);
    return NextResponse.json({ ok: true, state: result.state });
  }
  catch (error) {
    console.error("Selcom webhook reconciliation failed:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
