$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json")) {
  throw "Run this inside C:\Users\Hp\Desktop\whokeas-all-in"
}

$utf8 = [System.Text.UTF8Encoding]::new($false)

$dirs = @(
  ".\src\components\payments",
  ".\src\components\checkout",
  ".\src\app\api\orders\[orderNumber]\payment-reference",
  ".\src\app\order-confirmation\[orderNumber]"
)

foreach ($dir in $dirs) {
  New-Item -ItemType Directory -Force $dir | Out-Null
}

$envExample = @'
DATABASE_URL="postgresql://..."
ADMIN_SECRET="generate-a-long-random-secret"
MOBILE_MONEY_NUMBER="07XXXXXXXX"
MOBILE_MONEY_NAME="WHOKEAS ALL IN"
NMB_ACCOUNT_NUMBER="YOUR_NMB_ACCOUNT_NUMBER"
NMB_ACCOUNT_NAME="YOUR_LEGAL_ACCOUNT_NAME"
NMB_BANK_NAME="NMB Bank Plc"
SUPPORT_PHONE="07XXXXXXXX"
'@

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) ".env.example"),
  $envExample,
  $utf8
)

$paymentReferenceForm = @'
"use client";

import { FormEvent, useState } from "react";

type Props = {
  orderNumber: string;
  existingReference: string | null;
};

