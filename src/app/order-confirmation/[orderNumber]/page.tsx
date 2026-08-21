import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import PaymentReferenceForm from "@/components/payments/PaymentReferenceForm";
import StoreHeader from "@/components/store/StoreHeader";

import {
  ensureCustomerSchema,
  getCustomerSession,
  hashOrderAccessKey,
  safeEqualHex,
} from "@/lib/customer-auth";

import { catalogSql } from "@/lib/catalog-schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Order Confirmation",
  robots: {
    index: false,
    follow: false,
  },
};

type PageProps = {
  params: Promise<{
    orderNumber: string;
  }>;

  searchParams: Promise<{
    key?: string;
  }>;
};

function formatMoney(
  value: string | number,
  currency: string,
  locale: string,
) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits:
        currency === "TZS" ? 0 : 2,
    }).format(Number(value || 0));
  }
  catch {
    return `${currency} ${Number(value || 0).toLocaleString("en-US")}`;
  }
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

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: PageProps) {
  await ensureCustomerSchema();

  const [
    { orderNumber: rawOrderNumber },
    query,
  ] = await Promise.all([
    params,
    searchParams,
  ]);

  const orderNumber =
    decodeURIComponent(rawOrderNumber)
      .trim()
      .toUpperCase();

  const accessKey =
    typeof query.key === "string"
      ? query.key.trim().slice(0, 200)
      : "";

  const sql = catalogSql();

  const orders = await sql`
    SELECT
      order_record.id::text AS id,
      order_record.order_number AS "orderNumber",
      order_record.customer_id::text AS "customerId",
      order_record.customer_name AS "customerName",
      order_record.customer_phone AS "customerPhone",
      order_record.customer_email AS "customerEmail",
      order_record.status::text AS status,
      order_record.currency,
      order_record.customer_locale AS locale,
      order_record.total::text AS total,
      order_record.shipping_address AS "shippingAddress",
      order_record.order_access_token_hash AS "accessHash",

      payment.provider AS "paymentProvider",
      payment.provider_reference AS "paymentReference",
      payment.status::text AS "paymentStatus"

    FROM orders order_record

    LEFT JOIN LATERAL (
      SELECT
        provider,
        provider_reference,
        status
      FROM payments
      WHERE order_id = order_record.id
      ORDER BY created_at DESC
      LIMIT 1
    ) payment ON TRUE

    WHERE order_record.order_number = ${orderNumber}
    LIMIT 1
  `;

  const order = orders[0];

  if (!order?.id) {
    notFound();
  }

  const session =
    await getCustomerSession();

  const sessionAllowed =
    session?.customer.id &&
    order.customerId &&
    session.customer.id ===
      String(order.customerId);

  const keyAllowed =
    accessKey &&
    safeEqualHex(
      String(order.accessHash || ""),
      hashOrderAccessKey(accessKey),
    );

  if (!sessionAllowed && !keyAllowed) {
    notFound();
  }

  const items = await sql`
    SELECT
      product_name AS "productName",
      variant_name AS "variantName",
      quantity,
      line_total::text AS "lineTotal"
    FROM order_items
    WHERE order_id = ${String(order.id)}
    ORDER BY product_name
  `;

  const shippingAddress =
    order.shippingAddress as {
      countryCode?: string;
      countryName?: string;
      region?: string;
      city?: string;
      postalCode?: string;
      addressLine1?: string;
      addressLine2?: string;
    };

  const currency = String(
    order.currency || "TZS",
  );

  const locale = String(
    order.locale ||
      (
        shippingAddress?.countryCode === "TZ"
          ? "en-TZ"
          : "en-US"
      ),
  );

  const mobileNumber =
    process.env.MOBILE_MONEY_NUMBER ||
    "Configure MOBILE_MONEY_NUMBER";

  const mobileName =
    process.env.MOBILE_MONEY_NAME ||
    "Configure MOBILE_MONEY_NAME";

  const nmbAccount =
    process.env.NMB_ACCOUNT_NUMBER ||
    "Configure NMB_ACCOUNT_NUMBER";

  const nmbName =
    process.env.NMB_ACCOUNT_NAME ||
    "Configure NMB_ACCOUNT_NAME";

  const bankName =
    process.env.NMB_BANK_NAME ||
    "NMB Bank Plc";

  const supportPhone =
    process.env.SUPPORT_PHONE ||
    process.env.MOBILE_MONEY_NUMBER ||
    "";

  const requiresReference =
    order.paymentProvider ===
      "manual_mobile_money" ||
    order.paymentProvider ===
      "manual_bank_transfer";

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader />

      <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
        <section className="border border-[#d8cfbf] bg-[#fffdf8] p-7 shadow-[0_18px_55px_rgba(39,31,21,.06)] sm:p-10">
          <SuccessIcon />

          <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-emerald-700">
            Order created successfully
          </p>

          <h1 className="mt-2 text-4xl font-normal sm:text-5xl">
            Thank you, {String(order.customerName)}.
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-[#6f675c]">
            Your order is protected by a private account
            session or secure guest link. Supplier fulfilment
            begins after payment verification.
          </p>

          <div className="mt-7 grid gap-4 border border-[#d8cfbf] bg-[#f7f2e9] p-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold text-[#81796e]">
                ORDER NUMBER
              </p>

              <p className="mt-1 font-black">
                {String(order.orderNumber)}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold text-[#81796e]">
                STATUS
              </p>

              <p className="mt-1 font-black text-[#9b762c]">
                {String(order.status).replaceAll("_", " ")}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold text-[#81796e]">
                TOTAL
              </p>

              <p className="mt-1 font-black">
                {formatMoney(
                  String(order.total),
                  currency,
                  locale,
                )}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
            <div>
              <h2 className="text-2xl font-black">
                Items ordered
              </h2>

              <div className="mt-4 divide-y divide-[#ded5c7] border-y border-[#d8cfbf]">
                {items.map((item) => (
                  <div
                    key={`${item.productName}-${item.variantName || ""}`}
                    className="flex justify-between gap-4 py-4"
                  >
                    <div>
                      <p className="font-bold">
                        {String(item.productName)}
                      </p>

                      <p className="mt-1 text-sm text-[#81796e]">
                        {item.variantName
                          ? `${String(item.variantName)} · `
                          : ""}
                        Qty {Number(item.quantity)}
                      </p>
                    </div>

                    <p className="font-bold">
                      {formatMoney(
                        String(item.lineTotal),
                        currency,
                        locale,
                      )}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-7 border border-[#d8cfbf] p-5">
                <h2 className="font-black">
                  International delivery details
                </h2>

                <p className="mt-3 text-sm leading-7 text-[#6f675c]">
                  {shippingAddress?.addressLine1}

                  {shippingAddress?.addressLine2
                    ? (
                        <>
                          <br />
                          {shippingAddress.addressLine2}
                        </>
                      )
                    : null}

                  <br />

                  {[
                    shippingAddress?.city,
                    shippingAddress?.region,
                    shippingAddress?.postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ")}

                  <br />

                  {shippingAddress?.countryName ||
                    shippingAddress?.countryCode ||
                    "Delivery country"}
                </p>

                <p className="mt-4 text-sm">
                  <span className="font-bold">
                    Phone:
                  </span>{" "}
                  {String(order.customerPhone)}
                </p>

                <p className="mt-1 text-sm">
                  <span className="font-bold">
                    Email:
                  </span>{" "}
                  {String(order.customerEmail)}
                </p>
              </div>
            </div>

            <aside className="h-fit border border-[#cfc4b1] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#81796e]">
                Payment instructions
              </p>

              {order.paymentProvider ===
                "cash_on_delivery" && (
                <div className="mt-4">
                  <h2 className="text-xl font-black">
                    Cash on Delivery
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-[#6f675c]">
                    WHOKEAS will contact you to confirm
                    delivery and collection availability.
                  </p>
                </div>
              )}

              {order.paymentProvider ===
                "manual_mobile_money" && (
                <div className="mt-4">
                  <h2 className="text-xl font-black">
                    Mobile Money
                  </h2>

                  <div className="mt-4 bg-[#f3ead9] p-4">
                    <p className="text-xs font-bold text-[#81796e]">
                      SEND EXACTLY
                    </p>

                    <p className="mt-1 text-2xl font-black">
                      {formatMoney(
                        String(order.total),
                        currency,
                        locale,
                      )}
                    </p>

                    <p className="mt-4 text-xs font-bold text-[#81796e]">
                      NUMBER
                    </p>

                    <p className="mt-1 text-lg font-black">
                      {mobileNumber}
                    </p>

                    <p className="mt-1 text-sm text-[#6f675c]">
                      {mobileName}
                    </p>
                  </div>
                </div>
              )}

              {order.paymentProvider ===
                "manual_bank_transfer" && (
                <div className="mt-4">
                  <h2 className="text-xl font-black">
                    NMB Bank Transfer
                  </h2>

                  <div className="mt-4 bg-[#f7f2e9] p-4">
                    <p className="text-sm">
                      <span className="font-bold">
                        Bank:
                      </span>{" "}
                      {bankName}
                    </p>

                    <p className="mt-2 text-sm">
                      <span className="font-bold">
                        Account:
                      </span>{" "}
                      {nmbAccount}
                    </p>

                    <p className="mt-2 text-sm">
                      <span className="font-bold">
                        Name:
                      </span>{" "}
                      {nmbName}
                    </p>
                  </div>
                </div>
              )}

              {order.paymentProvider ===
                "international_payment_request" && (
                <div className="mt-4">
                  <h2 className="text-xl font-black">
                    Secure International Payment
                  </h2>

                  <div className="mt-4 border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm leading-6 text-blue-900">
                      A secure online payment link will be
                      sent to{" "}
                      <strong>
                        {String(order.customerEmail)}
                      </strong>{" "}
                      after the delivery and supplier details
                      are confirmed.
                    </p>
                  </div>
                </div>
              )}

              {requiresReference && (
                <PaymentReferenceForm
                  orderNumber={String(order.orderNumber)}
                  existingReference={
                    order.paymentReference
                      ? String(order.paymentReference)
                      : null
                  }
                  accessKey={accessKey}
                />
              )}

              <div className="mt-5 border-t border-[#d8cfbf] pt-4 text-xs leading-5 text-[#81796e]">
                Payment status:{" "}
                {String(
                  order.paymentStatus || "pending",
                )}

                {supportPhone ? (
                  <>
                    <br />
                    Support: {supportPhone}
                  </>
                ) : null}
              </div>
            </aside>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="classic-button-dark"
            >
              Continue shopping
            </Link>

            {sessionAllowed && (
              <Link
                href="/account"
                className="classic-button-light"
              >
                Open my account
              </Link>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
