$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json")) {
  throw "Run this script inside C:\Users\Hp\Desktop\whokeas-all-in"
}

$utf8 = [System.Text.UTF8Encoding]::new($false)

Write-Host "Installing the seed runner..." -ForegroundColor Cyan
npm install -D tsx

New-Item -ItemType Directory -Force ".\src\db" | Out-Null

$seed = @'
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { categories, products } from "./schema";

async function seed() {
  await db
    .insert(categories)
    .values([
      {
        name: "Tech",
        slug: "tech",
        description: "Technology and useful digital accessories.",
      },
      {
        name: "Study",
        slug: "study",
        description: "Study tools and productivity essentials.",
      },
      {
        name: "Fashion",
        slug: "fashion",
        description: "Style, apparel and WHOKEAS originals.",
      },
      {
        name: "Home",
        slug: "home",
        description: "Useful products for modern homes.",
      },
    ])
    .onConflictDoNothing({ target: categories.slug });

  const allCategories = await db.select().from(categories);
  const categoryId = Object.fromEntries(
    allCategories.map((category) => [category.slug, category.id]),
  );

  await db
    .insert(products)
    .values([
      {
        categoryId: categoryId.tech,
        name: "Wireless Earbuds",
        slug: "wireless-earbuds",
        shortDescription: "Compact wireless audio for calls, music and travel.",
        status: "active",
        price: "45000",
        baseCost: "28000",
        currency: "TZS",
        isFeatured: true,
      },
      {
        categoryId: categoryId.tech,
        name: "Foldable Laptop Stand",
        slug: "foldable-laptop-stand",
        shortDescription: "Portable adjustable support for work and study.",
        status: "active",
        price: "39000",
        baseCost: "24000",
        currency: "TZS",
        isFeatured: true,
      },
      {
        categoryId: categoryId.study,
        name: "Focus Study Lamp",
        slug: "focus-study-lamp",
        shortDescription: "A compact desk light for focused evening study.",
        status: "active",
        price: "32000",
        baseCost: "19000",
        currency: "TZS",
        isFeatured: true,
      },
      {
        categoryId: categoryId.study,
        name: "Desk Organizer",
        slug: "desk-organizer",
        shortDescription: "Keep study and office essentials arranged.",
        status: "active",
        price: "29000",
        baseCost: "17000",
        currency: "TZS",
        isFeatured: false,
      },
      {
        categoryId: categoryId.fashion,
        name: "WAI Signature Tee",
        slug: "wai-signature-tee",
        shortDescription: "Original WHOKEAS ALL IN branded apparel.",
        status: "active",
        price: "49000",
        baseCost: "30000",
        currency: "TZS",
        isFeatured: true,
      },
      {
        categoryId: categoryId.home,
        name: "Smart Storage Set",
        slug: "smart-storage-set",
        shortDescription: "Simple modular storage for everyday spaces.",
        status: "active",
        price: "36000",
        baseCost: "22000",
        currency: "TZS",
        isFeatured: false,
      },
    ])
    .onConflictDoNothing({ target: products.slug });

  const total = await db.select().from(products);

  console.log(`Seed completed. ${total.length} products are available.`);
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
'@

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\db\seed.ts"),
  $seed,
  $utf8
)

$page = @'
import { desc, eq } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { categories, products as productsTable } from "@/db/schema";

const departments = [
  "Today's Deals",
  "Tech",
  "Study",
  "Fashion",
  "Home",
  "New Arrivals",
  "Best Sellers",
  "Customer Service",
];

