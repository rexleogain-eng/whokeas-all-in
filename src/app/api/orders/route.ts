export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

import {
  randomBytes,
  randomUUID,
} from "node:crypto";

import { NextResponse } from "next/server";

import {
  CheckoutQuoteError,
  quoteCheckout,
} from "@/lib/checkout-pricing";

import {
  createCustomerSession,
  ensureCustomerSchema,
  getCustomerSession,
  hashCustomerPassword,
  hashOrderAccessKey,
  linkGuestOrders,
  normalizeCustomerEmail,
  saveDefaultCustomerAddress,
  setCustomerSessionCookie,
  updateCustomerProfile,
  validCustomerEmail,
  validateCustomerPassword,
} from "@/lib/customer-auth";

import { catalogSql } from "@/lib/catalog-schema";

type PaymentMethod =
  | "cash_on_delivery"
  | "manual_mobile_money"
  | "manual_bank_transfer"
  | "international_payment_request";

type RequestBody = {
  customer?: {
    fullName?: string;
    phone?: string;
    email?: string;
    countryCode?: string;
    countryName?: string;
    region?: string;
    city?: string;
    postalCode?: string;
    addressLine1?: string;
    addressLine2?: string;
    notes?: string;
  };

  paymentMethod?: PaymentMethod;
  createAccount?: boolean;
  password?: string;

  items?: Array<{
    productId?: string;
    variantId?: string | null;
    quantity?: number;
  }>;
};

function clean(
  value: unknown,
  maximum = 300,
) {
  return typeof value === "string"
    ? value.trim().slice(0, maximum)
    : "";
}

