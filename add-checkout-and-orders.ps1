$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json")) {
  throw "Run this inside C:\Users\Hp\Desktop\whokeas-all-in"
}

$utf8 = [System.Text.UTF8Encoding]::new($false)

New-Item -ItemType Directory -Force ".\src\app\checkout" | Out-Null
New-Item -ItemType Directory -Force ".\src\app\api\orders" | Out-Null
New-Item -ItemType Directory -Force ".\src\app\order-confirmation\[orderNumber]" | Out-Null
New-Item -ItemType Directory -Force ".\src\components\checkout" | Out-Null
New-Item -ItemType Directory -Force ".\src\components\store" | Out-Null

$cartClient = @'
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CartItem = {
  key: string;
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  variantName: string | null;
  price: number;
  quantity: number;
};

function formatPrice(value: number) {
  return `TZS ${value.toLocaleString("en-US")}`;
}

export default function CartClient() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("whokeas-cart");
      setItems(raw ? JSON.parse(raw) : []);
    } catch {
      setItems([]);
    } finally {
      setReady(true);
    }
  }, []);

  function save(nextItems: CartItem[]) {
    setItems(nextItems);
    localStorage.setItem("whokeas-cart", JSON.stringify(nextItems));
    window.dispatchEvent(new Event("whokeas-cart-updated"));
  }

  function changeQuantity(key: string, quantity: number) {
    save(
      items.map((item) =>
        item.key === key ? { ...item, quantity: Math.max(1, quantity) } : item,
      ),
    );
  }

  function removeItem(key: string) {
    save(items.filter((item) => item.key !== key));
  }

  const subtotal = useMemo(
    () => items.reduce((total, item) => total + item.price * item.quantity, 0),
    [items],
  );

  if (!ready) {
    return <div className="p-8 text-sm text-slate-500">Loading cart...</div>;
  }

  if (items.length === 0) {
    return (
      <section className="bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-black">Your cart is empty</h1>
        <p className="mt-3 text-slate-600">
          Explore the store and add products you want to order.
        </p>
        <Link
          href="/#products"
          className="mt-6 inline-block rounded-full bg-[#ffd814] px-6 py-3 text-sm font-bold hover:bg-[#f7ca00]"
        >
          Continue shopping
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
      <section className="bg-white p-5 shadow-sm">
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-3xl font-black">Shopping Cart</h1>
        </div>

        <div className="divide-y divide-slate-200">
          {items.map((item) => (
            <article
              key={item.key}
              className="grid gap-4 py-6 sm:grid-cols-[140px_1fr_auto]"
            >
              <div className="flex aspect-square items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-amber-100">
                <span className="text-2xl font-black text-slate-500">WAI</span>
              </div>

              <div>
                <Link
                  href={`/products/${item.slug}`}
                  className="text-lg font-bold hover:text-[#c7511f]"
                >
                  {item.name}
                </Link>

                {item.variantName && (
                  <p className="mt-2 text-sm text-slate-500">
                    Option: {item.variantName}
                  </p>
                )}

                <p className="mt-2 text-sm font-semibold text-emerald-700">
                  Available to order
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <select
                    aria-label={`Quantity for ${item.name}`}
                    value={item.quantity}
                    onChange={(event) =>
                      changeQuantity(item.key, Number(event.target.value))
                    }
                    className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        Qty: {value}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    className="text-sm font-semibold text-[#007185] hover:text-[#c7511f] hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <p className="font-black">{formatPrice(item.price)}</p>
            </article>
          ))}
        </div>
      </section>

      <aside className="h-fit bg-white p-5 shadow-sm lg:sticky lg:top-32">
        <p className="text-lg">
          Subtotal ({items.reduce((total, item) => total + item.quantity, 0)}{" "}
          items):
          <span className="ml-2 font-black">{formatPrice(subtotal)}</span>
        </p>

        <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          Delivery fee will be confirmed before payment.
        </div>

        <Link
          href="/checkout"
          className="mt-5 block w-full rounded-full bg-[#ffd814] px-5 py-3 text-center text-sm font-bold shadow-sm hover:bg-[#f7ca00]"
        >
          Proceed to Checkout
        </Link>

        <p className="mt-3 text-center text-xs leading-5 text-slate-500">
          No payment is taken during this test checkout.
        </p>
      </aside>
    </div>
  );
}
'@

