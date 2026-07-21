import { neon } from "@neondatabase/serverless";
import Link from "next/link";
import { redirect } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatPrice(value: string | number) {
  return `TZS ${Number(value || 0).toLocaleString("en-US")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-TZ", {
    dateStyle: "medium",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(new Date(value));
}

export default async function AdminOverviewPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing");
  }

  const sql = neon(process.env.DATABASE_URL);

  const [productRows, orderRows, recentOrders] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status::text = 'active')::int AS active,
        COUNT(*) FILTER (WHERE status::text = 'draft')::int AS drafts,
        COUNT(*) FILTER (WHERE status::text = 'archived')::int AS archived
      FROM products
    `,
    sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE status::text IN ('pending_payment', 'pending')
        )::int AS pending,
        COUNT(*) FILTER (
          WHERE status::text IN ('processing', 'paid')
        )::int AS processing,
        COALESCE(SUM(total), 0)::text AS value
      FROM orders
    `,
    sql`
      SELECT
        order_number AS "orderNumber",
        customer_name AS "customerName",
        status::text AS status,
        total::text AS total,
        created_at AS "createdAt"
      FROM orders
      ORDER BY created_at DESC
      LIMIT 6
    `,
  ]);

  const productStats = productRows[0] ?? {
    total: 0,
    active: 0,
    drafts: 0,
    archived: 0,
  };
  const orderStats = orderRows[0] ?? {
    total: 0,
    pending: 0,
    processing: 0,
    value: "0",
  };

  const cards = [
    {
      label: "Catalogue",
      value: String(productStats.total),
      note: `${productStats.active} active · ${productStats.drafts} drafts`,
    },
    {
      label: "Orders",
      value: String(orderStats.total),
      note: `${orderStats.pending} awaiting payment`,
    },
    {
      label: "In progress",
      value: String(orderStats.processing),
      note: "Paid or processing orders",
    },
    {
      label: "Order value",
      value: formatPrice(String(orderStats.value)),
      note: "Gross value recorded",
    },
  ];

  return (
    <AdminShell
      active="overview"
      eyebrow="Executive overview"
      title="Your commerce control room"
      description="A concise view of catalogue health, customer orders and the actions that need your attention today."
      actions={
        <>
          <Link
            href="/admin/cj"
            className="border border-[#b9944d] bg-[#b9944d] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#171410]"
          >
            Source products
          </Link>
          <Link
            href="/admin/products"
            className="border border-[#2a261f] bg-[#2a261f] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white"
          >
            Manage catalogue
          </Link>
        </>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => (
          <article
            key={card.label}
            className="border border-[#d9d0c1] bg-[#fffdf9] p-5 shadow-[0_12px_40px_rgba(54,45,32,0.05)]"
          >
            <div className="flex items-start justify-between gap-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8e7650]">
                {card.label}
              </p>
              <span className="font-serif text-lg text-[#b9944d]">0{index + 1}</span>
            </div>
            <p className="mt-5 font-serif text-3xl font-semibold leading-none">
              {card.value}
            </p>
            <p className="mt-3 text-xs leading-5 text-[#746d63]">{card.note}</p>
          </article>
        ))}
      </section>

      <section className="mt-7 grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
        <article className="border border-[#d9d0c1] bg-[#fffdf9]">
          <div className="flex items-end justify-between gap-4 border-b border-[#e4ddd2] px-5 py-5 sm:px-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a7534]">
                Recent activity
              </p>
              <h2 className="mt-1 font-serif text-2xl font-semibold">Latest orders</h2>
            </div>
            <Link
              href="/admin/orders"
              className="text-xs font-black uppercase tracking-[0.16em] text-[#6d552b] underline decoration-[#b9944d] underline-offset-4"
            >
              View all
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-[#746d63]">
              No orders have been placed yet.
            </div>
          ) : (
            <div className="divide-y divide-[#e9e2d8]">
              {recentOrders.map((order) => (
                <div
                  key={String(order.orderNumber)}
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[1.2fr_1fr_auto] sm:items-center sm:px-6"
                >
                  <div>
                    <p className="font-semibold">{String(order.customerName)}</p>
                    <p className="mt-1 text-xs text-[#80786e]">
                      {String(order.orderNumber)} · {formatDate(String(order.createdAt))}
                    </p>
                  </div>
                  <span className="w-fit border border-[#d8cfbf] bg-[#f7f3eb] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#675f55]">
                    {String(order.status).replaceAll("_", " ")}
                  </span>
                  <p className="font-serif text-lg font-semibold">
                    {formatPrice(String(order.total))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </article>

        <aside className="border border-[#2b271f] bg-[#1a1712] p-6 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#d4b56f]">
            Priority desk
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold">
            Recommended next actions
          </h2>
          <div className="mt-6 space-y-3">
            <Link
              href="/admin/orders"
              className="block border border-white/15 p-4 transition hover:border-[#b9944d] hover:bg-white/[0.03]"
            >
              <span className="text-xs font-black uppercase tracking-[0.16em] text-[#d4b56f]">
                Review payments
              </span>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Confirm transaction references and advance paid orders.
              </p>
            </Link>
            <Link
              href="/admin/products"
              className="block border border-white/15 p-4 transition hover:border-[#b9944d] hover:bg-white/[0.03]"
            >
              <span className="text-xs font-black uppercase tracking-[0.16em] text-[#d4b56f]">
                Refine products
              </span>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Review drafts, pricing, images and stock before publication.
              </p>
            </Link>
            <Link
              href="/admin/cj"
              className="block border border-white/15 p-4 transition hover:border-[#b9944d] hover:bg-white/[0.03]"
            >
              <span className="text-xs font-black uppercase tracking-[0.16em] text-[#d4b56f]">
                Source inventory
              </span>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Search CJ and import carefully selected products as drafts.
              </p>
            </Link>
          </div>
        </aside>
      </section>
    </AdminShell>
  );
}
