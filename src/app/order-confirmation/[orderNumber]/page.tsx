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

function SuccessIcon() {
  return (
    <div
      aria-label="Order successful"
      className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
    >
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
          <SuccessIcon />

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
                        {item.variantName ? (
                          <>
                            <span>{String(item.variantName)}</span>
                            <span className="mx-2" aria-hidden="true">
                              -
                            </span>
                          </>
                        ) : null}
                        <span>Qty {Number(item.quantity)}</span>
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