export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  clearCustomerSessionCookie,
  destroyCurrentCustomerSession,
} from "@/lib/customer-auth";

export async function POST() {
  try {
    await destroyCurrentCustomerSession();

    const response = NextResponse.json({
      ok: true,
    });

    clearCustomerSessionCookie(response);

    return response;
  }
  catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not sign out.",
      },
      { status: 500 },
    );
  }
}