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

import {
  calculateGrowthAdjustments,
  ensureGrowthSchema,
  GrowthPricingError,
} from "@/lib/growth-revenue";

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
  promotionCode?: string;
  attributionCode?: string;
  storeCreditRequested?: number;
  abandonedToken?: string | null;
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
    await ensureGrowthSchema();

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

    if (
      countryCode === "TZ" &&
      !/^\d{5}$/.test(postalCode)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Enter the exact five-digit Tanzania postcode for the delivery ward.",
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

    const growth =
      await calculateGrowthAdjustments({
        subtotal: quote.subtotal,
        totalBeforeGrowth: quote.total,
        supplierCostTotal:
          quote.supplierCostTotal,
        currency: quote.currency,
        promotionCode:
          body.promotionCode,
        attributionCode:
          body.attributionCode,
        customerId,
        customerEmail: email,
        storeCreditRequested:
          customerId
            ? Number(
                body.storeCreditRequested ||
                  0,
              )
            : 0,
      });

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
          coupon_code,
          attribution_code,
          affiliate_id,
          referrer_customer_id,
          store_credit_used,
          growth_metadata,
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
          ${growth.discountAmount},
          ${growth.total},
          ${quote.supplierCostTotal},
          ${growth.couponCode},
          ${
            growth.affiliateCode ||
            growth.referralCode ||
            growth.promotionCode
          },
          ${growth.affiliateId},
          ${growth.referrerCustomerId},
          ${growth.storeCreditUsed},
          ${JSON.stringify({
            couponDiscount:
              growth.couponDiscount,
            referralDiscount:
              growth.referralDiscount,
            storeCreditUsed:
              growth.storeCreditUsed,
            affiliateCode:
              growth.affiliateCode,
            referralCode:
              growth.referralCode,
          })}::jsonb,
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
          ${growth.total},
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

      ...(growth.couponId
        ? [
            sql`
              INSERT INTO growth_coupon_redemptions (
                id,
                coupon_id,
                order_id,
                customer_id,
                customer_email,
                amount,
                currency,
                status,
                created_at,
                updated_at
              )
              VALUES (
                ${randomUUID()},
                ${growth.couponId},
                ${orderId},
                ${customerId},
                ${email},
                ${growth.couponDiscount},
                ${quote.currency},
                'reserved',
                NOW(),
                NOW()
              )
            `,
          ]
        : []),

      ...(growth.affiliateId
        ? [
            sql`
              INSERT INTO growth_affiliate_commissions (
                id,
                affiliate_id,
                order_id,
                order_number,
                revenue_amount,
                commission_rate,
                commission_amount,
                currency,
                status,
                created_at,
                updated_at
              )
              VALUES (
                ${randomUUID()},
                ${growth.affiliateId},
                ${orderId},
                ${orderNumber},
                ${growth.total},
                ${growth.affiliateRate},
                ${
                  Math.round(
                    growth.total *
                      (
                        growth.affiliateRate /
                        100
                      ) *
                      100,
                  ) / 100
                },
                ${quote.currency},
                'pending_payment',
                NOW(),
                NOW()
              )
            `,
          ]
        : []),

      ...(growth.referrerCustomerId
        ? [
            sql`
              INSERT INTO growth_referral_claims (
                id,
                referrer_customer_id,
                referred_customer_id,
                referred_email,
                order_id,
                order_number,
                discount_amount,
                reward_amount,
                currency,
                status,
                created_at,
                updated_at
              )
              VALUES (
                ${randomUUID()},
                ${growth.referrerCustomerId},
                ${customerId},
                ${email},
                ${orderId},
                ${orderNumber},
                ${growth.referralDiscount},
                ${growth.referralReward},
                ${quote.currency},
                'pending_payment',
                NOW(),
                NOW()
              )
            `,
          ]
        : []),

      ...(customerId &&
      growth.storeCreditUsed > 0
        ? [
            sql`
              INSERT INTO growth_store_credit_transactions (
                id,
                customer_id,
                order_id,
                amount,
                currency,
                kind,
                status,
                description,
                created_at,
                updated_at
              )
              VALUES (
                ${randomUUID()},
                ${customerId},
                ${orderId},
                ${-growth.storeCreditUsed},
                ${quote.currency},
                'order_redemption',
                'pending',
                'WHOKEAS store credit reserved for ' ||
                  ${orderNumber},
                NOW(),
                NOW()
              )
            `,
          ]
        : []),
    ];

    await sql.transaction(queries);

    const abandonedToken =
      clean(body.abandonedToken, 64);

    if (abandonedToken) {
      await sql`
        UPDATE growth_abandoned_checkouts
        SET
          status = 'recovered',
          order_id = ${orderId},
          recovered_at = NOW(),
          last_seen_at = NOW()
        WHERE recovery_token =
          ${abandonedToken}
          AND status IN (
            'open',
            'contacted'
          )
      `;
    }

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
        total: growth.total,
        discountAmount:
          growth.discountAmount,
        storeCreditUsed:
          growth.storeCreditUsed,
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
    const rawMessage =
      error instanceof Error
        ? error.message
        : "Could not create the order.";

    const referralConflict =
      /growth_referral_(customer|email)_uidx|duplicate key/i.test(
        rawMessage,
      );

    const protectedGrowthConflict =
      /coupon usage limit|coupon customer usage|insufficient whokeas store credit/i.test(
        rawMessage,
      );

    const status =
      error instanceof CheckoutQuoteError ||
      error instanceof GrowthPricingError
        ? error.status
        : referralConflict ||
            protectedGrowthConflict
          ? 409
          : 500;

    console.error(
      "Create international order failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: referralConflict
          ? "Referral discounts are available only on a customer's first order."
          : protectedGrowthConflict
            ? rawMessage
            : status === 500
              ? "Could not create the order. Please try again."
              : rawMessage,
      },
      { status },
    );
  }
}