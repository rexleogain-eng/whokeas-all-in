import Link from "next/link";
import { notFound } from "next/navigation";

import AddToCart from "@/components/store/AddToCart";
import StoreHeader from "@/components/store/StoreHeader";
import {
  SHIPPING_POLICY_URL,
  US_RETURN_DAYS,
  usDeliveryWindow,
} from "@/lib/seo";
import { getStoreProductBySlug } from "@/lib/store-catalog";
import { storefrontSummary, storefrontTitle } from "@/lib/store-copy";
import {
  storefrontProductDetails,
  storefrontVariantName,
} from "@/lib/store-product-display";
import { formatStorePrice } from "@/lib/store-currency";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }>;
};

function storefrontCategory(slug: string, name: string, categoryName: unknown) {
  if (
    slug ===
      "ouhoe-peach-hair-removal-cream-gentle-non-irritant-cleaning-ladies-facial-lip-hair-quick-hair-removal-cream-198383" ||
    /\bhair\s+removal\s+cream\b/i.test(name)
  ) {
    return "Beauty";
  }

  if (
    /\bweb\s*cam\b/i.test(name) ||
    /\bwalkie[-\s]?talkie\b/i.test(name) ||
    /\btwo[-\s]?way\s+radio\b/i.test(name) ||
    /\brgb\s+led\s+controller\b/i.test(name) ||
    /\bled\s+controller\b/i.test(name)
  ) {
    return "Tech";
  }

  return String(categoryName || "General");
}