function createOrderNumber() {
  const date = new Date();

  const datePart = [
    String(date.getUTCFullYear()).slice(-2),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("");

  return `WAI-${datePart}-${randomUUID()
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    await ensureCustomerSchema();

    const body =
      (await request.json()) as RequestBody;

    const customer = body.customer;
    const requestedItems =
      Array.isArray(body.items)
        ? body.items
        : [];

    const fullName = clean(
      customer?.fullName,
      160,
    );

    const phone = clean(
      customer?.phone,
      40,
    );

    let email = normalizeCustomerEmail(
      customer?.email,
    );

    const countryCode = clean(
      customer?.countryCode,
      2,
    ).toUpperCase();

    const countryName = clean(
      customer?.countryName,
      120,
    );

    const region = clean(
      customer?.region,
      160,
    );

    const city = clean(
      customer?.city,
      160,
    );

    const postalCode = clean(
      customer?.postalCode,
      40,
    );

    const addressLine1 = clean(
      customer?.addressLine1,
      500,
    );

    const addressLine2 = clean(
      customer?.addressLine2,
      500,
    );

    const notes = clean(
      customer?.notes,
      1000,
    );

    const paymentMethod =
      body.paymentMethod;

    if (
      !fullName ||
      !phone ||
      !email ||
      !countryCode ||
      !countryName ||
      !city ||
      !addressLine1
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Complete all required customer and delivery fields.",
        },
        { status: 400 },
      );
    }

    if (!validCustomerEmail(email)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Enter a valid email address.",
        },
        { status: 400 },
      );
    }

    if (
      !/^\+?[0-9][0-9\s().-]{6,24}$/.test(phone)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Enter a valid international phone number including the country code where appropriate.",
        },
        { status: 400 },
      );
    }

    if (!/^[A-Z]{2}$/.test(countryCode)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Choose a valid delivery country.",
        },
        { status: 400 },
      );
    }

    const allowedLocalMethods: PaymentMethod[] = [
      "cash_on_delivery",
      "manual_mobile_money",
      "manual_bank_transfer",
    ];

    if (
      countryCode === "TZ" &&
      (
        !paymentMethod ||
        !allowedLocalMethods.includes(paymentMethod)
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Choose an available Tanzania payment method.",
        },
        { status: 400 },
      );
    }

    if (
      countryCode !== "TZ" &&
      paymentMethod !==
        "international_payment_request"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "International orders require the secure international payment-link method.",
        },
        { status: 400 },
      );
    }

    const quote = await quoteCheckout({
      countryCode,
      items: requestedItems,
    });

    const sql = catalogSql();
    const currentSession =
      await getCustomerSession();

    let customerId =
      currentSession?.customer.id || null;

    let newSessionToken: string | null =
      null;

    if (currentSession) {
      email = currentSession.customer.email;
    }

    if (
      !customerId &&
      body.createAccount
    ) {
      const password = String(
        body.password || "",
      );

      const passwordError =
        validateCustomerPassword(password);

      if (passwordError) {
        return NextResponse.json(
          {
            ok: false,
            error: passwordError,
          },
          { status: 400 },
        );
      }

      const existing = await sql`
        SELECT id
        FROM customers
        WHERE email = ${email}
        LIMIT 1
      `;

      if (existing[0]?.id) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "An account already exists for this email. Sign in before placing the order or continue as a guest.",
          },
          { status: 409 },
        );
      }

      customerId = randomUUID();

      await sql`
        INSERT INTO customers (
          id,
          email,
          full_name,
          phone,
          password_hash,
          country_code,
          preferred_currency,
          preferred_locale,
          status,
          created_at,
          updated_at
        )
        VALUES (
          ${customerId},
          ${email},
          ${fullName},
          ${phone},
          ${hashCustomerPassword(password)},
          ${quote.countryCode},
          ${quote.currency},
          ${quote.locale},
          'active',
          NOW(),
          NOW()
        )
      `;

      const session =
        await createCustomerSession(customerId);

      newSessionToken = session.token;

      await linkGuestOrders(
        customerId,
        email,
      );
    }

    const orderId = randomUUID();
    const paymentId = randomUUID();
    const orderNumber =
      createOrderNumber();

    const accessKey =
      randomBytes(24).toString("base64url");

    const shippingAddress = {
      recipientName: fullName,
      phone,
      countryCode: quote.countryCode,
      countryName: quote.countryName,
      region: region || null,
      city,
      postalCode: postalCode || null,
      addressLine1,
      addressLine2: addressLine2 || null,
    };

    const source = customerId
      ? "website_account"
      : "website_guest";

    const queries = [
      sql`
        INSERT INTO orders (
          id,
          order_number,
          customer_id,
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
          market_country_code,
          customer_locale,
          order_access_token_hash,
          source,
          customer_notes,
          created_at,
          updated_at
        )
        VALUES (
          ${orderId},
          ${orderNumber},
          ${customerId},
          ${fullName},
          ${phone},
          ${email},
          'pending_payment',
          ${quote.currency},
          ${quote.subtotal},
          ${quote.shippingFee},
          0,
          ${quote.total},
          ${quote.supplierCostTotal},
          ${JSON.stringify(shippingAddress)}::jsonb,
          ${quote.countryCode},
          ${quote.locale},
          ${hashOrderAccessKey(accessKey)},
          ${source},
          ${notes || null},
          NOW(),
          NOW()
        )
      `,

      sql`
        INSERT INTO payments (
          id,
          order_id,
          provider,
          status,
          amount,
          fee,
          currency,
          raw_response,
          created_at
        )
        VALUES (
          ${paymentId},
          ${orderId},
          ${paymentMethod},
          'pending',
          ${quote.total},
          0,
          ${quote.currency},
          ${JSON.stringify({
            source,
            countryCode: quote.countryCode,
            paymentMethod,
          })}::jsonb,
          NOW()
        )
      `,

      ...quote.items.map(
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

    if (customerId) {
      await Promise.all([
        updateCustomerProfile({
          customerId,
          fullName,
          phone,
          countryCode:
            quote.countryCode,
          currency:
            quote.currency,
          locale:
            quote.locale,
        }),

        saveDefaultCustomerAddress({
          customerId,
          recipientName: fullName,
          phone,
          countryCode:
            quote.countryCode,
          countryName:
            quote.countryName,
          region,
          city,
          postalCode,
          addressLine1,
          addressLine2,
        }),
      ]);
    }

    const response = NextResponse.json(
      {
        ok: true,
        orderNumber,
        accessKey,
        paymentMethod,
        currency: quote.currency,
        total: quote.total,
        status: "pending_payment",
        accountCreated:
          Boolean(newSessionToken),
      },
      { status: 201 },
    );

    if (newSessionToken) {
      setCustomerSessionCookie(
        response,
        newSessionToken,
      );
    }

    return response;
  }
  catch (error) {
    const status =
      error instanceof CheckoutQuoteError
        ? error.status
        : 500;

    console.error(
      "Create international order failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not create the order.",
      },
      { status },
    );
  }
}