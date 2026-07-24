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

type ShippingAddress = {
  country?: string;
  countryCode?: string;
  stateProvince?: string;
  city?: string;
  region?: string;
  district?: string;
  ward?: string;
  postalCode?: string;
  addressLine?: string;
};

function formatMoney(value: string | number, currency: string) {
  const amount = Number(value);

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "TZS" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-US")}`;
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
      o.customer_email AS "customerEmail",
      o.status::text AS status,
      o.currency,
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
        customerEmail: string | null;
        status: string;
        currency: string;
        total: string;
        shippingAddress: ShippingAddress;
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

  const address = order.shippingAddress ?? {};
  const stateProvince = address.stateProvince || address.region || "";
  const city = address.city || address.district || "";
  const country = address.country || "Tanzania";
  const countryCode = address.countryCode || (country === "Tanzania" ? "TZ" : "");
  const isInternational = countryCode !== "TZ";

  const mobileNumber =
    process.env.MOBILE_MONEY_NUMBER || "Configure MOBILE_MONEY_NUMBER";
  const mobileName =
    process.env.MOBILE_MONEY_NAME || "Configure MOBILE_MONEY_NAME";

  const localBankName = process.env.NMB_BANK_NAME || "NMB Bank Plc";
  const localBankAccount =
    process.env.NMB_ACCOUNT_NUMBER || "Configure NMB_ACCOUNT_NUMBER";
  const localBankAccountName =
    process.env.NMB_ACCOUNT_NAME || "Configure NMB_ACCOUNT_NAME";

  const internationalBankName =
    process.env.INTERNATIONAL_BANK_NAME || process.env.NMB_BANK_NAME || "";
  const internationalBankAccount =
    process.env.INTERNATIONAL_BANK_ACCOUNT_NUMBER ||
    process.env.NMB_ACCOUNT_NUMBER ||
    "";
  const internationalBankAccountName =
    process.env.INTERNATIONAL_BANK_ACCOUNT_NAME ||
    process.env.NMB_ACCOUNT_NAME ||
    "";
  const internationalBankSwift =
    process.env.INTERNATIONAL_BANK_SWIFT || "";
  const internationalBankIban =
    process.env.INTERNATIONAL_BANK_IBAN || "";

  const internationalInstructionsReady = Boolean(
    internationalBankName &&
      internationalBankAccount &&
      internationalBankAccountName &&
      internationalBankSwift,
  );

  const supportPhone =
    process.env.SUPPORT_PHONE || process.env.MOBILE_MONEY_NUMBER || "";
  const supportEmail = process.env.SUPPORT_EMAIL || "";

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
            Your order is recorded. Supplier fulfilment starts only after
            payment verification and destination delivery confirmation.
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
              <p className="text-xs font-bold text-slate-500">CURRENT TOTAL</p>
              <p className="mt-1 font-black">
                {formatMoney(order.total, order.currency)}
              </p>
            </div>
          </div>

          {isInternational && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              This is an international order to <strong>{country}</strong>.
              Final freight, customs responsibility, and delivery time must be
              confirmed before fulfilment.
            </div>
          )}

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
                      {formatMoney(String(item.lineTotal), order.currency)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-7 rounded-lg border border-slate-200 p-5">
                <h2 className="font-black">Delivery details</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {address.addressLine}
                  <br />
                  {city}
                  {address.ward ? `, ${address.ward}` : ""}
                  {address.postalCode ? `, ${address.postalCode}` : ""}
                  <br />
                  {stateProvince}
                  <br />
                  {country}
                </p>
                <p className="mt-4 text-sm">
                  <span className="font-bold">Phone:</span>{" "}
                  {order.customerPhone}
                </p>
                {order.customerEmail ? (
                  <p className="mt-1 text-sm">
                    <span className="font-bold">Email:</span>{" "}
                    {order.customerEmail}
                  </p>
                ) : null}
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
                    We will contact you to confirm delivery availability and
                    the final delivery charge. Pay when the product is
                    delivered.
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
                      {formatMoney(order.total, order.currency)}
                    </p>
                    <p className="mt-4 text-xs font-bold text-slate-500">
                      NUMBER
                    </p>
                    <p className="mt-1 text-lg font-black">{mobileNumber}</p>
                    <p className="mt-1 text-sm text-slate-600">{mobileName}</p>
                  </div>
                </div>
              )}

              {order.paymentProvider === "manual_bank_transfer" &&
                !isInternational && (
                  <div className="mt-4">
                    <h2 className="text-xl font-black">NMB Bank Transfer</h2>
                    <div className="mt-4 rounded-lg bg-slate-50 p-4">
                      <p className="text-sm">
                        <span className="font-bold">Bank:</span>{" "}
                        {localBankName}
                      </p>
                      <p className="mt-2 text-sm">
                        <span className="font-bold">Account:</span>{" "}
                        {localBankAccount}
                      </p>
                      <p className="mt-2 text-sm">
                        <span className="font-bold">Name:</span>{" "}
                        {localBankAccountName}
                      </p>
                      <p className="mt-4 text-sm">
                        Transfer exactly{" "}
                        <span className="font-black">
                          {formatMoney(order.total, order.currency)}
                        </span>
                        .
                      </p>
                    </div>
                  </div>
                )}

              {order.paymentProvider === "manual_bank_transfer" &&
                isInternational && (
                  <div className="mt-4">
                    <h2 className="text-xl font-black">
                      International Bank Transfer
                    </h2>

                    {internationalInstructionsReady ? (
                      <div className="mt-4 rounded-lg bg-slate-50 p-4">
                        <p className="text-sm">
                          <span className="font-bold">Bank:</span>{" "}
                          {internationalBankName}
                        </p>
                        <p className="mt-2 text-sm">
                          <span className="font-bold">Account:</span>{" "}
                          {internationalBankAccount}
                        </p>
                        <p className="mt-2 text-sm">
                          <span className="font-bold">Account name:</span>{" "}
                          {internationalBankAccountName}
                        </p>
                        <p className="mt-2 text-sm">
                          <span className="font-bold">SWIFT / BIC:</span>{" "}
                          {internationalBankSwift}
                        </p>
                        {internationalBankIban ? (
                          <p className="mt-2 text-sm">
                            <span className="font-bold">IBAN:</span>{" "}
                            {internationalBankIban}
                          </p>
                        ) : null}
                        <p className="mt-4 text-sm leading-6">
                          Use the order number{" "}
                          <span className="font-black">{order.orderNumber}</span>{" "}
                          as the payment narration. Transfer fees and any
                          currency-conversion costs are paid by the customer.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                        Do not transfer money yet. Support will confirm the
                        final delivery cost and send verified international
                        payment instructions.
                      </div>
                    )}
                  </div>
                )}

              {requiresReference &&
                (!isInternational || internationalInstructionsReady) && (
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
                    Support phone: {supportPhone}
                  </>
                ) : null}
                {supportEmail ? (
                  <>
                    <br />
                    Support email: {supportEmail}
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
