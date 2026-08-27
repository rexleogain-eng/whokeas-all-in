import type { Metadata } from "next";
import Link from "next/link";

import StoreHeader from "@/components/store/StoreHeader";
import { PROMOTIONAL_GIFT_SPEND_THRESHOLD_USD } from "@/lib/gift-economics";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "WHOKEAS Custom Products & Personalized Gifts",
  description:
    "Shop WHOKEAS custom mugs, shirts, caps, tumblers, bags, bottles and personalized made-to-order products with clear U.S. starting prices. Orders over $200 can qualify for a complimentary WHOKEAS gift.",
  alternates: { canonical: `${SITE_URL}/handcrafted` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/handcrafted`,
    siteName: SITE_NAME,
    title: "WHOKEAS Custom Products & Personalized Gifts",
    description:
      "Shop market-aligned WHOKEAS custom products and unlock a complimentary gift option on qualifying orders over $200.",
  },
};

// Starting prices are positioned against current U.S. consumer custom-product
// benchmarks. Premium sizes, materials, finishes or complex artwork can change
// the final made-to-order total after the customer approves the proof.
const products = [
  {
    name: "Personalized WHOKEAS Mug",
    image: "/brand/mockups/mug.svg",
    category: "Drinkware",
    price: 16.99,
    description:
      "WHOKEAS-branded ceramic mug with optional customer name, short text or approved artwork.",
    personalization: "Name · text · approved artwork",
    giftEligible: true,
  },
  {
    name: "WHOKEAS Custom T-Shirt",
    image: "/brand/mockups/tshirt.svg",
    category: "Apparel",
    price: 21.99,
    description:
      "WHOKEAS logo T-shirt prepared as a made-to-order branded piece with optional personalization.",
    personalization: "Size · color · custom text",
    giftEligible: false,
  },
  {
    name: "WHOKEAS Custom Cap",
    image: "/brand/mockups/cap.svg",
    category: "Apparel",
    price: 19.99,
    description:
      "Branded cap featuring the WHOKEAS mark, with embroidery or print method confirmed before production.",
    personalization: "Color · initials · short text",
    giftEligible: false,
  },
  {
    name: "Personalized WHOKEAS Tumbler",
    image: "/brand/mockups/tumbler.svg",
    category: "Drinkware",
    price: 29.99,
    description:
      "Reusable WHOKEAS tumbler for hot or cold drinks, with optional name or short-message personalization.",
    personalization: "Name · text · finish",
    giftEligible: true,
  },
  {
    name: "WHOKEAS Custom Tote Bag",
    image: "/brand/mockups/tote.svg",
    category: "Bags",
    price: 18.99,
    description:
      "Reusable tote bag carrying the WHOKEAS logo and an optional customer name or approved design.",
    personalization: "Name · text · approved artwork",
    giftEligible: true,
  },
  {
    name: "WHOKEAS Custom Phone Case",
    image: "/brand/mockups/phone-case.svg",
    category: "Accessories",
    price: 24.99,
    description:
      "WHOKEAS-branded phone case made for supported device models, with optional custom text or artwork.",
    personalization: "Phone model · text · artwork",
    giftEligible: false,
  },
  {
    name: "WHOKEAS Custom Wall Art",
    image: "/brand/mockups/wall-art.svg",
    category: "Home",
    price: 14.99,
    description:
      "Minimal WHOKEAS wall print or personalized artwork prepared after size and print-stock confirmation.",
    personalization: "Size · name · message",
    giftEligible: false,
  },
  {
    name: "WHOKEAS Custom Keychain",
    image: "/brand/mockups/keychain.svg",
    category: "Accessories",
    price: 9.99,
    description:
      "Compact branded keychain with the WHOKEAS mark and optional name, initials or short text.",
    personalization: "Initials · name · short text",
    giftEligible: true,
  },
  {
    name: "WHOKEAS Custom Apron",
    image: "/brand/mockups/apron.svg",
    category: "Home",
    price: 27.99,
    description:
      "WHOKEAS-branded apron for cooking, studio or workshop use with optional customer personalization.",
    personalization: "Name · text · placement",
    giftEligible: false,
  },
  {
    name: "Personalized WHOKEAS Notebook",
    image: "/brand/mockups/notebook.svg",
    category: "Stationery",
    price: 24.99,
    description:
      "Branded notebook with the WHOKEAS logo and optional customer name, initials or short message.",
    personalization: "Name · initials · message",
    giftEligible: true,
  },
  {
    name: "WHOKEAS Custom Pillow",
    image: "/brand/mockups/pillow.svg",
    category: "Home",
    price: 34.99,
    description:
      "Decorative WHOKEAS pillow cover with optional personalized text or approved artwork.",
    personalization: "Text · artwork · size",
    giftEligible: false,
  },
  {
    name: "Personalized WHOKEAS Water Bottle",
    image: "/brand/mockups/water-bottle.svg",
    category: "Drinkware",
    price: 29.99,
    description:
      "Reusable WHOKEAS bottle with optional name or short text, produced after material and finish confirmation.",
    personalization: "Name · text · finish",
    giftEligible: true,
  },
] as const;

const heroImages = products.slice(0, 4);

function usd(value: number) {
  return `$${value.toFixed(2)}`;
}

function orderHref(product: (typeof products)[number]) {
  const subject = encodeURIComponent(`WHOKEAS custom order – ${product.name}`);
  const body = encodeURIComponent(
    `Hello WHOKEAS,\n\nI would like to order: ${product.name}.\nStarting price shown: ${usd(product.price)}.\n\nPersonalization requested:\nQuantity:\nDelivery ZIP code (U.S.):\n\nPlease confirm the final total, proof and delivery estimate before payment.`,
  );
  return `mailto:whokeasallin@gmail.com?subject=${subject}&body=${body}`;
}

function LuxuryProductImage({
  src,
  alt,
  compact = false,
}: {
  src: string;
  alt: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-[#0d0c0a] ${compact ? "h-full min-h-[175px]" : "aspect-[4/3]"}`}
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 18%, rgba(189,145,62,.22), transparent 42%), linear-gradient(135deg,#17140f 0%,#080807 52%,#1b1710 100%)",
      }}
    >
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-[0.14] blur-2xl saturate-0"
      />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,.03),transparent_35%,rgba(214,189,123,.05)_65%,transparent)]" />
      <div className={`relative z-10 mx-auto flex h-full items-center justify-center ${compact ? "p-3" : "p-5 sm:p-6"}`}>
        <div className="relative aspect-[4/3] w-full max-w-[340px] overflow-hidden border border-[#d6bd7b]/45 bg-[#171512] shadow-[0_20px_55px_rgba(0,0,0,.48)]">
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover brightness-[0.98] contrast-[1.08] saturate-[0.88]"
          />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.05]" />
        </div>
      </div>
    </div>
  );
}