$checkoutClient = @'
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type CartItem = {
  key: string;
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  variantName: string | null;
  price: number;
  quantity: number;
};

type FormState = {
  fullName: string;
  phone: string;
  email: string;
  region: string;
  district: string;
  ward: string;
  addressLine: string;
  notes: string;
};

const regions = [
  "Arusha",
  "Dar es Salaam",
  "Dodoma",
  "Geita",
  "Iringa",
  "Kagera",
  "Katavi",
  "Kigoma",
  "Kilimanjaro",
  "Lindi",
  "Manyara",
  "Mara",
  "Mbeya",
  "Morogoro",
  "Mtwara",
  "Mwanza",
  "Njombe",
  "Pemba North",
  "Pemba South",
  "Pwani",
  "Rukwa",
  "Ruvuma",
  "Shinyanga",
  "Simiyu",
  "Singida",
  "Songwe",
  "Tabora",
  "Tanga",
  "Unguja North",
  "Unguja South",
  "Unguja Urban West",
];

function formatPrice(value: number) {
  return `TZS ${value.toLocaleString("en-US")}`;
}

export default function CheckoutClient() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<FormState>({
    fullName: "",
    phone: "",
    email: "",
    region: "Kilimanjaro",
    district: "",
    ward: "",
    addressLine: "",
    notes: "",
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("whokeas-cart");
      setItems(raw ? JSON.parse(raw) : []);
    } catch {
      setItems([]);
    } finally {
      setReady(true);
    }
  }, []);

  const displayedSubtotal = useMemo(
    () => items.reduce((total, item) => total + item.price * item.quantity, 0),
    [items],
  );

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: form,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Could not create the order.");
      }

      localStorage.removeItem("whokeas-cart");
      window.dispatchEvent(new Event("whokeas-cart-updated"));
      window.location.href = `/order-confirmation/${result.orderNumber}`;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create the order.",
      );
      setSubmitting(false);
    }
  }

  if (!ready) {
    return <div className="bg-white p-8">Loading checkout...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-black">Your cart is empty</h1>
        <Link
          href="/#products"
          className="mt-6 inline-block rounded-full bg-[#ffd814] px-6 py-3 text-sm font-bold"
        >
          Return to products
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submitOrder}
      className="grid gap-5 lg:grid-cols-[1fr_380px]"
    >
      <section className="bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-[#c45500]">Step 1 of 2</p>
        <h1 className="mt-2 text-3xl font-black">Delivery details</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter accurate information so the order can be confirmed and delivered.
        </p>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-bold">Full name *</span>
            <input
              required
              value={form.fullName}
              onChange={(event) => updateField("fullName", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#e49b00] focus:ring-1 focus:ring-[#e49b00]"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-bold">Phone number *</span>
            <input
              required
              inputMode="tel"
              placeholder="07XXXXXXXX or +255..."
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#e49b00] focus:ring-1 focus:ring-[#e49b00]"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-bold">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#e49b00] focus:ring-1 focus:ring-[#e49b00]"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-bold">Region *</span>
            <select
              required
              value={form.region}
              onChange={(event) => updateField("region", event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-[#e49b00]"
            >
              {regions.map((region) => (
                <option key={region}>{region}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-sm font-bold">District *</span>
            <input
              required
              value={form.district}
              onChange={(event) => updateField("district", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#e49b00]"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-bold">Ward</span>
            <input
              value={form.ward}
              onChange={(event) => updateField("ward", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#e49b00]"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-bold">
              Street, village, landmark or pickup details *
            </span>
            <textarea
              required
              rows={3}
              value={form.addressLine}
              onChange={(event) =>
                updateField("addressLine", event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#e49b00]"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-bold">
              Optional order notes
            </span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#e49b00]"
            />
          </label>
        </div>
      </section>

      <aside className="h-fit bg-white p-6 shadow-sm lg:sticky lg:top-24">
        <h2 className="text-2xl font-black">Order summary</h2>

        <div className="mt-5 max-h-72 space-y-4 overflow-y-auto border-y border-slate-200 py-4">
          {items.map((item) => (
            <div key={item.key} className="flex justify-between gap-4 text-sm">
              <div>
                <p className="font-bold">{item.name}</p>
                <p className="mt-1 text-slate-500">
                  {item.variantName ? `${item.variantName} · ` : ""}
                  Qty {item.quantity}
                </p>
              </div>
              <p className="shrink-0 font-semibold">
                {formatPrice(item.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <span>Products</span>
            <span>{formatPrice(displayedSubtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>Confirmed before payment</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-4 text-xl font-black text-[#b12704]">
            <span>Current total</span>
            <span>{formatPrice(displayedSubtotal)}</span>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-full bg-[#ffd814] px-5 py-3 text-sm font-bold shadow-sm hover:bg-[#f7ca00] disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? "Creating order..." : "Place Order"}
        </button>

        <p className="mt-3 text-center text-xs leading-5 text-slate-500">
          Payment is not collected yet. The order will be saved as pending
          payment.
        </p>
      </aside>
    </form>
  );
}
'@

$checkoutPage = @'
import Image from "next/image";
import Link from "next/link";

import CartButton from "@/components/store/CartButton";
import CheckoutClient from "@/components/checkout/CheckoutClient";

export const metadata = {
  title: "Checkout",
};

export default function CheckoutPage() {
  return (
    <main className="min-h-screen bg-[#eaeded] text-[#0f1111]">
      <header className="bg-[#101820] text-white shadow-md">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-4 px-4 lg:px-6">
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
                ALL IN
              </div>
            </div>
          </Link>

          <CartButton />
        </div>
      </header>

      <div className="mx-auto max-w-[1350px] px-4 py-6 lg:px-6">
        <CheckoutClient />
      </div>
    </main>
  );
}
'@

$orderApi = @'
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RequestItem = {
  productId?: string;
  variantId?: string | null;
  quantity?: number;
};

type RequestBody = {
  customer?: {
    fullName?: string;
    phone?: string;
    email?: string;
    region?: string;
    district?: string;
    ward?: string;
    addressLine?: string;
    notes?: string;
  };
  items?: RequestItem[];
};

type CanonicalItem = {
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
};

function clean(value: unknown, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function createOrderNumber() {
  const date = new Date();
  const datePart = [
    String(date.getUTCFullYear()).slice(-2),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("");

  return `WAI-${datePart}-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is missing");
    }

    const body = (await request.json()) as RequestBody;
    const customer = body.customer;
    const requestedItems = Array.isArray(body.items) ? body.items : [];

    const fullName = clean(customer?.fullName, 160);
    const phone = clean(customer?.phone, 30);
    const email = clean(customer?.email, 200);
    const region = clean(customer?.region, 100);
    const district = clean(customer?.district, 100);
    const ward = clean(customer?.ward, 100);
    const addressLine = clean(customer?.addressLine, 500);
    const notes = clean(customer?.notes, 1000);

    if (!fullName || !phone || !region || !district || !addressLine) {
      return NextResponse.json(
        { ok: false, error: "Complete all required delivery fields." },
        { status: 400 },
      );
    }

    if (!/^(?:\+?255|0)[67]\d{8}$/.test(phone.replace(/\s+/g, ""))) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid Tanzanian phone number." },
        { status: 400 },
      );
    }

    if (requestedItems.length < 1 || requestedItems.length > 30) {
      return NextResponse.json(
        { ok: false, error: "The cart is empty or too large." },
        { status: 400 },
      );
    }

    const sql = neon(process.env.DATABASE_URL);
    const canonicalItems: CanonicalItem[] = [];

    for (const requested of requestedItems) {
      const productId = clean(requested.productId, 50);
      const variantId = clean(requested.variantId, 50) || null;
      const quantity = Math.floor(Number(requested.quantity));

      if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
        return NextResponse.json(
          { ok: false, error: "One cart item is invalid." },
          { status: 400 },
        );
      }

      if (variantId) {
        const rows = await sql`
          SELECT
            p.id AS product_id,
            p.name AS product_name,
            p.status::text AS product_status,
            v.id AS variant_id,
            v.name AS variant_name,
            v.sku,
            v.price::text AS variant_price,
            v.cost::text AS variant_cost,
            v.stock_quantity,
            v.is_active
          FROM products p
          JOIN product_variants v ON v.product_id = p.id
          WHERE p.id = ${productId}
            AND v.id = ${variantId}
          LIMIT 1
        `;

        const item = rows[0];

        if (
          !item ||
          item.product_status !== "active" ||
          item.is_active !== true ||
          Number(item.stock_quantity) < quantity
        ) {
          return NextResponse.json(
            {
              ok: false,
              error: "A selected product option is unavailable or has insufficient stock.",
            },
            { status: 409 },
          );
        }

        const unitPrice = Number(item.variant_price);
        const unitCost = Number(item.variant_cost ?? 0);

        canonicalItems.push({
          productId: String(item.product_id),
          variantId: String(item.variant_id),
          productName: String(item.product_name),
          variantName: String(item.variant_name),
          sku: item.sku ? String(item.sku) : null,
          quantity,
          unitPrice,
          unitCost,
          lineTotal: unitPrice * quantity,
        });
      } else {
        const rows = await sql`
          SELECT
            id,
            name,
            status::text AS status,
            price::text AS price,
            base_cost::text AS cost
          FROM products
          WHERE id = ${productId}
          LIMIT 1
        `;

        const item = rows[0];

        if (!item || item.status !== "active") {
          return NextResponse.json(
            { ok: false, error: "A cart product is unavailable." },
            { status: 409 },
          );
        }

        const unitPrice = Number(item.price);
        const unitCost = Number(item.cost ?? 0);

        canonicalItems.push({
          productId: String(item.id),
          variantId: null,
          productName: String(item.name),
          variantName: null,
          sku: null,
          quantity,
          unitPrice,
          unitCost,
          lineTotal: unitPrice * quantity,
        });
      }
    }

    const subtotal = canonicalItems.reduce(
      (total, item) => total + item.lineTotal,
      0,
    );
    const supplierCostTotal = canonicalItems.reduce(
      (total, item) => total + item.unitCost * item.quantity,
      0,
    );

    const shippingFee = 0;
    const total = subtotal + shippingFee;
    const orderId = randomUUID();
    const orderNumber = createOrderNumber();

    const shippingAddress = {
      recipientName: fullName,
      phone,
      country: "Tanzania",
      region,
      district,
      ...(ward ? { ward } : {}),
      addressLine,
    };

    const queries = [
      sql`
        INSERT INTO orders (
          id,
          order_number,
          customer_name,
          customer_phone,
          customer_email,
          status,
          currency,
          subtotal,
          shipping_fee,
          discount_amount,
          total,
          supplier_cost_total,
          shipping_address,
          source,
          customer_notes,
          created_at,
          updated_at
        )
        VALUES (
          ${orderId},
          ${orderNumber},
          ${fullName},
          ${phone},
          ${email || null},
          'pending_payment',
          'TZS',
          ${subtotal},
          ${shippingFee},
          0,
          ${total},
          ${supplierCostTotal},
          ${JSON.stringify(shippingAddress)}::jsonb,
          'website',
          ${notes || null},
          NOW(),
          NOW()
        )
      `,
      ...canonicalItems.map(
        (item) => sql`
          INSERT INTO order_items (
            order_id,
            product_id,
            variant_id,
            product_name,
            variant_name,
            sku,
            quantity,
            unit_price,
            unit_cost,
            line_total
          )
          VALUES (
            ${orderId},
            ${item.productId},
            ${item.variantId},
            ${item.productName},
            ${item.variantName},
            ${item.sku},
            ${item.quantity},
            ${item.unitPrice},
            ${item.unitCost},
            ${item.lineTotal}
          )
        `,
      ),
    ];

    await sql.transaction(queries);

    return NextResponse.json(
      {
        ok: true,
        orderId,
        orderNumber,
        subtotal,
        shippingFee,
        total,
        status: "pending_payment",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create order failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not create the order.",
      },
      { status: 500 },
    );
  }
}
'@

$confirmationPage = @'
import { neon } from "@neondatabase/serverless";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ orderNumber: string }>;
};

function formatPrice(value: string | number) {
  return `TZS ${Number(value).toLocaleString("en-US")}`;
}

export default async function OrderConfirmationPage({ params }: PageProps) {
  const { orderNumber: rawOrderNumber } = await params;
  const orderNumber = decodeURIComponent(rawOrderNumber).trim().toUpperCase();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing");
  }

  const sql = neon(process.env.DATABASE_URL);

  const orders = await sql`
    SELECT
      id,
      order_number AS "orderNumber",
      customer_name AS "customerName",
      customer_phone AS "customerPhone",
      customer_email AS "customerEmail",
      status::text AS status,
      subtotal::text AS subtotal,
      shipping_fee::text AS "shippingFee",
      total::text AS total,
      shipping_address AS "shippingAddress",
      created_at AS "createdAt"
    FROM orders
    WHERE order_number = ${orderNumber}
    LIMIT 1
  `;

  const order = orders[0] as
    | {
        id: string;
        orderNumber: string;
        customerName: string;
        customerPhone: string;
        customerEmail: string | null;
        status: string;
        subtotal: string;
        shippingFee: string;
        total: string;
        shippingAddress: {
          region?: string;
          district?: string;
          ward?: string;
          addressLine?: string;
        };
        createdAt: string;
      }
    | undefined;

  if (!order) {
    notFound();
  }

  const items = await sql`
    SELECT
      product_name AS "productName",
      variant_name AS "variantName",
      quantity,
      unit_price::text AS "unitPrice",
      line_total::text AS "lineTotal"
    FROM order_items
    WHERE order_id = ${order.id}
    ORDER BY product_name
  `;

  return (
    <main className="min-h-screen bg-[#eaeded] text-[#0f1111]">
      <header className="bg-[#101820] text-white shadow-md">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center px-4">
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
                ALL IN
              </div>
            </div>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1000px] px-4 py-8">
        <section className="bg-white p-7 shadow-sm sm:p-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
            ✓
          </div>

          <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-emerald-700">
            Order created successfully
          </p>
          <h1 className="mt-2 text-4xl font-black">
            Thank you, {order.customerName}.
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-600">
            Your order has been saved. Payment and delivery charges have not
            been collected yet. The next step will connect secure payment and
            confirmation.
          </p>

          <div className="mt-7 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold text-slate-500">ORDER NUMBER</p>
              <p className="mt-1 font-black">{order.orderNumber}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">STATUS</p>
              <p className="mt-1 font-black text-[#b12704]">Pending payment</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">CURRENT TOTAL</p>
              <p className="mt-1 font-black">{formatPrice(order.total)}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-8 md:grid-cols-[1fr_320px]">
            <div>
              <h2 className="text-2xl font-black">Items ordered</h2>
              <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
                {items.map((item) => (
                  <div
                    key={`${item.productName}-${item.variantName ?? ""}`}
                    className="flex justify-between gap-4 py-4"
                  >
                    <div>
                      <p className="font-bold">{String(item.productName)}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.variantName ? `${item.variantName} · ` : ""}
                        Qty {Number(item.quantity)}
                      </p>
                    </div>
                    <p className="font-bold">
                      {formatPrice(String(item.lineTotal))}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-lg border border-slate-200 p-5">
              <h2 className="font-black">Delivery details</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {order.shippingAddress?.addressLine}
                <br />
                {order.shippingAddress?.district}
                {order.shippingAddress?.ward
                  ? `, ${order.shippingAddress.ward}`
                  : ""}
                <br />
                {order.shippingAddress?.region}, Tanzania
              </p>

              <p className="mt-5 text-sm">
                <span className="font-bold">Phone:</span>{" "}
                {order.customerPhone}
              </p>
            </aside>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full bg-[#ffd814] px-6 py-3 text-sm font-bold hover:bg-[#f7ca00]"
            >
              Continue shopping
            </Link>
            <Link
              href="/cart"
              className="rounded-full border border-slate-300 px-6 py-3 text-sm font-bold hover:bg-slate-50"
            >
              View cart
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
'@

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\components\store\CartClient.tsx"),
  $cartClient,
  $utf8
)

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\components\checkout\CheckoutClient.tsx"),
  $checkoutClient,
  $utf8
)

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\app\checkout\page.tsx"),
  $checkoutPage,
  $utf8
)

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\app\api\orders\route.ts"),
  $orderApi,
  $utf8
)

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\app\order-confirmation\[orderNumber]\page.tsx"),
  $confirmationPage,
  $utf8
)

Remove-Item -Recurse -Force ".\.next" -ErrorAction SilentlyContinue

Write-Host "Running production build verification..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "Checkout and Neon order system installed." -ForegroundColor Green
Write-Host "Run: npm run dev" -ForegroundColor Yellow
Write-Host "Test: cart -> checkout -> place order -> confirmation" -ForegroundColor Yellow
