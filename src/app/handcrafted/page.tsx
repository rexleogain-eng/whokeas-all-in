import type { Metadata } from "next";
import Link from "next/link";

import StoreHeader from "@/components/store/StoreHeader";
import {
  calculateGiftEconomics,
  PROMOTIONAL_GIFT_PROFIT_SHARE,
} from "@/lib/gift-economics";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "WHOKEAS Branded & Personalized Gifts",
  description:
    "Explore WHOKEAS-branded mugs, shirts, caps, tumblers, bags, bottles and other personalized made-to-order products for U.S. customers.",
  alternates: { canonical: `${SITE_URL}/handcrafted` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/handcrafted`,
    siteName: SITE_NAME,
    title: "WHOKEAS Branded & Personalized Gifts",
    description:
      "WHOKEAS-branded made-to-order gifts and custom merchandise, available individually or as qualifying promotional gifts.",
  },
};

const brandedProducts = [
  {
    name: "Personalized WHOKEAS Mug",
    type: "Drinkware",
    mark: "MUG",
    image: "/brand/mockups/mug.svg",
    detail: "WHOKEAS-branded ceramic mug with optional customer name, short text or approved artwork.",
    personalization: "Name · text · approved artwork",
    gift: true,
  },
  {
    name: "WHOKEAS Custom T-Shirt",
    type: "Apparel",
    mark: "TEE",
    image: "/brand/mockups/tshirt.svg",
    detail: "WHOKEAS logo T-shirt prepared as a made-to-order branded piece with optional personalization.",
    personalization: "Size · color · custom text",
    gift: false,
  },
  {
    name: "WHOKEAS Custom Cap",
    type: "Apparel",
    mark: "CAP",
    image: "/brand/mockups/cap.svg",
    detail: "Branded cap featuring the WHOKEAS mark, with embroidery or print method confirmed before production.",
    personalization: "Color · initials · short text",
    gift: false,
  },
  {
    name: "Personalized WHOKEAS Tumbler",
    type: "Drinkware",
    mark: "TUM",
    image: "/brand/mockups/tumbler.svg",
    detail: "Reusable WHOKEAS tumbler for hot or cold drinks, with optional name or short-message personalization.",
    personalization: "Name · text · finish",
    gift: true,
  },
  {
    name: "WHOKEAS Custom Tote Bag",
    type: "Bags",
    mark: "TOTE",
    image: "/brand/mockups/tote.svg",
    detail: "Reusable tote bag carrying the WHOKEAS logo and an optional customer name or approved design.",
    personalization: "Name · text · approved artwork",
    gift: true,
  },
  {
    name: "WHOKEAS Custom Phone Case",
    type: "Accessories",
    mark: "CASE",
    image: "/brand/mockups/phone-case.svg",
    detail: "WHOKEAS-branded phone case made for supported device models, with optional custom text or artwork.",
    personalization: "Phone model · text · artwork",
    gift: false,
  },
  {
    name: "WHOKEAS Custom Wall Art",
    type: "Home",
    mark: "ART",
    image: "/brand/mockups/wall-art.svg",
    detail: "Minimal WHOKEAS wall print or personalized artwork prepared after size and print-stock confirmation.",
    personalization: "Size · name · message",
    gift: false,
  },
  {
    name: "WHOKEAS Custom Keychain",
    type: "Accessories",
    mark: "KEY",
    image: "/brand/mockups/keychain.svg",
    detail: "Compact branded keychain with the WHOKEAS mark and optional name, initials or short text.",
    personalization: "Initials · name · short text",
    gift: true,
  },
  {
    name: "WHOKEAS Custom Apron",
    type: "Home",
    mark: "APR",
    image: "/brand/mockups/apron.svg",
    detail: "WHOKEAS-branded apron for cooking, studio or workshop use with optional customer personalization.",
    personalization: "Name · text · placement",
    gift: false,
  },
  {
    name: "Personalized WHOKEAS Notebook",
    type: "Stationery",
    mark: "NOTE",
    image: "/brand/mockups/notebook.svg",
    detail: "Branded notebook with the WHOKEAS logo and optional customer name, initials or short message.",
    personalization: "Name · initials · message",
    gift: true,
  },
  {
    name: "WHOKEAS Custom Pillow",
    type: "Home",
    mark: "PIL",
    image: "/brand/mockups/pillow.svg",
    detail: "Decorative WHOKEAS pillow cover with optional personalized text or approved artwork.",
    personalization: "Text · artwork · size",
    gift: false,
  },
  {
    name: "Personalized WHOKEAS Water Bottle",
    type: "Drinkware",
    mark: "BOT",
    image: "/brand/mockups/water-bottle.svg",
    detail: "Reusable WHOKEAS bottle with optional name or short text, produced after material and finish confirmation.",
    personalization: "Name · text · finish",
    gift: true,
  },
] as const;

const sampleEconomics = calculateGiftEconomics({ sellingPriceUsd: 30, landedCostUsd: 20 });

function orderHref(productName: string) {
  const subject = encodeURIComponent(`WHOKEAS branded order – ${productName}`);
  const body = encodeURIComponent(
    `Hello WHOKEAS,\n\nI would like to order: ${productName}.\n\nPersonalization requested:\nQuantity:\nDelivery ZIP code (U.S.):\n\nPlease confirm the final price, proof and delivery estimate before payment.`,
  );
  return `mailto:whokeasallin@gmail.com?subject=${subject}&body=${body}`;
}

export default function HandcraftedPage() {
  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader />

      <section className="relative overflow-hidden border-b border-[#2d2923] bg-[#11100e] text-white">
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:54px_54px]" />
        <div className="relative mx-auto grid max-w-[1500px] gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[1.05fr_.95fr] lg:px-16 lg:py-24">
          <div className="self-center">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d6bd7b]">
              WHOKEAS Originals · Branded & personalized
            </p>
            <h1 className="mt-5 max-w-4xl font-serif text-5xl font-semibold leading-[0.96] sm:text-7xl lg:text-[82px]">
              Made for you.
              <span className="block italic text-[#d6bd7b]">Marked by WHOKEAS.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-sm leading-8 text-white/68 sm:text-base">
              Branded mugs, apparel, drinkware, bags, stationery and accessories made to order for U.S. customers. Every piece carries the WHOKEAS identity, and selected items can also be personalized with a name, short message or approved artwork.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#collection" className="classic-button-gold">Explore branded products</a>
              <Link href="/products" className="classic-button-hero">Shop main catalogue</Link>
            </div>
            <div className="mt-10 grid max-w-2xl grid-cols-2 border-l border-t border-white/15 sm:grid-cols-4">
              {[["Logo", "WHOKEAS branded"], ["Custom", "Personalization"], ["Gift", "Eligible items"], ["U.S.", "Made-to-order"]].map(([label, text]) => (
                <div key={label} className="border-b border-r border-white/15 p-4">
                  <p className="text-xs font-black text-[#d6bd7b]">{label}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/55">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[430px] overflow-hidden border border-white/10 bg-[#1b1916] p-5 sm:p-7">
            <div className="absolute right-5 top-5 z-10 border border-[#d6bd7b]/50 bg-[#11100e]/80 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#d6bd7b]">
              Design previews
            </div>
            <div className="grid h-full min-h-[390px] grid-cols-2 gap-3 pt-9">
              {["/brand/mockups/mug.svg", "/brand/mockups/tshirt.svg", "/brand/mockups/cap.svg", "/brand/mockups/tumbler.svg"].map((src) => (
                <div key={src} className="overflow-hidden border border-white/10 bg-black/25">
                  <img src={src} alt="WHOKEAS branded product design preview" className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="collection" className="mx-auto max-w-[1500px] px-5 py-14 sm:px-8 lg:py-20">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="classic-kicker">WHOKEAS branded collection</p>
            <h2 className="mt-3 max-w-4xl font-serif text-4xl font-semibold sm:text-5xl">
              See the product, not just the logo.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-[#6b6358]">
            Each card now shows the intended WHOKEAS product design. These are design previews; final materials, print method, personalization, price and U.S. fulfilment are confirmed before payment.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {brandedProducts.map((product) => (
            <article key={product.name} className="group flex min-h-full flex-col overflow-hidden border border-[#d7cebf] bg-[#fffdf8] transition hover:-translate-y-1 hover:border-[#b89a59] hover:shadow-[0_22px_55px_rgba(38,30,20,0.10)]">
              <div className="relative aspect-[4/3] overflow-hidden border-b border-[#e1d8ca] bg-[#171512]">
                <img src={product.image} alt={`${product.name} design preview`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" />
                <div className="absolute left-3 top-3 border border-[#d6bd7b]/30 bg-[#11100e]/85 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.15em] text-[#d6bd7b]">{product.type}</div>
                <div className="absolute right-3 top-3 border border-white/15 bg-[#11100e]/85 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-white/70">Preview</div>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <div className="flex flex-wrap gap-2">
                  <span className="border border-[#d7cebf] bg-[#f7f2e9] px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#6b6358]">Sold separately</span>
                  {product.gift && <span className="border border-[#c9b98f] bg-[#f4ead0] px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#73571d]">Gift eligible</span>}
                </div>
                <h3 className="mt-4 font-serif text-2xl font-semibold leading-tight">{product.name}</h3>
                <p className="mt-3 text-sm leading-6 text-[#6b6358]">{product.detail}</p>
                <div className="mt-5 border-t border-[#e1d8ca] pt-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#9b762c]">Personalize</p>
                  <p className="mt-2 text-xs leading-5 text-[#5f584e]">{product.personalization}</p>
                </div>
                <div className="mt-auto pt-5">
                  <a href={orderHref(product.name)} className="block w-full border border-[#171512] bg-[#171512] px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:border-[#9b762c] hover:bg-[#9b762c]">Start custom order →</a>
                  <p className="mt-3 text-center text-[9px] font-bold uppercase tracking-[0.1em] text-[#8c8275]">Price confirmed before payment</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[#d7cebf] bg-[#171512] text-white">
        <div className="mx-auto grid max-w-[1500px] gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:py-20">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#d6bd7b]">WHOKEAS gift economics</p>
            <h2 className="mt-4 max-w-2xl font-serif text-4xl font-semibold sm:text-5xl">A gift can delight the customer without consuming the sale.</h2>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-white/60">
              A promotional WHOKEAS gift is only eligible when its real landed cost is no more than {Math.round(PROMOTIONAL_GIFT_PROFIT_SHARE * 100)}% of that order&apos;s gross profit. This gift rule is separate from the store&apos;s normal catalogue pricing and does not replace the existing pricing margin.
            </p>
          </div>
          <div className="border border-white/12 bg-white/[0.04] p-6 sm:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d6bd7b]">Example</p>
            <div className="mt-5 grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
              {[["Sale", `$${sampleEconomics.sellingPriceUsd.toFixed(2)}`], ["Landed cost", `$${sampleEconomics.landedCostUsd.toFixed(2)}`], ["Gross profit", `$${sampleEconomics.grossProfitUsd.toFixed(2)}`], ["Max gift cost", `$${sampleEconomics.maxGiftCostUsd.toFixed(2)}`]].map(([label, value]) => (
                <div key={label} className="bg-[#171512] p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/45">{label}</p>
                  <p className="mt-2 text-xl font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 border border-[#d6bd7b]/25 bg-[#d6bd7b]/[0.06] p-5">
              <p className="text-xs leading-6 text-white/70">A $30.00 sale with $20.00 landed cost produces $10.00 gross profit. The promotional gift may cost at most $1.50, leaving <strong className="text-white">${sampleEconomics.profitAfterGiftUsd.toFixed(2)}</strong> of gross profit before other applicable fees.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#d7cebf] bg-[#ece2d2]">
        <div className="mx-auto grid max-w-[1500px] gap-0 lg:grid-cols-3">
          {[["01", "Every gift is also a product", "Gift-eligible mugs, tumblers, totes, keychains, notebooks and bottles remain available for customers to order separately."], ["02", "15% profit ceiling", "A promotional gift is approved only when its real cost fits within 15% of the gross profit generated by that qualifying order."], ["03", "Verified before payment", "Production method, personalization, landed cost and U.S. delivery are confirmed before WHOKEAS sends the secure payment request."]].map(([number, title, text]) => (
            <div key={number} className="border-b border-[#cfc3af] p-8 lg:border-b-0 lg:border-r lg:p-10 last:lg:border-r-0">
              <p className="text-[10px] font-black tracking-[0.2em] text-[#9b762c]">{number}</p>
              <h3 className="mt-4 font-serif text-2xl font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#625b50]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="bg-[#12110f] px-5 py-10 text-center text-sm text-white/55">© 2026 WHOKEAS ALL IN · Branded & Personalized Collection</footer>
    </main>
  );
}
