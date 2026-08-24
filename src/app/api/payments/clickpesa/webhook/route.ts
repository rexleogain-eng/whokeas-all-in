import { NextResponse } from "next/server";

import {
  validateClickPesaChecksum,
} from "@/lib/clickpesa";
import {
  reconcileClickPesaPayment,
} from "@/lib/clickpesa-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanReference(value: unknown) {
  return typeof value === "string"
    ? value.trim().slice(0, 80)
    : "";
}

function sleep(milliseconds: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, milliseconds),
  );
}

async function reconcileWithShortRetry(
  orderReference: string,
) {
  let result = await reconcileClickPesaPayment({
    orderReference,
  });

  for (const wait of [250, 750]) {
    if (result.state !== "pending") break;
    await sleep(wait);
    result = await reconcileClickPesaPayment({
      orderReference,
    });
  }

  return result;
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!payload) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid ClickPesa webhook payload.",
      },
      { status: 400 },
    );
  }

  if (!validateClickPesaChecksum(payload)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid ClickPesa webhook checksum.",
      },
      { status: 401 },
    );
  }

  const data =
    payload.data &&
    typeof payload.data === "object" &&
    !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>)
      : payload;

  const orderReference = cleanReference(
    data.orderReference || payload.orderReference,
  );

  if (
    !orderReference ||
    !/^[A-Za-z0-9]+$/.test(orderReference)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "ClickPesa order reference is missing.",
      },
      { status: 400 },
    );
  }

  try {
    // The webhook is never trusted as the payment authority by itself.
    // WHOKEAS queries ClickPesa server-to-server and validates reference,
    // currency and amount before changing an order to paid.
    const result = await reconcileWithShortRetry(
      orderReference,
    );

    return NextResponse.json({
      ok: true,
      state: result.state,
      orderReference,
    });
  }
  catch (error) {
    console.error(
      "ClickPesa webhook reconciliation failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Could not reconcile ClickPesa payment.",
      },
      { status: 500 },
    );
  }
}
