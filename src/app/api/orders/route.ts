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