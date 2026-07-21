import Link from "next/link";

import StoreHeader from "@/components/store/StoreHeader";
import StoreProductCard from "@/components/store/StoreProductCard";
import {
  getStoreCategories,
  getStoreProducts,
} from "@/lib/store-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const fallbackCollections = [
  { name: "Tech", number: "01", text: "Smart tools and refined everyday electronics" },
  { name: "Home", number: "02", text: "Useful pieces selected for modern living" },
  { name: "Fashion", number: "03", text: "Quiet statement pieces and WHOKEAS originals" },
  { name: "Study", number: "04", text: "Focused essentials for work and learning" },
];

export default async function HomePage() {
  const [featured, newest, categories] = await Promise.all([
    getStoreProducts({ featured: true, limit: 8 }),
    getStoreProducts({ limit: 12, sort: "newest" }),
    getStoreCategories(),
  ]);

  const featuredProducts = featured.length > 0 ? featured : newest.slice(0, 8);
  const heroProduct = featuredProducts[0] || newest[0];
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
              WHOKEAS ALL IN · Tanzania
            </p>
            <h1 className="mt-7 max-w-3xl text-5xl font-normal leading-[0.98] tracking-[-0.045em] sm:text-7xl xl:text-[88px]">
              Everything you need.
              <span className="mt-2 block italic text-[#d6bd7b]">One trusted brand.</span>
            </h1>
            <p className="mt-7 max-w-xl text-sm leading-7 text-[#d8d1c7] sm:text-base">
              A considered collection of technology, home, fashion and study
              essentials—priced in Tanzanian shillings and supported locally.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/products" className="classic-button-gold">
                Explore the collection
              </Link>
              <Link href="/products?sort=newest" className="classic-button-hero">
                New arrivals
              </Link>
            </div>

            <div className="mt-12 grid max-w-2xl grid-cols-3 gap-5 border-t border-white/15 pt-7 text-[10px] font-bold uppercase tracking-[0.16em] text-[#bdb5aa]">
              <span>Local TZS pricing</span>
              <span>Supplier reviewed</span>
              <span>Order support</span>
            </div>
          </div>

          <div className="relative min-h-[430px] border-t border-white/10 bg-[#211e19] lg:min-h-[650px] lg:border-l lg:border-t-0">
            {heroProduct?.image ? (
              <img
                src={heroProduct.image}
                alt={heroProduct.name}
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
                    {heroProduct?.name || "The WHOKEAS Collection"}
                  </h2>
                  <p className="mt-1 text-xs text-white/60">
                    Curated for practical, modern living.
                  </p>
                </div>
                {heroProduct && (
                  <Link
                    href={`/products/${heroProduct.slug}`}
                    className="shrink-0 text-[10px] font-bold uppercase tracking-[0.15em] text-[#d6bd7b] hover:text-white"
                  >
                    Discover →
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
            ["Curated catalogue", "Products are reviewed before publication."],
            ["Transparent pricing", "Clear prices shown in Tanzanian shillings."],
            ["Secure verification", "Payments are confirmed before fulfilment."],
            ["Local assistance", "Order support tailored for Tanzania."],
          ].map(([title, text]) => (
            <div key={title} className="px-6 py-7 lg:px-8">
              <h3 className="text-lg font-normal">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-[#746d62]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1580px] px-4 py-14 sm:px-6 lg:py-20">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="classic-kicker">Browse by collection</p>
            <h2 className="mt-3 text-4xl font-normal sm:text-5xl">Made for the way you live.</h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-[#746d62]">
            Practical products, restrained presentation and a clear local ordering experience.
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
              <p className="classic-kicker">The edit</p>
              <h2 className="mt-3 text-4xl font-normal sm:text-5xl">Featured products</h2>
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
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
              WHOKEAS ALL IN brings global product access into one dependable local experience.
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
              A refined Tanzania-first digital marketplace built around trust,
              practical value and clear customer support.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-normal text-[#d6bd7b]">Shop</h3>
            <Link href="/products" className="mt-4 block text-sm text-white/60 hover:text-white">All products</Link>
            <Link href="/products?sort=newest" className="mt-3 block text-sm text-white/60 hover:text-white">New arrivals</Link>
          </div>
          <div>
            <h3 className="text-lg font-normal text-[#d6bd7b]">Service</h3>
            <p className="mt-4 text-sm text-white/60">Payment verification</p>
            <p className="mt-3 text-sm text-white/60">Delivery coordination</p>
            <p className="mt-3 text-sm text-white/60">Order assistance</p>
          </div>
        </div>
        <div className="border-t border-white/10 px-5 py-5 text-center text-[10px] uppercase tracking-[0.16em] text-white/35">
          © 2026 WHOKEAS ALL IN · Tanzania
        </div>
      </footer>
    </main>
  );
}
