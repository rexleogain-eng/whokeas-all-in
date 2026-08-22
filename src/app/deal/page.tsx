import type { Metadata } from "next";
import Link from "next/link";

import AddToCart from "@/components/store/AddToCart";
import StoreHeader from "@/components/store/StoreHeader";
import {
  getStoreProductBySlug,
  getStoreProducts,
  type StoreProduct,
} from "@/lib/store-catalog";
import { formatStorePrice } from "@/lib/store-currency";
import {
  SITE_NAME,
  SITE_URL,
  US_RETURN_DAYS,
  US_SHIPPING_MAX_DAYS,
  US_SHIPPING_MIN_DAYS,
} from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Featured U.S. Deal",
  description:
    "Shop a focused WHOKEAS featured offer with USD pricing, free standard U.S. shipping and a clear return-request window.",
  alternates: {
    canonical: `${SITE_URL}/deal`,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/deal`,
    siteName: SITE_NAME,
    title: `Featured U.S. Deal | ${SITE_NAME}`,
    description:
      "One focused WHOKEAS offer for U.S. shoppers with secure checkout and free standard shipping.",
  },
};

function dealScore(product: StoreProduct) {
  const price = Number(product.price || 0);
  const deliveryDays = Number(product.deliveryDays || 0);
  const name = String(product.name || "").toLowerCase();
  let score = 0;

  if (price >= 15 && price <= 35) score += 10;
  else if (price > 35 && price <= 55) score += 6;
  else if (price > 55 && price <= 75) score += 2;
  else if (price > 100) score -= 6;

  if (deliveryDays > 0 && deliveryDays <= 12) score += 9;
  else if (deliveryDays <= 16) score += 6;
  else if (deliveryDays <= 21) score += 2;

  if (product.image) score += 5;
  if (product.featured) score += 4;
  if (/wireless|portable|smart|organizer|charger|earbud|home|travel/.test(name)) {
    score += 3;
  }
  if (name.length > 95) score -= 5;
  if (/undefined|null|v4[.-]?[12]/.test(name)) score -= 8;

  return score;
}

function compactTitle(value: string) {
  const title = String(value || "").replace(/\s+/g, " ").trim();
  if (title.length <= 88) return title;
  return `${title.slice(0, 85).trimEnd()}…`;
}

export default async function DealPage() {
  const candidates = await getStoreProducts({
    limit: 100,
    sort: "newest",
  });

  const selected = [...candidates].sort(
    (left, right) => dealScore(right) - dealScore(left),
  )[0];

  if (!selected) {
    return (
      <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
        <StoreHeader />
        <div className="mx-auto max-w-4xl px-5 py-20 text-center">
          <h1 className="text-5xl font-normal">Featured offer updating.</h1>
          <p className="mt-5 text-[#746d62]">
            Browse the current U.S. collection while the next featured offer is selected.
          </p>
          <Link href="/products" className="classic-button-dark mt-8">
            Shop the collection
          </Link>
        </div>
      </main>
    );
  }

  const result = await getStoreProductBySlug(selected.slug);

  if (!result || !result.product.usAvailable) {
    return (
      <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
        <StoreHeader />
        <div className="mx-auto max-w-4xl px-5 py-20 text-center">
          <h1 className="text-5xl font-normal">This offer just changed.</h1>
          <p className="mt-5 text-[#746d62]">
            Explore products currently available for U.S. delivery.
          </p>
          <Link href="/products" className="classic-button-dark mt-8">
            Browse available products
          </Link>
        </div>
      </main>
    );
  }

  const { product, images, variants } = result;
  const title = compactTitle(String(product.name));
  const mainImage = images[0]?.source ? String(images[0].source) : null;
  const current = Number(product.price || 0);
  const compareAt = Number(product.compareAtPrice || 0);
  const discount = compareAt > current && compareAt > 0
    ? Math.round(((compareAt - current) / compareAt) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader />

      <section className="border-b border-[#2d2923] bg-[#171512] text-white">
        <div className="mx-auto max-w-[1450px] px-5 py-5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-[#d6bd7b] sm:px-7">
          Featured WHOKEAS offer · U.S. delivery · Secure checkout
        </div>
      </section>

      <section className="mx-auto grid max-w-[1450px] gap-0 border-x border-b border-[#d8cfbf] bg-[#fffdf8] lg:grid-cols-[1.05fr_.95fr]">
        <div className="flex min-h-[520px] items-center justify-center border-b border-[#d8cfbf] bg-[#f0ebe2] p-7 lg:min-h-[690px] lg:border-b-0 lg:border-r lg:p-12">
          {mainImage ? (
            <img
              src={mainImage}
              alt={title}
              className="max-h-[620px] w-full object-contain"
            />
          ) : (
            <div className="text-7xl font-black text-[#aaa093]">WAI</div>
          )}
        </div>

        <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9b762c]">
            Today’s focused pick
          </p>

          <h1 className="mt-5 text-4xl font-normal leading-tight sm:text-6xl">
            {title}
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#6f675c] sm:text-base">
            {String(
              product.shortDescription ||
                "A practical WHOKEAS selection chosen for value, availability and U.S. delivery.",
            )}
          </p>

          <div className="mt-7 flex flex-wrap items-end gap-3 border-y border-[#ddd4c6] py-6">
            <p className="text-4xl font-black">
              {formatStorePrice(current)}
            </p>
            {compareAt > current && (
              <>
                <p className="pb-1 text-base text-[#9d958a] line-through">
                  {formatStorePrice(compareAt)}
                </p>
                <span className="mb-1 bg-[#171512] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                  Save {discount}%
                </span>
              </>
            )}
          </div>

          <div className="mt-7 grid gap-px border border-[#d8cfbf] bg-[#d8cfbf] sm:grid-cols-3">
            <div className="bg-[#f7f2e9] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9b762c]">
                Shipping
              </p>
              <p className="mt-2 text-sm font-bold">Free U.S. standard</p>
            </div>
            <div className="bg-[#f7f2e9] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9b762c]">
                Delivery
              </p>
              <p className="mt-2 text-sm font-bold">
                {product.deliveryDays
                  ? `About ${product.deliveryDays} days`
                  : `${US_SHIPPING_MIN_DAYS}–${US_SHIPPING_MAX_DAYS} days`}
              </p>
            </div>
            <div className="bg-[#f7f2e9] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9b762c]">
                Returns
              </p>
              <p className="mt-2 text-sm font-bold">{US_RETURN_DAYS}-day request window</p>
            </div>
          </div>

          <div className="mt-8 max-w-lg">
            <AddToCart
              product={{
                id: String(product.id),
                slug: String(product.slug),
                name: String(product.name),
                price: String(current),
              }}
              variants={variants.map((variant) => ({
                id: String(variant.id),
                name: String(variant.name),
                price: String(variant.price),
                stockQuantity: Number(variant.stockQuantity),
              }))}
            />
          </div>

          <p className="mt-5 text-xs leading-6 text-[#746d62]">
            Guest checkout is available. Card details are handled by the secure payment provider, not stored by WHOKEAS.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1450px] px-5 py-12 sm:px-7 lg:py-16">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            ["01", "Focused value", "Selected from the live U.S. catalogue for price, delivery speed and storefront quality."],
            ["02", "Protected purchase", "Clear order confirmation, payment verification and direct WHOKEAS order support."],
            ["03", "No account required", "Buy as a guest, choose your option and move straight into checkout."],
          ].map(([number, heading, text]) => (
            <div key={number} className="border border-[#d8cfbf] bg-[#fffdf8] p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9b762c]">
                {number}
              </p>
              <h2 className="mt-3 text-2xl font-normal">{heading}</h2>
              <p className="mt-3 text-sm leading-7 text-[#6f675c]">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href={`/products/${encodeURIComponent(String(product.slug))}`}
            className="text-xs font-black uppercase tracking-[0.14em] text-[#9b762c] hover:text-[#171512]"
          >
            View full product details →
          </Link>
        </div>
      </section>
    </main>
  );
}
