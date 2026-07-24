export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  CheckoutQuoteError,
  quoteCheckout,
} from "@/lib/checkout-pricing";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      countryCode?: string;
      items?: Array<{
        productId?: string;
        variantId?: string | null;
        quantity?: number;
      }>;
    };

    const quote = await quoteCheckout({
      countryCode: String(
        body.countryCode || "",
      ),
      items: Array.isArray(body.items)
        ? body.items
        : [],
    });

    return NextResponse.json({
      ok: true,
      quote,
    });
  }
  catch (error) {
    const status =
      error instanceof CheckoutQuoteError
        ? error.status
        : 500;

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not calculate checkout pricing.",
      },
      { status },
    );
  }
}