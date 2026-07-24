import { neon } from "@neondatabase/serverless";
import Link from "next/link";
import { redirect } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import OrderActions from "@/components/admin/OrderActions";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-TZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(new Date(value));
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
    value.includes("process") ||
    value.includes("paid")
  ) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (value.includes("cancel")) {
    return "border-red-200 bg-red-50 text-red-800";
  }

  return "border-[#d8cfbf] bg-[#f7f3eb] text-[#675f55]";
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
      order_record.order_number AS "orderNumber",
      order_record.customer_name AS "customerName",
      order_record.customer_phone AS "customerPhone",
      order_record.customer_email AS "customerEmail",
      order_record.status::text AS "orderStatus",
      order_record.currency,
      order_record.total::text AS total,
      order_record.shipping_address AS "shippingAddress",
      order_record.created_at AS "createdAt",

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

    ORDER BY order_record.created_at DESC
    LIMIT 200
  `;

  const pending = orders.filter((order) =>
    [
      "pending",
      "pending_payment",
    ].includes(String(order.orderStatus)),
  ).length;

  const processing = orders.filter((order) =>
    [
      "processing",
      "paid",
    ].includes(String(order.orderStatus)),
  ).length;

  const delivered = orders.filter((order) =>
    String(order.orderStatus)
      .includes("delivered"),
  ).length;

  const international = orders.filter((order) => {
    const address =
      order.shippingAddress as {
        countryCode?: string;
      };

    return (
      address?.countryCode &&
      address.countryCode !== "TZ"
    );
  }).length;

  return (
    <AdminShell
      active="orders"
      eyebrow="Order operations"
      title="Local and international order control"
      description="Verify customer payments, monitor international fulfilment and keep every order moving through a clear workflow."
      actions={
        <Link
          href="/admin/products"
          className="border border-[#2a261f] bg-[#2a261f] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white"
        >
          Manage products
        </Link>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            "Awaiting payment",
            pending,
            "Requires verification",
          ],

          [
            "In progress",
            processing,
            "Paid or processing",
          ],

          [
            "Delivered",
            delivered,
            "Completed successfully",
          ],

          [
            "International",
            international,
            `${orders.length} total recorded orders`,
          ],
        ].map(
          ([label, value, note], index) => (
            <article
              key={String(label)}
              className="border border-[#d9d0c1] bg-[#fffdf9] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8e7650]">
                  {label}
                </p>

                <span className="font-serif text-lg text-[#b9944d]">
                  0{index + 1}
                </span>
              </div>

              <p className="mt-5 font-serif text-3xl font-semibold leading-none">
                {value}
              </p>

              <p className="mt-3 text-xs leading-5 text-[#746d63]">
                {note}
              </p>
            </article>
          ),
        )}
      </section>

      {orders.length === 0 ? (
        <section className="mt-7 border border-dashed border-[#cabfae] bg-[#fffdf9] px-6 py-16 text-center">
          <p className="classic-kicker">
            Order desk
          </p>

          <h2 className="mt-3 font-serif text-3xl font-semibold">
            No orders yet
          </h2>
        </section>
      ) : (
        <section className="mt-7 space-y-4">
          {orders.map((order) => {
            const address =
              order.shippingAddress as {
                countryCode?: string;
                countryName?: string;
                region?: string;
                city?: string;
                postalCode?: string;
                addressLine1?: string;
                addressLine2?: string;
              };

            const orderStatus =
              String(order.orderStatus);

            const paymentStatus =
              String(
                order.paymentStatus || "pending",
              );

            const currency =
              String(order.currency || "TZS");

            return (
              <article
                key={String(order.orderNumber)}
                className="overflow-hidden border border-[#d9d0c1] bg-[#fffdf9]"
              >
                <div className="flex flex-col gap-4 border-b border-[#e4ddd2] bg-[#faf7f1] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-serif text-xl font-semibold">
                      {String(order.orderNumber)}
                    </p>

                    <span
                      className={`border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${statusClass(orderStatus)}`}
                    >
                      {orderStatus.replaceAll("_", " ")}
                    </span>
                  </div>

                  <div className="flex items-center gap-5">
                    <p className="text-xs text-[#7d7468]">
                      {formatDate(
                        String(order.createdAt),
                      )}
                    </p>

                    <p className="font-serif text-xl font-semibold">
                      {formatMoney(
                        String(order.total),
                        currency,
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid gap-0 lg:grid-cols-[1fr_1fr_1.15fr]">
                  <div className="border-b border-[#e4ddd2] p-5 sm:p-6 lg:border-b-0 lg:border-r">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7534]">
                      Customer
                    </p>

                    <h3 className="mt-3 font-serif text-2xl font-semibold">
                      {String(order.customerName)}
                    </h3>

                    <p className="mt-3 text-sm font-semibold">
                      {String(order.customerPhone)}
                    </p>

                    {order.customerEmail && (
                      <p className="mt-1 break-all text-sm text-[#746d63]">
                        {String(order.customerEmail)}
                      </p>
                    )}
                  </div>

                  <div className="border-b border-[#e4ddd2] p-5 sm:p-6 lg:border-b-0 lg:border-r">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7534]">
                      Delivery
                    </p>

                    <p className="mt-3 text-sm leading-7 text-[#625b52]">
                      {address?.addressLine1 ||
                        "Address not supplied"}

                      {address?.addressLine2 ? (
                        <>
                          <br />
                          {address.addressLine2}
                        </>
                      ) : null}

                      <br />

                      {[
                        address?.city,
                        address?.region,
                        address?.postalCode,
                      ]
                        .filter(Boolean)
                        .join(", ") ||
                        "City not supplied"}

                      <br />

                      {address?.countryName ||
                        address?.countryCode ||
                        "Country not supplied"}
                    </p>
                  </div>

                  <div className="p-5 sm:p-6">
                    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8e7650]">
                          Method
                        </p>

                        <p className="mt-2 text-sm font-semibold">
                          {order.paymentProvider
                            ? String(
                                order.paymentProvider,
                              ).replaceAll("_", " ")
                            : "Not recorded"}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8e7650]">
                          Reference
                        </p>

                        <p className="mt-2 break-all text-sm font-semibold">
                          {order.paymentReference
                            ? String(
                                order.paymentReference,
                              )
                            : "Not submitted"}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8e7650]">
                          Payment
                        </p>

                        <span
                          className={`mt-2 inline-flex border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusClass(paymentStatus)}`}
                        >
                          {paymentStatus.replaceAll(
                            "_",
                            " ",
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-[#e4ddd2] pt-5">
                      <OrderActions
                        orderNumber={String(
                          order.orderNumber,
                        )}
                      />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </AdminShell>
  );
}