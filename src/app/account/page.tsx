import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import AccountLogoutButton from "@/components/account/AccountLogoutButton";
import CustomerReferralCard from "@/components/growth/CustomerReferralCard";
import StoreHeader from "@/components/store/StoreHeader";

import {
  ensureCustomerSchema,
  getCustomerSession,
} from "@/lib/customer-auth";

import { catalogSql } from "@/lib/catalog-schema";
import {
  ensureGrowthSchema,
  getCustomerGrowthBenefits,
} from "@/lib/growth-revenue";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Customer Account",
  robots: {
    index: false,
    follow: false,
  },
};

function formatMoney(
  value: string | number,
  currency: string,
) {
  try {
    return new Intl.NumberFormat("en-US", {
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

function statusClass(status: string) {
  const value = status.toLowerCase();

  if (value.includes("deliver")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (value.includes("ship")) {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }

  if (
    value.includes("paid") ||
    value.includes("process")
  ) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (value.includes("cancel")) {
    return "border-red-200 bg-red-50 text-red-800";
  }

  return "border-[#d8cfbf] bg-[#f7f3eb] text-[#675f55]";
}

export default async function CustomerAccountPage() {
  await ensureCustomerSchema();
  await ensureGrowthSchema();

  const session = await getCustomerSession();

  if (!session) {
    redirect("/account/login");
  }

  const sql = catalogSql();

  const [orders, addresses, growth] = await Promise.all([
    sql`
      SELECT
        order_number AS "orderNumber",
        status::text AS status,
        currency,
        total::text AS total,
        shipping_address AS "shippingAddress",
        created_at AS "createdAt"
      FROM orders
      WHERE customer_id = ${session.customer.id}
      ORDER BY created_at DESC
      LIMIT 100
    `,

    sql`
      SELECT
        recipient_name AS "recipientName",
        phone,
        country_name AS "countryName",
        region,
        city,
        postal_code AS "postalCode",
        address_line_1 AS "addressLine1",
        address_line_2 AS "addressLine2"
      FROM customer_addresses
      WHERE customer_id = ${session.customer.id}
      ORDER BY
        is_default DESC,
        updated_at DESC
      LIMIT 1
    `,
    getCustomerGrowthBenefits(
      session.customer.id,
    ),
  ]);

  const address = addresses[0];

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader />

      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:py-14">
        <div className="flex flex-col gap-5 border-b border-[#d8cfbf] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="classic-kicker">
              Customer account
            </p>

            <h1 className="mt-3 text-4xl font-normal sm:text-5xl">
              Welcome, {session.customer.fullName}.
            </h1>

            <p className="mt-3 text-sm text-[#746d62]">
              {session.customer.email}
            </p>
          </div>

          <AccountLogoutButton />
        </div>

        {growth.referralCode && (
          <div className="mt-8">
            <CustomerReferralCard
              referralCode={
                growth.referralCode
              }
              referralLink={`https://www.whokeas.store/?ref=${encodeURIComponent(
                growth.referralCode,
              )}`}
              storeCreditBalance={
                growth.storeCreditBalance
              }
            />
          </div>
        )}

        <section className="mt-8 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="h-fit border border-[#d8cfbf] bg-[#fffdf8] p-6">
            <p className="classic-kicker">
              Default delivery address
            </p>

            {address ? (
              <div className="mt-5 text-sm leading-7 text-[#625b50]">
                <p className="font-bold text-[#1d1914]">
                  {String(address.recipientName)}
                </p>

                <p>{String(address.addressLine1)}</p>

                {address.addressLine2 && (
                  <p>{String(address.addressLine2)}</p>
                )}

                <p>
                  {[
                    address.city,
                    address.region,
                    address.postalCode,
                  ]
                    .filter(Boolean)
                    .map(String)
                    .join(", ")}
                </p>

                <p>{String(address.countryName)}</p>
                <p className="mt-3 font-semibold">
                  {String(address.phone)}
                </p>
              </div>
            ) : (
              <p className="mt-5 text-sm leading-6 text-[#746d62]">
                Your default address will be saved after
                your first signed-in checkout.
              </p>
            )}

            <Link
              href="/products"
              className="classic-button-dark mt-7"
            >
              Continue shopping
            </Link>
          </article>

          <article className="border border-[#d8cfbf] bg-[#fffdf8]">
            <div className="border-b border-[#d8cfbf] p-6">
              <p className="classic-kicker">
                Order history
              </p>

              <h2 className="mt-2 text-3xl font-normal">
                Your WHOKEAS orders
              </h2>
            </div>

            {orders.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm text-[#746d62]">
                  No account orders are recorded yet.
                </p>

                <Link
                  href="/products"
                  className="classic-button-dark mt-6"
                >
                  Browse products
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[#e4ddd2]">
                {orders.map((order) => {
                  const status = String(order.status);
                  const currency = String(
                    order.currency || "TZS",
                  );

                  const shippingAddress =
                    order.shippingAddress as {
                      countryName?: string;
                      country?: string;
                    };

                  return (
                    <div
                      key={String(order.orderNumber)}
                      className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Link
                            href={`/order-confirmation/${encodeURIComponent(
                              String(order.orderNumber),
                            )}`}
                            className="font-serif text-xl font-semibold hover:text-[#9b762c]"
                          >
                            {String(order.orderNumber)}
                          </Link>

                          <span
                            className={`border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${statusClass(status)}`}
                          >
                            {status.replaceAll("_", " ")}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-[#81796e]">
                          {new Intl.DateTimeFormat(
                            "en-US",
                            { dateStyle: "medium" },
                          ).format(
                            new Date(
                              String(order.createdAt),
                            ),
                          )}
                          {" · "}
                          {shippingAddress?.countryName ||
                            shippingAddress?.country ||
                            "Delivery country recorded"}
                        </p>
                      </div>

                      <p className="font-serif text-xl font-semibold">
                        {formatMoney(
                          String(order.total),
                          currency,
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
