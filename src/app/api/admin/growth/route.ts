export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";

import {
  createGrowthAffiliate,
  createGrowthCoupon,
  getGrowthDashboard,
  markGrowthCommissionPaid,
  toggleGrowthAffiliate,
  toggleGrowthCoupon,
  updateAbandonedCheckoutStatus,
} from "@/lib/growth-revenue";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    return NextResponse.json({
      ok: true,
      dashboard: await getGrowthDashboard(),
    });
  }
  catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not load Growth & Revenue.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as {
      action?: string;
      [key: string]: unknown;
    };

    const action = String(body.action || "");

    if (action === "create_coupon") {
      await createGrowthCoupon({
        code: String(body.code || ""),
        name: String(body.name || ""),
        discountType: String(
          body.discountType || "percent",
        ),
        discountValue: Number(
          body.discountValue || 0,
        ),
        maximumDiscount:
          body.maximumDiscount === null ||
          body.maximumDiscount === undefined ||
          body.maximumDiscount === ""
            ? null
            : Number(body.maximumDiscount),
        minimumOrder: Number(
          body.minimumOrder || 0,
        ),
        currency: String(body.currency || "TZS"),
        usageLimit:
          body.usageLimit === null ||
          body.usageLimit === undefined ||
          body.usageLimit === ""
            ? null
            : Number(body.usageLimit),
        perCustomerLimit: Number(
          body.perCustomerLimit || 1,
        ),
        startsAt:
          body.startsAt
            ? String(body.startsAt)
            : null,
        expiresAt:
          body.expiresAt
            ? String(body.expiresAt)
            : null,
      });
    }
    else if (action === "toggle_coupon") {
      await toggleGrowthCoupon(
        String(body.couponId || ""),
      );
    }
    else if (action === "create_affiliate") {
      const code = await createGrowthAffiliate({
        name: String(body.name || ""),
        code: String(body.code || ""),
        email: String(body.email || ""),
        phone: String(body.phone || ""),
        commissionRate: Number(
          body.commissionRate || 5,
        ),
        notes: String(body.notes || ""),
      });

      return NextResponse.json({
        ok: true,
        code,
      });
    }
    else if (action === "toggle_affiliate") {
      await toggleGrowthAffiliate(
        String(body.affiliateId || ""),
      );
    }
    else if (action === "pay_commission") {
      await markGrowthCommissionPaid(
        String(body.commissionId || ""),
      );
    }
    else if (action === "abandoned_status") {
      const status =
        body.status === "closed"
          ? "closed"
          : "contacted";

      await updateAbandonedCheckoutStatus(
        String(body.checkoutId || ""),
        status,
      );
    }
    else {
      return NextResponse.json(
        {
          ok: false,
          error: "Unknown Growth & Revenue action.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
    });
  }
  catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Growth & Revenue action failed.",
      },
      { status: 500 },
    );
  }
}