export default function PaymentReferenceForm({
  orderNumber,
  existingReference,
}: Props) {
  const [reference, setReference] = useState(existingReference ?? "");
  const [message, setMessage] = useState(
    existingReference ? "Reference already submitted." : "",
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}/payment-reference`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Could not submit reference.");
      }

      setMessage("Reference submitted. Verification is pending.");
      setSubmitting(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not submit reference.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5">
      <label>
        <span className="mb-2 block text-sm font-bold">
          Transaction reference
        </span>
        <input
          required
          maxLength={180}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="Example: ABC123XYZ"
          className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#e49b00]"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-3 w-full rounded-full bg-[#ffd814] px-5 py-3 text-sm font-bold hover:bg-[#f7ca00] disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Submit Reference"}
      </button>

      {message && (
        <p className="mt-3 text-sm font-semibold text-emerald-700">{message}</p>
      )}

      {error && (
        <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>
      )}
    </form>
  );
}
'@

$paymentReferenceApi = @'
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ orderNumber: string }>;
};

export async function POST(request: Request, context: Context) {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is missing");
    }

    const { orderNumber: rawOrderNumber } = await context.params;
    const orderNumber = decodeURIComponent(rawOrderNumber)
      .trim()
      .toUpperCase();

    const body = (await request.json()) as { reference?: string };
    const reference =
      typeof body.reference === "string"
        ? body.reference.trim().slice(0, 180)
        : "";

    if (reference.length < 4) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid transaction reference." },
        { status: 400 },
      );
    }

    const sql = neon(process.env.DATABASE_URL);

    const rows = await sql`
      SELECT o.id, p.provider
      FROM orders o
      LEFT JOIN LATERAL (
        SELECT provider
        FROM payments
        WHERE order_id = o.id
        ORDER BY created_at DESC
        LIMIT 1
      ) p ON true
      WHERE o.order_number = ${orderNumber}
      LIMIT 1
    `;

    const order = rows[0];

    if (!order?.id) {
      return NextResponse.json(
        { ok: false, error: "Order not found." },
        { status: 404 },
      );
    }

    if (
      order.provider !== "manual_mobile_money" &&
      order.provider !== "manual_bank_transfer"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "This order does not require a transaction reference.",
        },
        { status: 409 },
      );
    }

    try {
      await sql`
        UPDATE payments
        SET provider_reference = ${reference}
        WHERE order_id = ${order.id}
      `;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes("unique")
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "That reference is already attached to another order.",
          },
          { status: 409 },
        );
      }

      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not submit reference.",
      },
      { status: 500 },
    );
  }
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

type PaymentMethod =
  | "cash_on_delivery"
  | "manual_mobile_money"
  | "manual_bank_transfer";

type FormState = {
  fullName: string;
  phone: string;
  email: string;
  region: string;
  district: string;
  ward: string;
  addressLine: string;
  notes: string;
  paymentMethod: PaymentMethod;
};

const regions = [
  "Arusha", "Dar es Salaam", "Dodoma", "Geita", "Iringa", "Kagera",
  "Katavi", "Kigoma", "Kilimanjaro", "Lindi", "Manyara", "Mara",
  "Mbeya", "Morogoro", "Mtwara", "Mwanza", "Njombe", "Pemba North",
  "Pemba South", "Pwani", "Rukwa", "Ruvuma", "Shinyanga", "Simiyu",
  "Singida", "Songwe", "Tabora", "Tanga", "Unguja North",
  "Unguja South", "Unguja Urban West"
];

const methods: Array<{
  value: PaymentMethod;
  title: string;
  description: string;
}> = [
  {
    value: "cash_on_delivery",
    title: "Cash on Delivery",
    description:
      "Available only where delivery and collection can be confirmed.",
  },
  {
    value: "manual_mobile_money",
    title: "Mobile Money Transfer",
    description:
      "Pay using the number shown after ordering, then submit the reference.",
  },
  {
    value: "manual_bank_transfer",
    title: "NMB Bank Transfer",
    description:
      "Transfer to the displayed NMB account, then submit the reference.",
  },
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
    paymentMethod: "manual_mobile_money",
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

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
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
          paymentMethod: form.paymentMethod,
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
        caught instanceof Error ? caught.message : "Could not create the order.",
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
      <div className="space-y-5">
        <section className="bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-[#c45500]">Step 1 of 2</p>
          <h1 className="mt-2 text-3xl font-black">Delivery details</h1>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold">Full name *</span>
              <input
                required
                value={form.fullName}
                onChange={(event) =>
                  updateField("fullName", event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#e49b00]"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-bold">
                Phone number *
              </span>
              <input
                required
                inputMode="tel"
                placeholder="07XXXXXXXX or +255..."
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#e49b00]"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-bold">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#e49b00]"
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
                onChange={(event) =>
                  updateField("district", event.target.value)
                }
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

        <section className="bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-[#c45500]">Step 2 of 2</p>
          <h2 className="mt-2 text-3xl font-black">Payment method</h2>
          <p className="mt-2 text-sm text-slate-600">
            Payment is verified manually before supplier fulfilment.
          </p>

          <div className="mt-6 grid gap-3">
            {methods.map((method) => {
              const selected = form.paymentMethod === method.value;

              return (
                <label
                  key={method.value}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    selected
                      ? "border-[#e49b00] bg-[#fff8df] ring-1 ring-[#e49b00]"
                      : "border-slate-300 hover:border-slate-500"
                  }`}
                >
                  <div className="flex gap-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.value}
                      checked={selected}
                      onChange={() =>
                        updateField("paymentMethod", method.value)
                      }
                      className="mt-1"
                    />
                    <div>
                      <p className="font-black">{method.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {method.description}
                      </p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="h-fit bg-white p-6 shadow-sm lg:sticky lg:top-24">
        <h2 className="text-2xl font-black">Order summary</h2>

        <div className="mt-5 max-h-72 space-y-4 overflow-y-auto border-y border-slate-200 py-4">
          {items.map((item) => (
            <div key={item.key} className="flex justify-between gap-4 text-sm">
              <div>
                <p className="font-bold">{item.name}</p>
                <p className="mt-1 text-slate-500">
                  {item.variantName ? `${item.variantName} - ` : ""}
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
            <span>Confirmed separately</span>
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
          className="mt-6 w-full rounded-full bg-[#ffd814] px-5 py-3 text-sm font-bold shadow-sm hover:bg-[#f7ca00] disabled:opacity-60"
        >
          {submitting ? "Creating order..." : "Place Order"}
        </button>

        <p className="mt-3 text-center text-xs leading-5 text-slate-500">
          Orders remain pending until payment or cash-on-delivery approval.
        </p>
      </aside>
    </form>
  );
}
'@

$orderApi = @'
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type PaymentMethod =
  | "cash_on_delivery"
  | "manual_mobile_money"
  | "manual_bank_transfer";

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
  paymentMethod?: PaymentMethod;
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

const allowedMethods: PaymentMethod[] = [
  "cash_on_delivery",
  "manual_mobile_money",
  "manual_bank_transfer",
];

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
    const paymentMethod = body.paymentMethod;

    if (!paymentMethod || !allowedMethods.includes(paymentMethod)) {
      return NextResponse.json(
        { ok: false, error: "Choose a valid payment method." },
        { status: 400 },
      );
    }

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

      if (
        !productId ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 5
      ) {
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
              error:
                "A selected product option is unavailable or has insufficient stock.",
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
    const paymentId = randomUUID();
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
          id, order_number, customer_name, customer_phone, customer_email,
          status, currency, subtotal, shipping_fee, discount_amount, total,
          supplier_cost_total, shipping_address, source, customer_notes,
          created_at, updated_at
        )
        VALUES (
          ${orderId}, ${orderNumber}, ${fullName}, ${phone}, ${email || null},
          'pending_payment', 'TZS', ${subtotal}, ${shippingFee}, 0, ${total},
          ${supplierCostTotal}, ${JSON.stringify(shippingAddress)}::jsonb,
          'website', ${notes || null}, NOW(), NOW()
        )
      `,
      sql`
        INSERT INTO payments (
          id, order_id, provider, status, amount, fee, currency,
          raw_response, created_at
        )
        VALUES (
          ${paymentId}, ${orderId}, ${paymentMethod}, 'pending', ${total},
          0, 'TZS', ${JSON.stringify({ source: "manual_checkout" })}::jsonb,
          NOW()
        )
      `,
      ...canonicalItems.map(
        (item) => sql`
          INSERT INTO order_items (
            order_id, product_id, variant_id, product_name, variant_name,
            sku, quantity, unit_price, unit_cost, line_total
          )
          VALUES (
            ${orderId}, ${item.productId}, ${item.variantId},
            ${item.productName}, ${item.variantName}, ${item.sku},
            ${item.quantity}, ${item.unitPrice}, ${item.unitCost},
            ${item.lineTotal}
          )
        `,
      ),
    ];

    await sql.transaction(queries);

    return NextResponse.json(
      {
        ok: true,
        orderNumber,
        paymentMethod,
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

import PaymentReferenceForm from "@/components/payments/PaymentReferenceForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ orderNumber: string }>;
};

function formatPrice(value: string | number) {
  return `TZS ${Number(value).toLocaleString("en-US")}`;
}

function SuccessIcon() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
      <svg
        viewBox="0 0 24 24"
        className="h-9 w-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12.5 9.2 17 19 7" />
      </svg>
    </div>
  );
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
      o.id,
      o.order_number AS "orderNumber",
      o.customer_name AS "customerName",
      o.customer_phone AS "customerPhone",
      o.status::text AS status,
      o.total::text AS total,
      o.shipping_address AS "shippingAddress",
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
    WHERE o.order_number = ${orderNumber}
    LIMIT 1
  `;

  const order = orders[0] as
    | {
        id: string;
        orderNumber: string;
        customerName: string;
        customerPhone: string;
        status: string;
        total: string;
        shippingAddress: {
          region?: string;
          district?: string;
          ward?: string;
          addressLine?: string;
        };
        paymentProvider: string | null;
        paymentReference: string | null;
        paymentStatus: string | null;
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
      line_total::text AS "lineTotal"
    FROM order_items
    WHERE order_id = ${order.id}
    ORDER BY product_name
  `;

  const mobileNumber =
    process.env.MOBILE_MONEY_NUMBER || "Configure MOBILE_MONEY_NUMBER";
  const mobileName =
    process.env.MOBILE_MONEY_NAME || "Configure MOBILE_MONEY_NAME";
  const nmbAccount =
    process.env.NMB_ACCOUNT_NUMBER || "Configure NMB_ACCOUNT_NUMBER";
  const nmbName =
    process.env.NMB_ACCOUNT_NAME || "Configure NMB_ACCOUNT_NAME";
  const bankName = process.env.NMB_BANK_NAME || "NMB Bank Plc";
  const supportPhone =
    process.env.SUPPORT_PHONE || process.env.MOBILE_MONEY_NUMBER || "";

  const requiresReference =
    order.paymentProvider === "manual_mobile_money" ||
    order.paymentProvider === "manual_bank_transfer";

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

      <div className="mx-auto max-w-[1050px] px-4 py-8">
        <section className="bg-white p-7 shadow-sm sm:p-10">
          <SuccessIcon />

          <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-emerald-700">
            Order created successfully
          </p>

          <h1 className="mt-2 text-4xl font-black">
            Thank you, {order.customerName}.
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-slate-600">
            Follow the payment instructions below. Supplier fulfilment starts
            only after payment verification or cash-on-delivery approval.
          </p>

          <div className="mt-7 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold text-slate-500">ORDER NUMBER</p>
              <p className="mt-1 font-black">{order.orderNumber}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">STATUS</p>
              <p className="mt-1 font-black text-[#b12704]">
                {order.status.replaceAll("_", " ")}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">TOTAL</p>
              <p className="mt-1 font-black">{formatPrice(order.total)}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
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
                        {item.variantName ? (
                          <>
                            <span>{String(item.variantName)}</span>
                            <span className="mx-2">-</span>
                          </>
                        ) : null}
                        Qty {Number(item.quantity)}
                      </p>
                    </div>
                    <p className="font-bold">
                      {formatPrice(String(item.lineTotal))}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-7 rounded-lg border border-slate-200 p-5">
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
                <p className="mt-4 text-sm">
                  <span className="font-bold">Phone:</span>{" "}
                  {order.customerPhone}
                </p>
              </div>
            </div>

            <aside className="h-fit rounded-xl border border-slate-300 p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                Payment instructions
              </p>

              {order.paymentProvider === "cash_on_delivery" && (
                <div className="mt-4">
                  <h2 className="text-xl font-black">Cash on Delivery</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    We will contact you to confirm delivery availability and the
                    final delivery charge. Pay when the product is delivered.
                  </p>
                </div>
              )}

              {order.paymentProvider === "manual_mobile_money" && (
                <div className="mt-4">
                  <h2 className="text-xl font-black">Mobile Money</h2>
                  <div className="mt-4 rounded-lg bg-[#fff8df] p-4">
                    <p className="text-xs font-bold text-slate-500">
                      SEND EXACTLY
                    </p>
                    <p className="mt-1 text-2xl font-black">
                      {formatPrice(order.total)}
                    </p>
                    <p className="mt-4 text-xs font-bold text-slate-500">
                      NUMBER
                    </p>
                    <p className="mt-1 text-lg font-black">{mobileNumber}</p>
                    <p className="mt-1 text-sm text-slate-600">{mobileName}</p>
                  </div>
                </div>
              )}

              {order.paymentProvider === "manual_bank_transfer" && (
                <div className="mt-4">
                  <h2 className="text-xl font-black">NMB Bank Transfer</h2>
                  <div className="mt-4 rounded-lg bg-slate-50 p-4">
                    <p className="text-sm">
                      <span className="font-bold">Bank:</span> {bankName}
                    </p>
                    <p className="mt-2 text-sm">
                      <span className="font-bold">Account:</span> {nmbAccount}
                    </p>
                    <p className="mt-2 text-sm">
                      <span className="font-bold">Name:</span> {nmbName}
                    </p>
                    <p className="mt-4 text-sm">
                      Transfer exactly{" "}
                      <span className="font-black">
                        {formatPrice(order.total)}
                      </span>
                      .
                    </p>
                  </div>
                </div>
              )}

              {requiresReference && (
                <PaymentReferenceForm
                  orderNumber={order.orderNumber}
                  existingReference={order.paymentReference}
                />
              )}

              <div className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
                Payment status: {order.paymentStatus ?? "pending"}
                {supportPhone ? (
                  <>
                    <br />
                    Support: {supportPhone}
                  </>
                ) : null}
              </div>
            </aside>
          </div>

          <div className="mt-8">
            <Link
              href="/"
              className="inline-block rounded-full bg-[#ffd814] px-6 py-3 text-sm font-bold hover:bg-[#f7ca00]"
            >
              Continue shopping
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
'@

$files = @{
  "src\components\payments\PaymentReferenceForm.tsx" = $paymentReferenceForm
  "src\app\api\orders\[orderNumber]\payment-reference\route.ts" = $paymentReferenceApi
  "src\components\checkout\CheckoutClient.tsx" = $checkoutClient
  "src\app\api\orders\route.ts" = $orderApi
  "src\app\order-confirmation\[orderNumber]\page.tsx" = $confirmationPage
}

foreach ($relativePath in $files.Keys) {
  $fullPath = Join-Path (Get-Location) $relativePath
  [System.IO.File]::WriteAllText($fullPath, $files[$relativePath], $utf8)
}

Remove-Item -Recurse -Force ".\.next" -ErrorAction SilentlyContinue

Write-Host "Running production build verification..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "Customer manual-payment flow installed." -ForegroundColor Green
Write-Host "Next: configure payment details and install the admin patch." -ForegroundColor Yellow