export default async function ProductPage({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).trim().toLowerCase();
  const result = await getStoreProductBySlug(slug);

  if (!result) notFound();

  const { product, images, variants } = result;
  const rawName = String(product.name || "");
  const displayName = storefrontTitle(rawName);
  const displaySummary = storefrontSummary(rawName, product.shortDescription);
  const displayDetails = storefrontProductDetails(product.description);
  const categoryLabel = storefrontCategory(slug, rawName, product.categoryName);
  const deliveryWindow = usDeliveryWindow(product.deliveryDays);
  const displayVariants = variants.map((variant) => ({
    id: String(variant.id),
    name: storefrontVariantName(rawName, variant.name),
    price: String(variant.price),
    stockQuantity: Number(variant.stockQuantity),
  }));
  const mainImage = images[0]?.source ? String(images[0].source) : null;
  const compareAt = Number(product.compareAtPrice || 0);
  const current = Number(product.price || 0);
  const usAvailable = Boolean(product.usAvailable);
  const inStock = displayVariants.length === 0 || displayVariants.some(
    (variant) => variant.stockQuantity > 0,
  );
  const purchasable = usAvailable && inStock;
  const discount =
    compareAt > current && compareAt > 0
      ? Math.round(((compareAt - current) / compareAt) * 100)
      : 0;

  const buyerGuide = /power\s*bank/i.test(rawName)
    ? {
        href: "/guides/digital-display-power-bank-under-30",
        kicker: "Portable power buyer guide",
        title: "What to check before choosing a power bank",
        text: "Compare capacity, charging ports, size and battery-level visibility before deciding which portable charger fits your routine.",
      }
    : /fm\s*transmitter/i.test(rawName)
      ? {
          href: "/guides/bluetooth-fm-transmitter-car-charger",
          kicker: "Car audio buyer guide",
          title: "What to look for in an FM transmitter",
          text: "See how frequency controls, Bluetooth pairing, charging ports and fit affect everyday use in an older car stereo setup.",
        }
      : null;

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader />

      <div className="mx-auto max-w-[1520px] px-4 py-6 sm:px-6 lg:py-10">
        <div className="mb-6 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#81796e]">
          <Link href="/" className="hover:text-[#9b762c]">Home</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-[#9b762c]">Collection</Link>
          <span>/</span>
          <span>{categoryLabel}</span>
        </div>

        <section className="grid border border-[#d8cfbf] bg-[#fffdf8] lg:grid-cols-[minmax(380px,1.05fr)_minmax(360px,.95fr)_340px]">
          <div className="border-b border-[#d8cfbf] p-5 lg:border-b-0 lg:border-r lg:p-8">
            <div className="flex aspect-square items-center justify-center overflow-hidden bg-[#f1ece3]">
              {mainImage ? (
                <img
                  src={mainImage}
                  alt={displayName}
                  className="h-full w-full object-contain p-8"
                />
              ) : (
                <div className="font-serif text-5xl text-[#9f9586]">WAI</div>
              )}
            </div>

            {images.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {images.slice(0, 4).map((image, index) => (
                  <div
                    key={`${String(image.source).slice(0, 40)}-${index}`}
                    className="aspect-square overflow-hidden border border-[#d8cfbf] bg-[#f1ece3]"
                  >
                    <img src={String(image.source)} alt="" className="h-full w-full object-contain p-2" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-b border-[#d8cfbf] p-6 sm:p-9 lg:border-b-0 lg:border-r lg:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9b762c]">
                {categoryLabel}
              </span>
              <span className="border-l border-[#d8cfbf] pl-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5b745f]">
                WHOKEAS selection
              </span>
            </div>

            <h1 className="mt-5 text-4xl font-normal leading-tight sm:text-5xl">
              {displayName}
            </h1>
            <p className="mt-5 text-sm leading-7 text-[#6f675c]">
              {displaySummary}
            </p>

            <div className="mt-7 border-y border-[#ddd4c6] py-6">
              <div className="flex flex-wrap items-end gap-3">
                <p className="text-3xl font-bold text-[#171512]">
                  {formatStorePrice(current)}
                </p>
                {compareAt > current && (
                  <>
                    <p className="pb-1 text-sm text-[#9d958a] line-through">{formatStorePrice(compareAt)}</p>
                    <span className="mb-1 bg-[#171512] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                      Save {discount}%
                    </span>
                  </>
                )}
              </div>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#81796e]">
                Price displayed in U.S. dollars
              </p>
            </div>

            <div className="mt-7 grid border-l border-t border-[#ddd4c6] sm:grid-cols-3">
              <div className="border-b border-r border-[#ddd4c6] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9b762c]">Delivery</p>
                <p className="mt-2 text-sm font-semibold">
                  Free U.S. shipping · {deliveryWindow.minDays}–{deliveryWindow.maxDays} days
                </p>
              </div>
              <div className="border-b border-r border-[#ddd4c6] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9b762c]">Returns</p>
                <p className="mt-2 text-sm font-semibold">{US_RETURN_DAYS}-day return-request window</p>
              </div>
              <div className="border-b border-r border-[#ddd4c6] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9b762c]">Order support</p>
                <p className="mt-2 text-sm font-semibold">Direct help from WHOKEAS</p>
              </div>
            </div>

            {buyerGuide && (
              <Link
                href={buyerGuide.href}
                className="mt-8 block border border-[#c9b98f] bg-[#f7f2e9] p-5 transition hover:border-[#9b762c] hover:bg-[#f1e8d8]"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9b762c]">
                  {buyerGuide.kicker}
                </p>
                <h2 className="mt-2 text-xl font-normal text-[#1d1914]">{buyerGuide.title}</h2>
                <p className="mt-2 text-sm leading-7 text-[#746d62]">{buyerGuide.text}</p>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a6824]">
                  Read the guide →
                </p>
              </Link>
            )}

            {displayDetails && (
              <div className="mt-8">
                <h2 className="text-2xl font-normal">Product details</h2>
                <div className="classic-rule mt-4" />
                <p className="mt-5 whitespace-pre-line text-sm leading-8 text-[#6f675c]">
                  {displayDetails}
                </p>
              </div>
            )}
          </div>

          <aside className="h-fit bg-[#f7f2e9] p-6 lg:sticky lg:top-36 lg:p-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9b762c]">Your selection</p>
            <p className="mt-3 text-2xl font-bold">{formatStorePrice(current)}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-[#5b745f]">
              {purchasable
                ? "Available for U.S. delivery"
                : usAvailable
                  ? "Currently out of stock"
                  : "Not available for U.S. delivery"}
            </p>
            <p className="mt-4 text-xs leading-6 text-[#746d62]">
              Price shown in USD. Standard U.S. shipping is free and estimated
              at {deliveryWindow.minDays}–{deliveryWindow.maxDays} days.
            </p>

            {purchasable ? (
              <div className="mt-6">
                <AddToCart
                  product={{
                    id: String(product.id),
                    slug: String(product.slug),
                    name: displayName,
                    price: String(current),
                  }}
                  variants={displayVariants}
                />
              </div>
            ) : (
              <Link href="/products" className="classic-button-dark mt-6 w-full text-center">
                Browse available products
              </Link>
            )}

            <div className="mt-6 space-y-3 border-t border-[#d8cfbf] pt-6 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e665b]">
              <p>✓ Free U.S. standard shipping</p>
              <p>✓ {US_RETURN_DAYS}-day return-request window</p>
              <p>✓ Direct order support</p>
            </div>

            <Link
              href={SHIPPING_POLICY_URL}
              className="mt-5 block text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[#9b762c] hover:text-[#171512]"
            >
              Shipping details →
            </Link>
          </aside>
        </section>
      </div>
    </main>
  );
}
