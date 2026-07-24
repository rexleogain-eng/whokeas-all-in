import { neon } from "@neondatabase/serverless";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import OrderActions from "@/components/admin/OrderActions";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
      o.currency,
      o.total::text AS total,
      o.shipping_address AS "shippingAddress",
      o.source,
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
          Local and international payment verification
        </p>
        <h1 className="mt-2 text-4xl font-black">Orders</h1>

        {orders.length === 0 ? (
          <section className="mt-6 bg-white p-8 shadow-sm">
            No orders have been placed yet.
          </section>
        ) : (
          <div className="mt-6 space-y-4">
            {orders.map((order) => {
              const address = (order.shippingAddress ?? {}) as ShippingAddress;
              const stateProvince =
                address.stateProvince || address.region || "";
              const city = address.city || address.district || "";
              const country = address.country || "Tanzania";
              const isInternational =
                (address.countryCode || (country === "Tanzania" ? "TZ" : "")) !==
                "TZ";

              return (
                <article
                  key={String(order.orderNumber)}
                  className="grid gap-5 bg-white p-5 shadow-sm lg:grid-cols-[1fr_1fr_1fr]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-bold text-slate-500">
                        ORDER NUMBER
                      </p>
                      {isInternational && (
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-blue-800">
                          International
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-black">
                      {String(order.orderNumber)}
                    </p>
                    <p className="mt-3 text-sm text-slate-500">
                      {formatDate(String(order.createdAt))}
                    </p>
                    <p className="mt-3 text-2xl font-black text-[#b12704]">
                      {formatMoney(
                        String(order.total),
                        String(order.currency || "TZS"),
                      )}
                    </p>
                    <p className="mt-3 text-sm font-bold">
                      Order: {String(order.orderStatus).replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Source: {String(order.source || "website")}
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
                      {address.addressLine}
                      <br />
                      {city}
                      {address.ward ? `, ${address.ward}` : ""}
                      {address.postalCode ? `, ${address.postalCode}` : ""}
                      <br />
                      {stateProvince}
                      <br />
                      <strong>{country}</strong>
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
