import { neon } from "@neondatabase/serverless";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import AddToCart from "@/components/store/AddToCart";
import CartButton from "@/components/store/CartButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }>;
};

function formatPrice(value: string) {
  return `TZS ${Number(value).toLocaleString("en-US")}`;
}

export default async function ProductPage({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).trim().toLowerCase();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing");
  }

  const sql = neon(process.env.DATABASE_URL);

  const rows = await sql`
    SELECT
      p.id,
      p.name,
      p.slug,
      p.short_description AS "shortDescription",
      p.description,
      p.price::text AS price,
      p.brand,
      c.name AS "categoryName"
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE LOWER(TRIM(p.slug)) = ${slug}
      AND p.status::text = 'active'
    LIMIT 1
  `;

  const product = rows[0] as
    | {
        id: string;
        name: string;
        slug: string;
        shortDescription: string | null;
        description: string | null;
        price: string;
        brand: string | null;
        categoryName: string | null;
      }
    | undefined;

  if (!product) {
    notFound();
  }

  const variants = (await sql`
    SELECT
      id,
      name,
      price::text AS price,
      stock_quantity AS "stockQuantity"
    FROM product_variants
    WHERE product_id = ${product.id}
      AND is_active = true
    ORDER BY name
  `) as Array<{
    id: string;
    name: string;
    price: string;
    stockQuantity: number;
  }>;

  return (
    <main className="min-h-screen bg-[#eaeded] text-[#0f1111]">
      <header className="bg-[#101820] text-white shadow-md">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-4 px-4">
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
            <div className="hidden sm:block">
              <div className="font-black tracking-[0.12em]">WHOKEAS</div>
              <div className="text-[10px] font-black tracking-[0.3em] text-[#f3b61f]">
                ALL IN
              </div>
            </div>
          </Link>

          <div className="flex-1" />
          <CartButton />
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-6">
        <section className="grid gap-8 bg-white p-6 shadow-sm lg:grid-cols-[1fr_1fr_330px]">
          <div className="relative flex aspect-square items-center justify-center rounded-lg bg-gradient-to-br from-slate-50 to-amber-100">
            <div className="relative h-44 w-72">
              <Image
                src="/brand/logo-mark.png"
                alt=""
                fill
                sizes="288px"
                className="object-contain opacity-80"
              />
            </div>
          </div>

          <div>
            <p className="text-sm text-[#007185]">
              {product.brand ?? "WHOKEAS ALL IN"}
            </p>
            <h1 className="mt-2 text-3xl font-medium">{product.name}</h1>
            <p className="mt-4 border-y border-slate-200 py-4 text-3xl text-[#b12704]">
              {formatPrice(product.price)}
            </p>

            <h2 className="mt-6 font-black">About this item</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">
              <li>{product.shortDescription}</li>
              <li>Category: {product.categoryName ?? "General"}</li>
              <li>Pricing displayed in Tanzanian shillings.</li>
              <li>Sold through WHOKEAS ALL IN.</li>
            </ul>
          </div>

          <aside className="h-fit rounded-xl border border-slate-300 p-5">
            <p className="text-2xl">{formatPrice(product.price)}</p>
            <p className="mt-4 text-emerald-700">Available to order</p>
            <div className="mt-5">
              <AddToCart
                product={{
                  id: product.id,
                  slug: product.slug,
                  name: product.name,
                  price: product.price,
                }}
                variants={variants}
              />
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}