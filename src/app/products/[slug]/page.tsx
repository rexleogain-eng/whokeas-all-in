import Link from "next/link";
import { notFound } from "next/navigation";

import AddToCart from "@/components/store/AddToCart";
import StoreHeader from "@/components/store/StoreHeader";
import { getStoreProductBySlug } from "@/lib/store-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }>;
};

function formatPrice(value: string | number) {
  return `TZS ${Math.round(Number(value || 0)).toLocaleString("en-US")}`;
}

export default async function ProductPage({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).trim().toLowerCase();
  const result = await getStoreProductBySlug(slug);

  if (!result) notFound();

  const { product, images, variants } = result;
  const mainImage = images[0]?.source ? String(images[0].source) : null;
  const compareAt = Number(product.compareAtPrice || 0);
  const current = Number(product.price || 0);
  const discount =
    compareAt > current && compareAt > 0
      ? Math.round(((compareAt - current) / compareAt) * 100)
      : 0;

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader />

      <div className="mx-auto max-w-[1520px] px-4 py-6 sm:px-6 lg:py-10">
        <div className="mb-6 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#81796e]">
          <Link href="/" className="hover:text-[#9b762c]">Home</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-[#9b762c]">Collection</Link>
          <span>/</span>
          <span>{String(product.categoryName || "General")}</span>
        </div>

        <section className="grid border border-[#d8cfbf] bg-[#fffdf8] lg:grid-cols-[minmax(380px,1.05fr)_minmax(360px,.95fr)_340px]">
          <div className="border-b border-[#d8cfbf] p-5 lg:border-b-0 lg:border-r lg:p-8">
            <div className="flex aspect-square items-center justify-center overflow-hidden bg-[#f1ece3]">
              {mainImage ? (
                <img
                  src={mainImage}
                  alt={String(product.name)}
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
                {String(product.categoryName || "General")}
              </span>
              {product.supplierPlatform === "cj" && (
                <span className="border-l border-[#d8cfbf] pl-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5b745f]">
                  Supplier verified
                </span>
              )}
            </div>

            <h1 className="mt-5 text-4xl font-normal leading-tight sm:text-5xl">
              {String(product.name)}
            </h1>
            <p className="mt-5 text-sm leading-7 text-[#6f675c]">
              {String(product.shortDescription || "")}
            </p>

            <div className="mt-7 border-y border-[#ddd4c6] py-6">
              <div className="flex flex-wrap items-end gap-3">
                <p className="text-3xl font-bold text-[#171512]">
                  {formatPrice(String(product.price))}
                </p>
                {compareAt > current && (
                  <>
                    <p className="pb-1 text-sm text-[#9d958a] line-through">{formatPrice(compareAt)}</p>
                    <span className="mb-1 bg-[#171512] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                      Save {discount}%
                    </span>
                  </>
                )}
              </div>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#81796e]">
                Price displayed in Tanzanian shillings
              </p>
            </div>

            <div className="mt-7 grid border-l border-t border-[#ddd4c6] sm:grid-cols-2">
              <div className="border-b border-r border-[#ddd4c6] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9b762c]">Delivery</p>
                <p className="mt-2 text-sm font-semibold">
                  {product.deliveryDays ? `Estimated ${product.deliveryDays} days` : "Confirmed before fulfilment"}
                </p>
              </div>
              <div className="border-b border-r border-[#ddd4c6] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9b762c]">Order support</p>
                <p className="mt-2 text-sm font-semibold">Managed locally by WHOKEAS</p>
              </div>
            </div>

            {product.description && (
              <div className="mt-8">
                <h2 className="text-2xl font-normal">Product details</h2>
                <div className="classic-rule mt-4" />
                <p className="mt-5 whitespace-pre-line text-sm leading-8 text-[#6f675c]">
                  {String(product.description)}
                </p>
              </div>
            )}
          </div>

          <aside className="h-fit bg-[#f7f2e9] p-6 lg:sticky lg:top-36 lg:p-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9b762c]">Your selection</p>
            <p className="mt-3 text-2xl font-bold">{formatPrice(String(product.price))}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-[#5b745f]">Available to order</p>
            <p className="mt-4 text-xs leading-6 text-[#746d62]">
              Payment and delivery details are verified before supplier fulfilment.
            </p>

            <div className="mt-6">
              <AddToCart
                product={{
                  id: String(product.id),
                  slug: String(product.slug),
                  name: String(product.name),
                  price: String(product.price),
                }}
                variants={variants.map((variant) => ({
                  id: String(variant.id),
                  name: String(variant.name),
                  price: String(variant.price),
                  stockQuantity: Number(variant.stockQuantity),
                }))}
              />
            </div>

            <div className="mt-6 space-y-3 border-t border-[#d8cfbf] pt-6 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e665b]">
              <p>✓ Secure order recording</p>
              <p>✓ Manual payment verification</p>
              <p>✓ Controlled supplier fulfilment</p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
