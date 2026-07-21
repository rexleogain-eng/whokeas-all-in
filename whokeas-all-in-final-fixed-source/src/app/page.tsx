import Link from "next/link";

import StoreHeader from "@/components/store/StoreHeader";
import StoreProductCard from "@/components/store/StoreProductCard";
import {
  getStoreCategories,
  getStoreProducts,
} from "@/lib/store-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const departmentTiles = [
  { name: "Tech", icon: "⚡", text: "Smart accessories and electronics" },
  { name: "Home", icon: "⌂", text: "Useful products for daily living" },
  { name: "Fashion", icon: "✦", text: "Style, bags and WHOKEAS originals" },
  { name: "Study", icon: "▣", text: "Study and productivity essentials" },
];

export default async function HomePage() {
  const [featured, newest, categories] = await Promise.all([
    getStoreProducts({ featured: true, limit: 8 }),
    getStoreProducts({ limit: 12, sort: "newest" }),
    getStoreCategories(),
  ]);

  const featuredProducts = featured.length > 0 ? featured : newest.slice(0, 8);

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <StoreHeader />

      <section className="overflow-hidden bg-gradient-to-br from-[#fff7f0] via-white to-[#ffe4cc]">
        <div className="mx-auto grid max-w-[1600px] gap-8 px-4 py-10 lg:grid-cols-[240px_1fr_310px] lg:px-6 lg:py-12">
          <aside className="hidden rounded-2xl bg-white p-4 shadow-sm lg:block">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Shop categories
            </p>
            <div className="space-y-1">
              {(categories.length > 0
                ? categories.slice(0, 10)
                : departmentTiles.map((tile) => ({
                    name: tile.name,
                    slug: tile.name.toLowerCase(),
                    count: 0,
                  })))
                .map((category) => (
                  <Link
                    key={category.slug}
                    href={`/products?category=${encodeURIComponent(category.name)}`}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-[#fff0e6] hover:text-[#e85f00]"
                  >
                    <span>{category.name}</span>
                    <span className="text-xs text-slate-400">›</span>
                  </Link>
                ))}
            </div>
          </aside>

          <div className="relative overflow-hidden rounded-3xl bg-[#ff6a00] px-6 py-10 text-white shadow-lg sm:px-10 lg:min-h-[390px] lg:py-14">
            <div className="relative z-10 max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-100">
                WHOKEAS ALL IN • Tanzania
              </p>
              <h1 className="mt-4 text-4xl font-black leading-[0.98] tracking-[-0.04em] sm:text-6xl">
                Global choices.
                <span className="block text-[#1c2434]">One local store.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-orange-50">
                Discover technology, home, fashion and study products with local
                TZS pricing and clear order support.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className="rounded-full bg-white px-6 py-3 text-sm font-black text-[#e85f00] shadow-sm hover:bg-orange-50"
                >
                  Start shopping
                </Link>
                <Link
                  href="/products?sort=newest"
                  className="rounded-full border border-white/60 px-6 py-3 text-sm font-black hover:bg-white/10"
                >
                  New arrivals
                </Link>
              </div>
            </div>

            <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/15" />
            <div className="pointer-events-none absolute -bottom-28 right-16 h-72 w-72 rounded-full bg-[#ffb066]/50" />
          </div>

          <aside className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl bg-[#1c2434] p-6 text-white shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">
                Simple ordering
              </p>
              <h2 className="mt-3 text-2xl font-black">
                Order locally. We handle the supplier flow.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Product selection, payment verification and fulfilment are
                managed through WHOKEAS ALL IN.
              </p>
            </div>

            <div className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff6a00]">
                Customer support
              </p>
              <h2 className="mt-3 text-2xl font-black text-slate-900">
                Tanzania-focused assistance.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Delivery details and payment instructions are confirmed before
                fulfilment.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-4 py-8 lg:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {departmentTiles.map((tile) => (
            <Link
              key={tile.name}
              href={`/products?category=${encodeURIComponent(tile.name)}`}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-orange-200 hover:shadow-md"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#fff0e6] text-2xl font-black text-[#ff6a00] group-hover:bg-[#ff6a00] group-hover:text-white">
                {tile.icon}
              </div>
              <div>
                <h2 className="font-black">{tile.name}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {tile.text}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-4 pb-10 lg:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff6a00]">
              Selected for you
            </p>
            <h2 className="mt-2 text-3xl font-black">Featured products</h2>
          </div>
          <Link
            href="/products"
            className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-black hover:border-[#ff6a00] hover:text-[#ff6a00]"
          >
            View all products
          </Link>
        </div>

        {featuredProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-orange-200 bg-white p-10 text-center">
            <h3 className="text-xl font-black">The store is being prepared.</h3>
            <p className="mt-2 text-sm text-slate-500">
              Active products will appear here after they are reviewed and
              published from Product Control.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {featuredProducts.map((product) => (
              <StoreProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="border-y border-orange-100 bg-white">
        <div className="mx-auto grid max-w-[1400px] gap-5 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
          {[
            ["TZS pricing", "Clear local currency pricing"],
            ["Supplier checks", "Products stay draft until reviewed"],
            ["Payment verification", "Orders are verified before fulfilment"],
            ["Order support", "Clear updates from order to delivery"],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl bg-[#f8f9fb] p-5">
              <div className="h-2 w-12 rounded-full bg-[#ff6a00]" />
              <h3 className="mt-4 font-black">{title}</h3>
              <p className="mt-2 text-sm text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="bg-[#1c2434] text-white">
        <div className="mx-auto grid max-w-[1400px] gap-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-black tracking-[0.14em]">WHOKEAS ALL IN</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              A modern Tanzania-focused digital marketplace.
            </p>
          </div>
          <div>
            <h3 className="font-black">Shop</h3>
            <Link href="/products" className="mt-3 block text-sm text-slate-400">
              All products
            </Link>
          </div>
          <div>
            <h3 className="font-black">Orders</h3>
            <p className="mt-3 text-sm text-slate-400">Payment verification</p>
            <p className="mt-2 text-sm text-slate-400">Delivery support</p>
          </div>
          <div>
            <h3 className="font-black">Business</h3>
            <p className="mt-3 text-sm text-slate-400">WHOKEAS ALL IN</p>
            <p className="mt-2 text-sm text-slate-400">Tanzania</p>
          </div>
        </div>
        <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-slate-500">
          © 2026 WHOKEAS ALL IN. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
