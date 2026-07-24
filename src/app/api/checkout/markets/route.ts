export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  getCheckoutMarkets,
} from "@/lib/checkout-pricing";

export async function GET() {
  try {
    const markets =
      await getCheckoutMarkets();

    return NextResponse.json({
      ok: true,
      markets,
    });
  }
  catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not load delivery countries.",
      },
      { status: 500 },
    );
  }
}