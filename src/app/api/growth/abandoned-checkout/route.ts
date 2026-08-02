export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  saveAbandonedCheckout,
} from "@/lib/growth-revenue";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      countryCode?: string;
      currency?: string;
      estimatedTotal?: number;
      promotionCode?: string;
      cart?: unknown;
    };

    const hasContact =
      String(body.customerEmail || "").trim() ||
      String(body.customerPhone || "").trim();

    if (!hasContact) {
      return NextResponse.json({
        ok: true,
        token: null,
      });
    }

    const token = await saveAbandonedCheckout(body);

    return NextResponse.json({
      ok: true,
      token,
    });
  }
  catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not save checkout recovery.",
      },
      { status: 500 },
    );
  }
}