const categoryCards = [
  {
    title: "Tech essentials",
    subtitle: "Smart accessories for work and everyday use",
    tone: "from-sky-100 to-blue-200",
    items: ["Phones", "Audio", "Computing", "Accessories"],
  },
  {
    title: "Study and productivity",
    subtitle: "Tools for students and focused professionals",
    tone: "from-amber-50 to-orange-200",
    items: ["Desk setup", "Stationery", "Lighting", "Bags"],
  },
  {
    title: "Style and originals",
    subtitle: "WHOKEAS ALL IN branded products",
    tone: "from-zinc-100 to-zinc-300",
    items: ["T-shirts", "Hoodies", "Caps", "Bags"],
  },
  {
    title: "Home and lifestyle",
    subtitle: "Useful products selected for modern living",
    tone: "from-emerald-50 to-emerald-200",
    items: ["Kitchen", "Storage", "Decor", "Daily use"],
  },
];

function formatPrice(value: string) {
  return `TZS ${Number(value).toLocaleString("en-US")}`;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H7" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </svg>
  );
}

function ProductVisual({
  label,
  index,
}: {
  label: string;
  index: number;
}) {
  const tones = [
    "from-sky-100 to-blue-200",
    "from-amber-100 to-yellow-200",
    "from-emerald-100 to-teal-200",
    "from-rose-100 to-pink-200",
    "from-violet-100 to-purple-200",
    "from-zinc-100 to-zinc-300",
  ];

  return (
    <div className={`flex aspect-square items-center justify-center rounded-lg bg-gradient-to-br ${tones[index % tones.length]} p-4`}>
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-black/10 bg-white/75 px-2 text-center text-xs font-black uppercase tracking-wide text-slate-700 shadow-sm">
        {label}
      </div>
    </div>
  );
}

