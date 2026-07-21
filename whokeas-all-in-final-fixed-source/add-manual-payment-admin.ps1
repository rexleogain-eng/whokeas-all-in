$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json")) {
  throw "Run this inside C:\Users\Hp\Desktop\whokeas-all-in"
}

$utf8 = [System.Text.UTF8Encoding]::new($false)

$dirs = @(
  ".\src\lib",
  ".\src\components\admin",
  ".\src\app\admin\login",
  ".\src\app\admin\orders",
  ".\src\app\api\admin\login",
  ".\src\app\api\admin\logout",
  ".\src\app\api\admin\orders\[orderNumber]"
)

foreach ($dir in $dirs) {
  New-Item -ItemType Directory -Force $dir | Out-Null
}

$envPath = Join-Path (Get-Location) ".env.local"

if (-not (Test-Path $envPath)) {
  New-Item -ItemType File -Path $envPath | Out-Null
}

$envContent = [System.IO.File]::ReadAllText($envPath)

if ($envContent -notmatch '(?m)^ADMIN_SECRET=') {
  $bytes = New-Object byte[] 48
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $rng.GetBytes($bytes)
}
finally {
  $rng.Dispose()
}
  $secret = [Convert]::ToBase64String($bytes)

  [System.IO.File]::AppendAllText(
    $envPath,
    "`r`nADMIN_SECRET=`"$secret`"`r`n",
    $utf8
  )
}

$adminAuth = @'
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "wai_admin";

function getExpectedToken() {
  const secret = process.env.ADMIN_SECRET;

  if (!secret) {
    return null;
  }

  return createHash("sha256")
    .update(`whokeas-admin-v1:${secret}`)
    .digest("hex");
}

export function verifyAdminSecret(candidate: string) {
  const secret = process.env.ADMIN_SECRET;

  if (!secret || !candidate) {
    return false;
  }

  const expected = Buffer.from(secret);
  const received = Buffer.from(candidate);

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

export async function isAdmin() {
  const expected = getExpectedToken();

  if (!expected) {
    return false;
  }

  const cookieStore = await cookies();
  const current = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!current) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const currentBuffer = Buffer.from(current);

  if (expectedBuffer.length !== currentBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, currentBuffer);
}

export function getAdminCookieValue() {
  return getExpectedToken();
}
'@

$loginForm = @'
"use client";

import { FormEvent, useState } from "react";

export default function AdminLoginForm() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Login failed.");
      }

      window.location.href = "/admin/orders";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7">
      <label>
        <span className="mb-2 block text-sm font-bold">Admin secret</span>
        <input
          required
          type="password"
          autoComplete="current-password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#e49b00]"
        />
      </label>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 w-full rounded-full bg-[#ffd814] px-5 py-3 text-sm font-bold hover:bg-[#f7ca00] disabled:opacity-60"
      >
        {submitting ? "Signing in..." : "Open Admin"}
      </button>
    </form>
  );
}
'@

$orderActions = @'
"use client";

import { useState } from "react";

type Props = {
  orderNumber: string;
};

const actions = [
  { value: "mark_paid", label: "Mark Paid" },
  { value: "mark_processing", label: "Mark Processing" },
  { value: "mark_shipped", label: "Mark Shipped" },
  { value: "mark_delivered", label: "Mark Delivered" },
  { value: "cancel", label: "Cancel Order" },
] as const;

export default function OrderActions({ orderNumber }: Props) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function run(action: string) {
    setBusy(action);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderNumber)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Update failed.");
      }

      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Update failed.");
      setBusy("");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.value}
            type="button"
            disabled={Boolean(busy)}
            onClick={() => run(action.value)}
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
              action.value === "cancel"
                ? "border-red-200 text-red-700 hover:bg-red-50"
                : "border-slate-300 hover:border-slate-500 hover:bg-slate-50"
            }`}
          >
            {busy === action.value ? "Updating..." : action.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
'@

$loginPage = @'
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdmin()) {
    redirect("/admin/orders");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eaeded] p-5">
      <section className="w-full max-w-md bg-white p-8 shadow-sm">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative h-12 w-[72px]">
            <Image
              src="/brand/logo-mark.png"
              alt=""
              fill
              priority
              sizes="72px"
              className="object-contain"
            />
          </div>
          <div>
            <div className="font-black tracking-[0.12em]">WHOKEAS</div>
            <div className="text-[10px] font-black tracking-[0.3em] text-[#c58b00]">
              ADMIN
            </div>
          </div>
        </Link>

        <h1 className="mt-7 text-3xl font-black">Admin access</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Review payment references and update order progress.
        </p>

        <AdminLoginForm />
      </section>
    </main>
  );
}
'@

