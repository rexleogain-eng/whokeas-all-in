export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  CheckoutQuoteError,
  quoteCheckout,
} from "@/lib/checkout-pricing";

import {
  getCustomerSession,
} from "@/lib/customer-auth";

import {
  calculateGrowthAdjustments,
  GrowthPricingError,
} from "@/lib/growth-revenue";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      countryCode?: string;
      customerEmail?: string;
      promotionCode?: string;
      attributionCode?: string;
      storeCreditRequested?: number;
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

    const session = await getCustomerSession();

    const growth = await calculateGrowthAdjustments({
      subtotal: quote.subtotal,
      totalBeforeGrowth: quote.total,
      supplierCostTotal:
        quote.supplierCostTotal,
      currency: quote.currency,
      promotionCode: body.promotionCode,
      attributionCode: body.attributionCode,
      customerId:
        session?.customer.id || null,
      customerEmail:
        session?.customer.email ||
        String(body.customerEmail || ""),
      storeCreditRequested:
        session
          ? Number(
              body.storeCreditRequested || 0,
            )
          : 0,
    });

    return NextResponse.json({
      ok: true,
      quote: {
        ...quote,
        couponDiscount:
          growth.couponDiscount,
        referralDiscount:
          growth.referralDiscount,
        storeCreditUsed:
          growth.storeCreditUsed,
        discountAmount:
          growth.discountAmount,
        total: growth.total,
        couponCode:
          growth.couponCode,
        affiliateCode:
          growth.affiliateCode,
        referralCode:
          growth.referralCode,
      },
    });
  }
  catch (error) {
    const status =
      error instanceof CheckoutQuoteError ||
      error instanceof GrowthPricingError
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