export default async function Home() {
  const storeProducts = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      slug: productsTable.slug,
      price: productsTable.price,
      description: productsTable.shortDescription,
      featured: productsTable.isFeatured,
      category: categories.name,
    })
    .from(productsTable)
    .leftJoin(categories, eq(productsTable.categoryId, categories.id))
    .where(eq(productsTable.status, "active"))
    .orderBy(desc(productsTable.isFeatured), desc(productsTable.createdAt))
    .limit(12);

  const featuredProducts = storeProducts.filter((product) => product.featured);
  const dealProducts =
    featuredProducts.length > 0
      ? featuredProducts.slice(0, 6)
      : storeProducts.slice(0, 6);

  const recommendedProducts = storeProducts.slice(0, 6);

  return (
    <main className="min-h-screen bg-[#eaeded] text-[#0f1111]">
      <header className="sticky top-0 z-50 shadow-md">
        <div className="bg-[#101820] text-white">
          <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-3 lg:px-5">
            <Link
              href="/"
              aria-label="WHOKEAS ALL IN home"
              className="flex min-w-[194px] shrink-0 items-center gap-3 rounded-md border border-transparent px-2 py-1.5 transition hover:border-white/70"
            >
              <div className="relative h-12 w-[72px] shrink-0">
                <Image
                  src="/brand/logo-mark.png"
                  alt=""
                  fill
                  priority
                  sizes="72px"
                  className="object-contain drop-shadow-[0_4px_10px_rgba(243,182,31,0.18)]"
                />
              </div>

              <div className="hidden leading-none sm:block">
                <div className="text-[17px] font-black tracking-[0.12em] text-white">
                  WHOKEAS
                </div>
                <div className="mt-1.5 text-[11px] font-black tracking-[0.34em] text-[#f3b61f]">
                  ALL IN
                </div>
              </div>
            </Link>

            <button className="hidden shrink-0 rounded border border-transparent px-2 py-1 text-left hover:border-white lg:block">
              <div className="text-[10px] text-slate-300">Deliver to</div>
              <div className="text-sm font-bold">Tanzania</div>
            </button>

            <form action="/search" className="flex h-11 min-w-0 flex-1 overflow-hidden rounded-md bg-white ring-2 ring-transparent focus-within:ring-[#f3b61f]">
              <select aria-label="Search department" className="hidden border-r border-slate-300 bg-slate-100 px-3 text-xs text-slate-700 outline-none md:block">
                <option>All</option>
                <option>Tech</option>
                <option>Study</option>
                <option>Fashion</option>
                <option>Home</option>
              </select>
              <input
                name="q"
                aria-label="Search products"
                placeholder="Search WHOKEAS ALL IN"
                className="min-w-0 flex-1 px-4 text-sm text-slate-900 outline-none"
              />
              <button aria-label="Search" className="flex w-14 items-center justify-center bg-[#f3b61f] text-slate-950 hover:bg-[#ffca3a]">
                <SearchIcon />
              </button>
            </form>

            <button className="hidden shrink-0 rounded border border-transparent px-2 py-1 text-left hover:border-white md:block">
              <div className="text-[10px]">Hello, sign in</div>
              <div className="text-sm font-bold">Account</div>
            </button>

            <button className="hidden shrink-0 rounded border border-transparent px-2 py-1 text-left hover:border-white xl:block">
              <div className="text-[10px]">Returns</div>
              <div className="text-sm font-bold">& Orders</div>
            </button>

            <button className="relative flex shrink-0 items-end rounded border border-transparent px-2 py-1 hover:border-white">
              <span className="absolute left-5 top-0 text-xs font-black text-[#f3b61f]">0</span>
              <CartIcon />
              <span className="hidden text-sm font-bold sm:inline">Cart</span>
            </button>
          </div>
        </div>

        <nav className="bg-[#223142] text-white">
          <div className="mx-auto flex h-10 max-w-[1500px] items-center gap-1 overflow-x-auto px-3 text-sm lg:px-5">
            <Link href="#categories" className="flex shrink-0 items-center gap-2 rounded border border-transparent px-3 py-2 font-semibold hover:border-white">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              All
            </Link>

            {departments.map((department) => (
              <Link
                key={department}
                href="#products"
                className="shrink-0 rounded border border-transparent px-3 py-2 font-semibold hover:border-white"
              >
                {department}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-r from-[#07131d] via-[#172a3a] to-[#c69011] text-white">
        <div className="mx-auto grid min-h-[420px] max-w-[1500px] items-center gap-10 px-5 py-14 lg:grid-cols-[1.15fr_.85fr] lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#ffd56a]">
              Tanzania&apos;s modern digital marketplace
            </p>
            <h1 className="mt-5 text-5xl font-black leading-[0.95] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Everything you need.
              <span className="block text-[#f3b61f]">All in one place.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-200">
              Shop technology, study essentials, fashion, home products and original WHOKEAS merchandise with local pricing and clear order support.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="#products" className="rounded-lg bg-[#f3b61f] px-6 py-3 text-sm font-black text-[#101820] hover:bg-[#ffca3a]">
                Shop featured products
              </Link>
              <Link href="#categories" className="rounded-lg border border-white/40 bg-white/10 px-6 py-3 text-sm font-bold hover:bg-white/20">
                Browse departments
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur">
            {["Tech", "Study", "Style", "Home"].map((item, index) => (
              <div key={item} className="rounded-xl bg-white p-4 text-slate-900 shadow-lg">
                <ProductVisual label={item} index={index} />
                <p className="mt-3 font-black">{item}</p>
                <p className="mt-1 text-xs text-slate-500">Explore collection</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="categories" className="relative z-10 mx-auto -mt-8 max-w-[1500px] px-4 pb-8 lg:px-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {categoryCards.map((category) => (
            <article key={category.title} className="bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black">{category.title}</h2>
              <p className="mt-1 min-h-10 text-sm text-slate-600">{category.subtitle}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {category.items.map((item) => (
                  <div key={item}>
                    <div className={`aspect-[4/3] rounded-md bg-gradient-to-br ${category.tone} p-3`}>
                      <div className="flex h-full items-center justify-center rounded bg-white/65 text-xs font-black text-slate-700">
                        {item.slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <p className="mt-1 text-xs font-semibold">{item}</p>
                  </div>
                ))}
              </div>
              <Link href="#products" className="mt-5 inline-block text-sm font-semibold text-[#007185] hover:text-[#c7511f] hover:underline">
                Shop now
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section id="products" className="mx-auto max-w-[1500px] space-y-5 px-4 pb-10 lg:px-5">
        <div className="bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Featured products</h2>
              <p className="mt-1 text-sm text-slate-500">
                Live catalogue loaded directly from Neon
              </p>
            </div>
          </div>

          {dealProducts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              No active products yet.
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-3">
              {dealProducts.map((product, index) => (
                <Link href={`/products/${product.slug}`} key={product.id} className="w-44 shrink-0">
                  <ProductVisual label={product.category ?? "Product"} index={index} />
                  <div className="mt-3 inline-flex bg-[#cc0c39] px-2 py-1 text-[11px] font-black text-white">
                    FEATURED
                  </div>
                  <h3 className="mt-2 line-clamp-2 text-sm font-semibold hover:text-[#c7511f]">
                    {product.name}
                  </h3>
                  <p className="mt-1 font-black">{formatPrice(product.price)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-2xl font-black">Recommended for you</h2>
            <p className="mt-1 text-sm text-slate-500">
              Useful products across our main departments
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {recommendedProducts.map((product, index) => (
              <Link href={`/products/${product.slug}`} key={product.id} className="group">
                <ProductVisual label={product.category ?? "Product"} index={index + 2} />
                <h3 className="mt-3 text-sm font-semibold group-hover:text-[#c7511f]">
                  {product.name}
                </h3>
                <p className="mt-1 font-black">{formatPrice(product.price)}</p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                  {product.description}
                </p>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c7511f]">WHOKEAS ORIGINALS</p>
            <h2 className="mt-3 text-3xl font-black">Built around one strong identity.</h2>
            <p className="mt-4 max-w-xl leading-7 text-slate-600">
              Original WHOKEAS ALL IN apparel and accessories created for people who commit fully to their goals, work and growth.
            </p>
            <Link href="#products" className="mt-6 inline-block rounded-lg bg-[#ffd814] px-5 py-3 text-sm font-bold shadow-sm hover:bg-[#f7ca00]">
              Explore originals
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden bg-slate-200 shadow-sm">
            {[
              ["Secure checkout", "Protected payment flow"],
              ["Local pricing", "Prices displayed in TZS"],
              ["Order tracking", "Clear delivery progress"],
              ["Customer support", "Help before and after purchase"],
            ].map(([title, text]) => (
              <div key={title} className="bg-white p-6">
                <h3 className="font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="text-white">
        <a href="#" className="block bg-[#37475a] py-4 text-center text-sm font-semibold hover:bg-[#485769]">
          Back to top
        </a>

        <div className="bg-[#223142]">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Get to know us", ["About WHOKEAS", "Our story", "Careers"]],
              ["Shop with us", ["Your account", "Your orders", "Track package"]],
              ["Work with us", ["Sell on WHOKEAS", "Affiliate program", "Supplier partnership"]],
              ["Customer support", ["Help center", "Delivery", "Returns and refunds"]],
            ].map(([title, links]) => (
              <div key={title as string}>
                <h3 className="font-black">{title as string}</h3>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  {(links as string[]).map((link) => (
                    <p key={link}>{link}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 bg-[#101820] px-5 py-7 text-center">
          <div className="font-black tracking-[0.14em]">WHOKEAS ALL IN</div>
          <p className="mt-2 text-xs text-slate-400">
            Everything you need. One trusted Tanzanian digital marketplace.
          </p>
          <p className="mt-4 text-xs text-slate-500">
            Copyright 2026 WHOKEAS ALL IN. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
'@

[System.IO.File]::WriteAllText(
  (Resolve-Path ".\src\app\page.tsx").Path,
  $page,
  $utf8
)

Write-Host "Seeding the Neon catalogue..." -ForegroundColor Cyan
npx tsx .\src\db\seed.ts

Remove-Item -Recurse -Force ".\.next" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Neon catalogue connected successfully." -ForegroundColor Green
Write-Host "Run: npm run dev" -ForegroundColor Yellow
