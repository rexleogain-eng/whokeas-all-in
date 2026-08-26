import Link from "next/link";

import StoreHeader from "@/components/store/StoreHeader";
import StoreProductCard from "@/components/store/StoreProductCard";
import {
  getStoreCategories,
  getStoreProducts,
} from "@/lib/store-catalog";
import type { StoreProduct } from "@/lib/store-catalog";
import {
  storefrontFocusFamily,
  storefrontFocusScore,
  storefrontTitle,
} from "@/lib/store-copy";
import { formatStorePrice } from "@/lib/store-currency";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const fallbackCollections = [
  { name: "Tech", number: "01", text: "Smart tools and refined everyday electronics" },
  { name: "Home", number: "02", text: "Useful pieces selected for modern living" },
  { name: "Fashion", number: "03", text: "Quiet statement pieces and WHOKEAS originals" },
  { name: "Study", number: "04", text: "Focused essentials for work and learning" },
];

function rankStorefrontProducts(products: StoreProduct[]) {
  const unique = new Map<string, StoreProduct>();

  for (const product of products) {
    if (!unique.has(product.id)) unique.set(product.id, product);
  }

  const ranked = [...unique.values()].sort(
    (left, right) => storefrontFocusScore(right) - storefrontFocusScore(left),
  );
  const selected: StoreProduct[] = [];
  const familyCounts = new Map<string, number>();

  for (const product of ranked) {
    const family = storefrontFocusFamily(product.name);
    const currentCount = familyCounts.get(family) || 0;
    const familyLimit = family === "other" ? 1 : 2;
    if (currentCount >= familyLimit) continue;

    selected.push(product);
    familyCounts.set(family, currentCount + 1);
    if (selected.length === 6) break;
  }

  if (selected.length < 6) {
    for (const product of ranked) {
      if (selected.some((item) => item.id === product.id)) continue;
      selected.push(product);
      if (selected.length === 6) break;
    }
  }

  return selected;
}

