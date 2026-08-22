import { NextResponse } from "next/server";

import {
  validFlutterwaveWebhookSignature,
} from "@/lib/flutterwave";
import { settleFlutterwavePayment } from "@/lib/flutterwave-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("flutterwave-signature");
  const legacyHash = request.headers.get("verif-hash");

  if (!validFlutterwaveWebhookSignature(rawBody, signature, legacyHash)) {
    return NextResponse.json(
      { ok: false, error: "Invalid webhook signature." },
      { status: 401 },
    );
  }

  let payload: {
    event?: string;
    type?: string;
    data?: {
      id?: string | number;
      status?: string;
      tx_ref?: string;
      reference?: string;
    };
  };

  try {
    payload = JSON.parse(rawBody);
  }
  catch {
    return NextResponse.json(
      { ok: false, error: "Invalid webhook payload." },
      { status: 400 },
    );
  }

  const event = String(payload.type || payload.event || "").toLowerCase();
  const transactionId = payload.data?.id;

  if (event !== "charge.completed" || !transactionId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    await settleFlutterwavePayment({
      transactionId,
      expectedTxRef:
        String(
          payload.data?.tx_ref ||
            payload.data?.reference ||
            "",
        ).trim() || null,
    });

    return NextResponse.json({ ok: true });
  }
  catch (error) {
    console.error("Flutterwave webhook settlement failed:", error);

    return NextResponse.json(
      { ok: false, error: "Payment verification failed." },
      { status: 500 },
    );
  }
}