export default function HandcraftedPage() {
  const threshold = PROMOTIONAL_GIFT_SPEND_THRESHOLD_USD;

  return (
    <main className="min-h-screen bg-[#f2ede4] text-[#17130e]">
      <StoreHeader />

      <section className="relative overflow-hidden border-b border-[#30291d] bg-[#0b0a09] text-white">
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(214,189,123,.25)_1px,transparent_1px),linear-gradient(90deg,rgba(214,189,123,.25)_1px,transparent_1px)] [background-size:64px_64px]" />
        <div className="relative mx-auto grid max-w-[1500px] gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[1.03fr_.97fr] lg:px-16 lg:py-24">
          <div className="self-center">
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-[#d6bd7b]">
              WHOKEAS Custom Shop · Market-aligned U.S. pricing
            </p>
            <h1 className="mt-5 max-w-4xl font-serif text-5xl font-semibold leading-[0.96] sm:text-7xl lg:text-[80px]">
              Custom products.
              <span className="block italic text-[#d6bd7b]">Made to be owned.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-sm leading-8 text-white/68 sm:text-base">
              Every custom item is available to buy with a clear starting price. Choose a WHOKEAS piece, request your personalization, then approve the final proof and total before payment.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#collection" className="classic-button-gold">
                Shop custom products
              </a>
              <Link href="/products" className="classic-button-hero">
                Shop main catalogue
              </Link>
            </div>
            <div className="mt-10 grid max-w-2xl grid-cols-2 border-l border-t border-white/15 sm:grid-cols-4">
              {[
                ["Price", "Clear starting price"],
                ["Custom", "Personalization"],
                ["Reward", `Spend over $${threshold}`],
                ["U.S.", "Made-to-order"],
              ].map(([title, text]) => (
                <div key={title} className="border-b border-r border-white/15 p-4">
                  <p className="text-xs font-black text-[#d6bd7b]">{title}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/55">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[440px] overflow-hidden border border-[#d6bd7b]/25 bg-[#12100d] p-5 shadow-[0_35px_90px_rgba(0,0,0,.35)] sm:p-7">
            <div className="absolute right-5 top-5 z-20 border border-[#d6bd7b]/55 bg-[#090807]/90 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#d6bd7b]">
              Luxury collection
            </div>
            <div className="grid h-full min-h-[400px] grid-cols-2 gap-3 pt-9">
              {heroImages.map((product) => (
                <div key={product.name} className="relative overflow-hidden border border-white/10 bg-black/30">
                  <LuxuryProductImage src={product.image} alt={`${product.name} luxury product image`} compact />
                  <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between gap-2 border border-white/10 bg-[#090807]/90 px-3 py-2 backdrop-blur-sm">
                    <span className="truncate text-[8px] font-black uppercase tracking-[0.12em] text-white/72">
                      {product.name}
                    </span>
                    <span className="shrink-0 text-xs font-black text-[#e3c979]">{usd(product.price)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="collection" className="mx-auto max-w-[1500px] px-5 py-14 sm:px-8 lg:py-20">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="classic-kicker">WHOKEAS custom collection</p>
            <h2 className="mt-3 max-w-4xl font-serif text-4xl font-semibold sm:text-5xl">
              Luxury pieces. Clear prices.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-[#6b6358]">
            Starting prices are positioned against the current U.S. personalized-product market. Premium sizes, materials or complex artwork may change the final total. Marked gift options can also be complimentary on qualifying orders over ${threshold}.
          </p>
        </div>

        <div className="mt-10 grid gap-7 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <article
              key={product.name}
              className="group flex min-h-full flex-col overflow-hidden border border-[#c9b994] bg-[#fffdf8] shadow-[0_14px_38px_rgba(37,29,18,.07)] transition duration-300 hover:-translate-y-1 hover:border-[#9f7930] hover:shadow-[0_30px_75px_rgba(37,29,18,.16)]"
            >
              <div className="relative border-b border-[#cfc2ab]">
                <LuxuryProductImage src={product.image} alt={`${product.name} product image`} />
                <div className="absolute left-3 top-3 z-20 border border-[#d6bd7b]/40 bg-[#090807]/90 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.16em] text-[#e0c77f]">
                  {product.category}
                </div>
                <div className="absolute right-3 top-3 z-20 border border-white/15 bg-[#090807]/90 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-white/75">
                  WHOKEAS Original
                </div>
              </div>

              <div className="flex flex-1 flex-col p-6 sm:p-7">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="border border-[#171512] bg-[#171512] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-white">
                    Made to order
                  </span>
                  {product.giftEligible ? (
                    <span className="border border-[#b69349] bg-[#f3e6c2] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#6f5116]">
                      Over $200 gift option
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-4 font-serif text-[28px] font-semibold leading-[1.05]">{product.name}</h3>

                <div className="mt-5 flex items-end justify-between gap-4 border-y border-[#e1d8ca] py-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9b762c]">Starting at</p>
                    <p className="mt-1 font-serif text-4xl font-semibold leading-none text-[#17130e]">{usd(product.price)}</p>
                  </div>
                  <div className="max-w-[150px] text-right">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#6e665b]">U.S. market aligned</p>
                    <p className="mt-1 text-[10px] leading-4 text-[#8a8175]">Final total depends on selected options.</p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-[#625b50]">{product.description}</p>

                <div className="mt-5 rounded-sm bg-[#f4ede1] px-4 py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8d6b26]">Personalization options</p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[#4f493f]">{product.personalization}</p>
                </div>

                <div className="mt-auto pt-6">
                  <a
                    href={orderHref(product)}
                    className="flex w-full items-center justify-between border border-[#171512] bg-[#171512] px-4 py-3.5 text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:border-[#9b762c] hover:bg-[#9b762c]"
                  >
                    <span>Customize & order</span>
                    <span>{usd(product.price)}+ →</span>
                  </a>
                  <p className="mt-3 text-center text-[9px] font-bold uppercase tracking-[0.09em] text-[#8c8275]">
                    Starting price · Proof & final total confirmed before payment
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[#3a3122] bg-[#0e0d0b] text-white">
        <div className="mx-auto grid max-w-[1500px] gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[.95fr_1.05fr] lg:py-20">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#d6bd7b]">WHOKEAS Rewards</p>
            <h2 className="mt-4 max-w-2xl font-serif text-4xl font-semibold sm:text-5xl">
              Spend over ${threshold}. Unlock a complimentary WHOKEAS gift.
            </h2>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-white/62">
              A qualifying order must be strictly greater than ${threshold}. An order of exactly ${threshold} does not qualify. Customers who spend more than ${threshold} in a qualifying order can receive a complimentary gift from the products marked “Over $200 gift option,” subject to availability and order verification.
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62">
              The custom products on this page remain available to purchase at any order value. The gift reward is an extra benefit for qualifying spend; it does not turn the collection into free-only products.
            </p>
          </div>

          <div className="border border-[#d6bd7b]/24 bg-white/[0.035] p-6 sm:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d6bd7b]">Simple threshold</p>
            <div className="mt-5 grid gap-px bg-white/10 sm:grid-cols-2">
              <div className="bg-[#15130f] p-6">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/45">$200.00 or less</p>
                <p className="mt-3 font-serif text-2xl font-semibold text-white">No complimentary gift</p>
                <p className="mt-3 text-xs leading-6 text-white/55">Custom items are still available to buy normally.</p>
              </div>
              <div className="bg-[#15130f] p-6">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#d6bd7b]">Over $200.00</p>
                <p className="mt-3 font-serif text-2xl font-semibold text-[#e3cb88]">Gift reward unlocked</p>
                <p className="mt-3 text-xs leading-6 text-white/55">Choose from the marked gift range, subject to availability and verification.</p>
              </div>
            </div>
            <div className="mt-5 border border-[#d6bd7b]/28 bg-[#d6bd7b]/[0.07] p-5">
              <p className="text-xs leading-6 text-white/70">
                Example: a ${threshold.toFixed(2)} order does not qualify. A $200.01 order is over the threshold and can qualify for the complimentary WHOKEAS gift reward.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#cfc3af] bg-[#e9dfcf]">
        <div className="mx-auto grid max-w-[1500px] gap-0 lg:grid-cols-3">
          {[
            ["01", "Every custom item is for sale", "Customers can order and personalize any item in the collection without needing to reach the gift threshold."],
            ["02", "Clear starting prices", "Each card shows a competitive starting price; premium options are confirmed before payment."],
            ["03", "Over $200 reward", `The complimentary gift reward applies only when the qualifying order total is strictly greater than $${threshold}.`],
          ].map(([number, title, text]) => (
            <div key={number} className="border-b border-[#cfc3af] p-8 lg:border-b-0 lg:border-r lg:p-10 last:lg:border-r-0">
              <p className="text-[10px] font-black tracking-[0.2em] text-[#9b762c]">{number}</p>
              <h3 className="mt-4 font-serif text-2xl font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#625b50]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="bg-[#0d0c0a] px-5 py-10 text-center text-sm text-white/55">
        © 2026 WHOKEAS ALL IN · Custom Products & Rewards
      </footer>
    </main>
  );
}