export default async function HomePage() {
  const [
    featured,
    newest,
    powerBanks,
    carAudio,
    beauty,
    organizers,
    categories,
  ] = await Promise.all([
    getStoreProducts({ featured: true, limit: 24 }),
    getStoreProducts({ limit: 36, sort: "newest" }),
    getStoreProducts({ query: "power bank", limit: 12, sort: "newest" }),
    getStoreProducts({ query: "fm transmitter", limit: 12, sort: "newest" }),
    getStoreProducts({ query: "hair", limit: 12, sort: "newest" }),
    getStoreProducts({ query: "organizer", limit: 12, sort: "newest" }),
    getStoreCategories(),
  ]);

  const featuredProducts = rankStorefrontProducts([
    ...powerBanks,
    ...carAudio,
    ...beauty,
    ...organizers,
    ...featured,
    ...newest,
  ]);
  const heroProduct = featuredProducts[0] || newest[0];
  const heroTitle = heroProduct ? storefrontTitle(heroProduct.name) : null;
  const collections = categories.length > 0
    ? categories.slice(0, 4).map((category, index) => ({
        name: category.name,
        number: String(index + 1).padStart(2, "0"),
        text: `${category.count} carefully selected item${category.count === 1 ? "" : "s"}`,
      }))
    : fallbackCollections;

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader />

      <section className="relative overflow-hidden bg-[#171512] text-white">
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:52px_52px]" />
        <div className="relative mx-auto grid max-w-[1580px] items-stretch lg:grid-cols-[1.05fr_.95fr]">
          <div className="flex min-h-[520px] flex-col justify-center px-6 py-16 sm:px-10 lg:min-h-[650px] lg:px-16 xl:px-24">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#d6bd7b]">
              WHOKEAS ALL IN · United States
            </p>
            <h1 className="mt-7 max-w-3xl text-5xl font-normal leading-[0.98] tracking-[-0.045em] sm:text-7xl xl:text-[88px]">
              Everything you need.
              <span className="mt-2 block italic text-[#d6bd7b]">One trusted brand.</span>
            </h1>
            <p className="mt-7 max-w-xl text-sm leading-7 text-[#d8d1c7] sm:text-base">
              Curated technology, home, fashion, beauty and study products for
              U.S. shoppers—priced in USD with free standard shipping and direct support.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              {heroProduct && (
                <Link
                  href={`/products/${heroProduct.slug}`}
                  className="classic-button-gold"
                >
                  Shop featured pick
                </Link>
              )}
              <Link href="/handcrafted" className="classic-button-hero">
                WHOKEAS Handcrafted
              </Link>
            </div>

            <div className="mt-12 grid max-w-2xl grid-cols-3 gap-5 border-t border-white/15 pt-7 text-[10px] font-bold uppercase tracking-[0.16em] text-[#bdb5aa]">
              <span>USD pricing</span>
              <span>Free U.S. shipping</span>
              <span>30-day returns</span>
            </div>
          </div>

          <div className="relative min-h-[430px] border-t border-white/10 bg-[#211e19] lg:min-h-[650px] lg:border-l lg:border-t-0">
            {heroProduct?.image ? (
              <img
                src={heroProduct.image}
                alt={heroTitle || "WHOKEAS featured product"}
                className="absolute inset-0 h-full w-full object-contain p-12 sm:p-16 lg:p-20"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center font-serif text-8xl text-white/15">
                WAI
              </div>
            )}
            <div className="absolute inset-x-6 bottom-6 border border-white/15 bg-[#171512]/85 p-5 backdrop-blur sm:inset-x-10 sm:bottom-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d6bd7b]">
                Featured selection
              </p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-normal text-white">
                    {heroTitle || "The WHOKEAS Collection"}
                  </h2>
                  <p className="mt-1 text-xs text-white/60">
                    {heroProduct
                      ? `${formatStorePrice(heroProduct.price)} · Free U.S. shipping`
                      : "Curated for practical, modern living."}
                  </p>
                </div>
                {heroProduct && (
                  <Link
                    href={`/products/${heroProduct.slug}`}
                    className="shrink-0 text-[10px] font-bold uppercase tracking-[0.15em] text-[#d6bd7b] hover:text-white"
                  >
                    Shop now →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#d8cfbf] bg-[#fffdf8]">
        <div className="mx-auto grid max-w-[1580px] divide-y divide-[#ded5c7] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          {[
            ["Curated catalogue", "Products are checked for U.S. delivery before publication."],
            ["Sharper pricing", "Our catalogue is being repriced around a leaner competitive margin."],
            ["Faster U.S. shipping", "Products with a verified U.S. estimate over 10 days are held back."],
            ["30-day returns", "Eligible return requests are accepted within 30 calendar days."],
          ].map(([title, text]) => (
            <div key={title} className="px-6 py-7 lg:px-8">
              <h3 className="text-lg font-normal">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-[#746d62]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-[#302b24] bg-[#191713] text-white">
        <div className="mx-auto grid max-w-[1580px] gap-10 px-6 py-14 sm:px-10 lg:grid-cols-[1.1fr_.9fr] lg:px-16 lg:py-20">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#d6bd7b]">
              WHOKEAS Originals
            </p>
            <h2 className="mt-4 max-w-3xl font-serif text-4xl font-semibold leading-tight sm:text-6xl">
              We are starting a handcrafted line under our own brand.
            </h2>
            <p className="mt-6 max-w-2xl text-sm leading-8 text-white/60 sm:text-base">
              The first WHOKEAS handcrafted concepts are now in development. We are keeping them
              visibly separate from supplier products and will only activate ordering after real
              materials, production capacity, photos, pricing and U.S. fulfilment are verified.
            </p>
            <Link href="/handcrafted" className="classic-button-gold mt-8 inline-flex">
              Preview Handcrafted Originals
            </Link>
          </div>

          <div className="grid gap-px border border-white/15 bg-white/15 sm:grid-cols-3 lg:grid-cols-1">
            {[
              ["01", "Hand-poured", "Home fragrance concept"],
              ["02", "Wood-finished", "Desk valet concept"],
              ["03", "Hand-finished", "Utility key loop concept"],
            ].map(([number, title, text]) => (
              <div key={number} className="bg-[#191713] p-6">
                <p className="text-[10px] font-black tracking-[0.2em] text-[#d6bd7b]">{number}</p>
                <h3 className="mt-3 font-serif text-2xl font-semibold">{title}</h3>
                <p className="mt-2 text-xs leading-6 text-white/50">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1580px] px-4 py-14 sm:px-6 lg:py-20">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="classic-kicker">Browse by collection</p>
            <h2 className="mt-3 text-4xl font-normal sm:text-5xl">Made for the way you live.</h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-[#746d62]">
            Practical products, transparent USD pricing and a clear U.S. ordering experience.
          </p>
        </div>

        <div className="mt-10 grid border-l border-t border-[#d8cfbf] sm:grid-cols-2 lg:grid-cols-4">
          {collections.map((collection) => (
            <Link
              key={collection.name}
              href={`/products?category=${encodeURIComponent(collection.name)}`}
              className="group min-h-64 border-b border-r border-[#d8cfbf] bg-[#fffdf8] p-7 hover:bg-[#171512] hover:text-white lg:min-h-72"
            >
              <p className="text-[10px] font-bold tracking-[0.2em] text-[#9b762c]">
                {collection.number}
              </p>
              <h3 className="mt-16 text-3xl font-normal sm:mt-20">{collection.name}</h3>
              <p className="mt-3 max-w-[230px] text-xs leading-6 text-[#746d62] group-hover:text-white/65">
                {collection.text}
              </p>
              <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9b762c]">
                Shop collection →
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section id="products" className="scroll-mt-44 border-y border-[#d8cfbf] bg-[#fffdf8]">
        <div className="mx-auto max-w-[1580px] px-4 py-14 sm:px-6 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="classic-kicker">The focused edit</p>
              <h2 className="mt-3 text-4xl font-normal sm:text-5xl">Best current picks</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#746d62]">
                A tighter selection prioritized for value, delivery speed and everyday usefulness.
              </p>
            </div>
            <Link href="/products" className="classic-button-light">
              View all products
            </Link>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="mt-10 border border-dashed border-[#c8bda9] bg-[#f7f2e9] p-12 text-center">
              <h3 className="text-2xl font-normal">The collection is being prepared.</h3>
              <p className="mt-3 text-sm text-[#746d62]">
                Reviewed products will appear here after publication.
              </p>
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
              {featuredProducts.map((product) => (
                <StoreProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-[#ebe2d4]">
        <div className="mx-auto grid max-w-[1580px] lg:grid-cols-2">
          <div className="border-b border-[#cfc4b1] p-8 sm:p-12 lg:border-b-0 lg:border-r lg:p-20">
            <p className="classic-kicker">Our standard</p>
            <h2 className="mt-4 max-w-xl text-4xl font-normal leading-tight sm:text-6xl">
              Commerce with a quieter, more considered character.
            </h2>
          </div>
          <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-20">
            <p className="max-w-xl text-sm leading-8 text-[#625b50] sm:text-base">
              WHOKEAS ALL IN brings useful products into one dependable U.S. shopping experience.
              We keep the catalogue selective, pricing understandable and order communication clear.
            </p>
            <div className="mt-8 grid gap-6 border-t border-[#c8bda9] pt-8 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9b762c]">Identity</p>
                <p className="mt-2 text-sm leading-6">Premium, disciplined and unmistakably WHOKEAS.</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9b762c]">Purpose</p>
                <p className="mt-2 text-sm leading-6">Everything you need. One trusted brand.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer id="support" className="bg-[#12110f] text-white">
        <div className="mx-auto grid max-w-[1580px] gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div className="sm:col-span-2">
            <p className="text-sm font-black tracking-[0.17em]">WHOKEAS ALL IN</p>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/55">
              A U.S.-focused online store built around useful products,
              transparent USD pricing and clear customer support.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-normal text-[#d6bd7b]">Shop</h3>
            <Link href="/products" className="mt-4 block text-sm text-white/60 hover:text-white">All products</Link>
            <Link href="/handcrafted" className="mt-3 block text-sm text-white/60 hover:text-white">WHOKEAS Handcrafted</Link>
            <Link href="/shop/portable-power-banks" className="mt-3 block text-sm text-white/60 hover:text-white">Power banks</Link>
            <Link href="/shop/car-fm-transmitters" className="mt-3 block text-sm text-white/60 hover:text-white">Car audio</Link>
            <Link href="/shop/beauty-grooming-essentials" className="mt-3 block text-sm text-white/60 hover:text-white">Beauty &amp; grooming</Link>
          </div>
          <div>
            <h3 className="text-lg font-normal text-[#d6bd7b]">Service</h3>
            <p className="mt-4 text-sm text-white/60">Payment verification</p>
            <p className="mt-3 text-sm text-white/60">Delivery coordination</p>
            <p className="mt-3 text-sm text-white/60">Order assistance</p>
            <Link
              href="/returns-refunds"
              className="mt-3 block text-sm text-white/60 hover:text-white"
            >
              Returns &amp; refunds
            </Link>
            <Link
              href="/shipping-delivery"
              className="mt-3 block text-sm text-white/60 hover:text-white"
            >
              Shipping &amp; delivery
            </Link>
          </div>
        </div>
        <div className="border-t border-white/10 px-5 py-5 text-center text-[10px] uppercase tracking-[0.16em] text-white/35">
          © 2026 WHOKEAS ALL IN · United States
        </div>
      </footer>
    </main>
  );
}
