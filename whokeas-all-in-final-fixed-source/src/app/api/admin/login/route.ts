import { NextResponse } from "next/server";

import {
  ADMIN_COOKIE_NAME,
  getAdminCookieValue,
  verifyAdminSecret,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  try {
    if (!process.env.ADMIN_SECRET) {
      return NextResponse.json(
        { ok: false, error: "ADMIN_SECRET is not configured." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as { secret?: string };
    const secret = typeof body.secret === "string" ? body.secret : "";

    if (!verifyAdminSecret(secret)) {
      return NextResponse.json(
        { ok: false, error: "Invalid admin secret." },
        { status: 401 },
      );
    }

    const token = getAdminCookieValue();

    if (!token) {
      throw new Error("Could not create admin session.");
    }

    const response = NextResponse.json({ ok: true });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Login failed.",
      },
      { status: 500 },
    );
  }
}