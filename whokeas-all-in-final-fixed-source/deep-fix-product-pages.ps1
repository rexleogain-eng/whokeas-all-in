$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json")) {
  throw "Run this inside C:\Users\Hp\Desktop\whokeas-all-in"
}

$utf8 = [System.Text.UTF8Encoding]::new($false)

New-Item -ItemType Directory -Force ".\src\db" | Out-Null
New-Item -ItemType Directory -Force ".\src\app\api\catalog-check" | Out-Null
New-Item -ItemType Directory -Force ".\src\app\products\[slug]" | Out-Null

$seed = @'
import { config } from "dotenv";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from .env.local");
}

const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

const categories = [
  ["Tech", "tech"],
  ["Study", "study"],
  ["Fashion", "fashion"],
  ["Home", "home"],
] as const;

for (const [name, slug] of categories) {
  await sql`
    INSERT INTO categories (name, slug, is_active, created_at)
    VALUES (${name}, ${slug}, true, NOW())
    ON CONFLICT (slug)
    DO UPDATE SET name = EXCLUDED.name, is_active = true
  `;
}

const products = [
  ["tech", "Wireless Earbuds", "wireless-earbuds", "Compact wireless audio for calls, music and travel.", "45000", "28000", true],
  ["tech", "Foldable Laptop Stand", "foldable-laptop-stand", "Portable adjustable support for work and study.", "39000", "24000", true],
  ["study", "Focus Study Lamp", "focus-study-lamp", "A compact desk light for focused evening study.", "32000", "19000", true],
  ["study", "Desk Organizer", "desk-organizer", "Keep study and office essentials arranged.", "29000", "17000", false],
  ["fashion", "WAI Signature Tee", "wai-signature-tee", "Original WHOKEAS ALL IN branded apparel.", "49000", "30000", true],
  ["home", "Smart Storage Set", "smart-storage-set", "Simple modular storage for everyday spaces.", "36000", "22000", false],
] as const;

for (const [categorySlug, name, slug, description, price, cost, featured] of products) {
  const [category] = await sql`
    SELECT id FROM categories WHERE slug = ${categorySlug} LIMIT 1
  `;

  if (!category?.id) {
    throw new Error(`Missing category ${categorySlug}`);
  }

  await sql`
    INSERT INTO products (
      category_id, name, slug, short_description, description, brand,
      status, base_cost, price, currency, is_featured, created_at, updated_at
    )
    VALUES (
      ${category.id}, ${name}, ${slug}, ${description}, ${description},
      'WHOKEAS ALL IN', 'active', ${cost}, ${price}, 'TZS',
      ${featured}, NOW(), NOW()
    )
    ON CONFLICT (slug)
    DO UPDATE SET
      category_id = EXCLUDED.category_id,
      name = EXCLUDED.name,
      short_description = EXCLUDED.short_description,
      description = EXCLUDED.description,
      brand = 'WHOKEAS ALL IN',
      status = 'active',
      base_cost = EXCLUDED.base_cost,
      price = EXCLUDED.price,
      currency = 'TZS',
      is_featured = EXCLUDED.is_featured,
      updated_at = NOW()
  `;
}

const variants = [
  ["wireless-earbuds", "Black", "WAI-EARBUD-BLK", 25],
  ["wireless-earbuds", "White", "WAI-EARBUD-WHT", 18],
  ["foldable-laptop-stand", "Silver", "WAI-STAND-SLV", 30],
  ["foldable-laptop-stand", "Black", "WAI-STAND-BLK", 22],
  ["wai-signature-tee", "Black / Small", "WAI-TEE-BLK-S", 12],
  ["wai-signature-tee", "Black / Medium", "WAI-TEE-BLK-M", 18],
] as const;

for (const [slug, name, sku, stock] of variants) {
  const [product] = await sql`
    SELECT id, price, base_cost FROM products WHERE slug = ${slug} LIMIT 1
  `;

  await sql`
    INSERT INTO product_variants (
      product_id, name, sku, options, cost, price,
      stock_quantity, is_active, created_at
    )
    VALUES (
      ${product.id}, ${name}, ${sku}, '{}'::jsonb,
      ${product.base_cost ?? 0}, ${product.price},
      ${stock}, true, NOW()
    )
    ON CONFLICT (sku)
    DO UPDATE SET
      product_id = EXCLUDED.product_id,
      name = EXCLUDED.name,
      price = EXCLUDED.price,
      stock_quantity = EXCLUDED.stock_quantity,
      is_active = true
  `;
}

const result = await sql`
  SELECT slug, name, status::text AS status
  FROM products
  ORDER BY name
`;

console.table(result);

if (!result.some((row) => row.slug === "wireless-earbuds" && row.status === "active")) {
  throw new Error("wireless-earbuds verification failed");
}

console.log("Catalogue force-seeded successfully.");
'@

$api = @'
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL missing");
    }

    const sql = neon(process.env.DATABASE_URL);

    const database = await sql`
      SELECT current_database() AS database_name, current_schema() AS schema_name
    `;

    const catalogue = await sql`
      SELECT slug, name, status::text AS status, price::text AS price
      FROM products
      ORDER BY name
    `;

    return NextResponse.json({
      ok: true,
      database: database[0],
      count: catalogue.length,
      catalogue,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
'@

$page = @'
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
'@

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\db\force-catalog.ts"),
  $seed,
  $utf8
)

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\app\api\catalog-check\route.ts"),
  $api,
  $utf8
)

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\app\products\[slug]\page.tsx"),
  $page,
  $utf8
)

Write-Host "Force-seeding the exact Neon database from .env.local..." -ForegroundColor Cyan
npx tsx .\src\db\force-catalog.ts

Remove-Item -Recurse -Force ".\.next" -ErrorAction SilentlyContinue

Write-Host "Running build verification..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "Deep product fix completed." -ForegroundColor Green
Write-Host "Run: npm run dev" -ForegroundColor Yellow
Write-Host "Then open: http://localhost:3000/api/catalog-check" -ForegroundColor Yellow