$ordersPage = @'
import { neon } from "@neondatabase/serverless";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import OrderActions from "@/components/admin/OrderActions";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatPrice(value: string | number) {
  return `TZS ${Number(value).toLocaleString("en-US")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-TZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(new Date(value));
}

export default async function AdminOrdersPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing");
  }

  const sql = neon(process.env.DATABASE_URL);

  const orders = await sql`
    SELECT
      o.order_number AS "orderNumber",
      o.customer_name AS "customerName",
      o.customer_phone AS "customerPhone",
      o.customer_email AS "customerEmail",
      o.status::text AS "orderStatus",
      o.total::text AS total,
      o.shipping_address AS "shippingAddress",
      o.created_at AS "createdAt",
      p.provider AS "paymentProvider",
      p.provider_reference AS "paymentReference",
      p.status::text AS "paymentStatus"
    FROM orders o
    LEFT JOIN LATERAL (
      SELECT provider, provider_reference, status
      FROM payments
      WHERE order_id = o.id
      ORDER BY created_at DESC
      LIMIT 1
    ) p ON true
    ORDER BY o.created_at DESC
    LIMIT 100
  `;

  return (
    <main className="min-h-screen bg-[#eaeded] text-[#0f1111]">
      <header className="bg-[#101820] text-white shadow-md">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-12 w-[72px]">
              <Image
                src="/brand/logo-mark.png"
                alt=""
                fill
                priority
                sizes="72px"
                className="object-contain"
              />
            </div>
            <div>
              <div className="font-black tracking-[0.12em]">WHOKEAS</div>
              <div className="text-[10px] font-black tracking-[0.3em] text-[#f3b61f]">
                ORDER ADMIN
              </div>
            </div>
          </Link>

          <form action="/api/admin/logout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-white/30 px-4 py-2 text-sm font-bold hover:border-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-7 lg:px-6">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#b36f00]">
          Manual payment verification
        </p>
        <h1 className="mt-2 text-4xl font-black">Orders</h1>

        {orders.length === 0 ? (
          <section className="mt-6 bg-white p-8 shadow-sm">
            No orders have been placed yet.
          </section>
        ) : (
          <div className="mt-6 space-y-4">
            {orders.map((order) => {
              const address = order.shippingAddress as {
                region?: string;
                district?: string;
                ward?: string;
                addressLine?: string;
              };

              return (
                <article
                  key={String(order.orderNumber)}
                  className="grid gap-5 bg-white p-5 shadow-sm lg:grid-cols-[1fr_1fr_1fr]"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-500">
                      ORDER NUMBER
                    </p>
                    <p className="mt-1 font-black">
                      {String(order.orderNumber)}
                    </p>
                    <p className="mt-3 text-sm text-slate-500">
                      {formatDate(String(order.createdAt))}
                    </p>
                    <p className="mt-3 text-2xl font-black text-[#b12704]">
                      {formatPrice(String(order.total))}
                    </p>
                    <p className="mt-3 text-sm font-bold">
                      Order: {String(order.orderStatus).replaceAll("_", " ")}
                    </p>
                  </div>

                  <div>
                    <p className="font-black">{String(order.customerName)}</p>
                    <p className="mt-2 text-sm">{String(order.customerPhone)}</p>
                    {order.customerEmail && (
                      <p className="mt-1 text-sm text-slate-600">
                        {String(order.customerEmail)}
                      </p>
                    )}

                    <p className="mt-4 text-sm leading-6 text-slate-600">
                      {address?.addressLine}
                      <br />
                      {address?.district}
                      {address?.ward ? `, ${address.ward}` : ""}
                      <br />
                      {address?.region}, Tanzania
                    </p>
                  </div>

                  <div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold text-slate-500">
                        PAYMENT METHOD
                      </p>
                      <p className="mt-1 font-black">
                        {order.paymentProvider
                          ? String(order.paymentProvider).replaceAll("_", " ")
                          : "Not recorded"}
                      </p>

                      <p className="mt-4 text-xs font-bold text-slate-500">
                        REFERENCE
                      </p>
                      <p className="mt-1 break-all font-semibold">
                        {order.paymentReference
                          ? String(order.paymentReference)
                          : "Not submitted"}
                      </p>

                      <p className="mt-4 text-xs font-bold text-slate-500">
                        PAYMENT STATUS
                      </p>
                      <p className="mt-1 font-semibold">
                        {order.paymentStatus
                          ? String(order.paymentStatus)
                          : "pending"}
                      </p>
                    </div>

                    <div className="mt-4">
                      <OrderActions orderNumber={String(order.orderNumber)} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
'@

$loginApi = @'
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
'@

$logoutApi = @'
import { NextResponse } from "next/server";

import { ADMIN_COOKIE_NAME } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/admin/login", request.url));

  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  return response;
}
'@

$orderApi = @'
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ orderNumber: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is missing");
    }

    const { orderNumber: rawOrderNumber } = await context.params;
    const orderNumber = decodeURIComponent(rawOrderNumber)
      .trim()
      .toUpperCase();

    const body = (await request.json()) as { action?: string };
    const action = body.action ?? "";
    const sql = neon(process.env.DATABASE_URL);

    const rows = await sql`
      SELECT id
      FROM orders
      WHERE order_number = ${orderNumber}
      LIMIT 1
    `;

    const order = rows[0];

    if (!order?.id) {
      return NextResponse.json(
        { ok: false, error: "Order not found." },
        { status: 404 },
      );
    }

    if (action === "mark_paid") {
      await sql.transaction([
        sql`
          UPDATE payments
          SET status = 'successful', paid_at = NOW()
          WHERE order_id = ${order.id}
        `,
        sql`
          UPDATE orders
          SET status = 'paid', updated_at = NOW()
          WHERE id = ${order.id}
        `,
      ]);
    } else if (action === "mark_processing") {
      await sql`
        UPDATE orders
        SET status = 'processing', updated_at = NOW()
        WHERE id = ${order.id}
      `;
    } else if (action === "mark_shipped") {
      await sql`
        UPDATE orders
        SET status = 'shipped', updated_at = NOW()
        WHERE id = ${order.id}
      `;
    } else if (action === "mark_delivered") {
      await sql.transaction([
        sql`
          UPDATE orders
          SET status = 'delivered', updated_at = NOW()
          WHERE id = ${order.id}
        `,
        sql`
          UPDATE payments
          SET
            status = CASE
              WHEN provider = 'cash_on_delivery' THEN 'successful'
              ELSE status
            END,
            paid_at = CASE
              WHEN provider = 'cash_on_delivery' THEN NOW()
              ELSE paid_at
            END
          WHERE order_id = ${order.id}
        `,
      ]);
    } else if (action === "cancel") {
      await sql.transaction([
        sql`
          UPDATE orders
          SET status = 'cancelled', updated_at = NOW()
          WHERE id = ${order.id}
        `,
        sql`
          UPDATE payments
          SET status = 'failed'
          WHERE order_id = ${order.id}
            AND status = 'pending'
        `,
      ]);
    } else {
      return NextResponse.json(
        { ok: false, error: "Invalid action." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Update failed.",
      },
      { status: 500 },
    );
  }
}
'@

$files = @{
  "src\lib\admin-auth.ts" = $adminAuth
  "src\components\admin\AdminLoginForm.tsx" = $loginForm
  "src\components\admin\OrderActions.tsx" = $orderActions
  "src\app\admin\login\page.tsx" = $loginPage
  "src\app\admin\orders\page.tsx" = $ordersPage
  "src\app\api\admin\login\route.ts" = $loginApi
  "src\app\api\admin\logout\route.ts" = $logoutApi
  "src\app\api\admin\orders\[orderNumber]\route.ts" = $orderApi
}

foreach ($relativePath in $files.Keys) {
  $fullPath = Join-Path (Get-Location) $relativePath
  [System.IO.File]::WriteAllText($fullPath, $files[$relativePath], $utf8)
}

Remove-Item -Recurse -Force ".\.next" -ErrorAction SilentlyContinue

Write-Host "Running production build verification..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "Protected admin payment-verification dashboard installed." -ForegroundColor Green
Write-Host "ADMIN_SECRET was generated in .env.local if missing." -ForegroundColor Green
