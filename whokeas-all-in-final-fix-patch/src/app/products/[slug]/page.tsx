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

  if (!result) {
    notFound();
  }

  const { product, images, variants } = result;
  const mainImage = images[0]?.source ? String(images[0].source) : null;
  const compareAt = Number(product.compareAtPrice || 0);
  const current = Number(product.price || 0);
  const discount =
    compareAt > current && compareAt > 0
      ? Math.round(((compareAt - current) / compareAt) * 100)
      : 0;

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <StoreHeader />

      <div className="mx-auto max-w-[1500px] px-4 py-5 lg:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Link href="/" className="hover:text-[#ff6a00]">Home</Link>
          <span>›</span>
          <Link href="/products" className="hover:text-[#ff6a00]">Products</Link>
          <span>›</span>
          <span>{String(product.categoryName || "General")}</span>
        </div>

        <section className="grid gap-7 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(340px,1fr)_minmax(360px,1fr)_350px]">
          <div>
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-[#f7f8fa]">
              {mainImage ? (
                <img
                  src={mainImage}
                  alt={String(product.name)}
                  className="h-full w-full object-contain p-4"
                />
              ) : (
                <div className="text-4xl font-black text-slate-300">WAI</div>
              )}
            </div>

            {images.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {images.slice(0, 4).map((image, index) => (
                  <div
                    key={`${String(image.source).slice(0, 40)}-${index}`}
                    className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-[#f7f8fa]"
                  >
                    <img
                      src={String(image.source)}
                      alt=""
                      className="h-full w-full object-contain p-1"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="py-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#fff0e6] px-3 py-1 text-xs font-black text-[#e85f00]">
                {String(product.categoryName || "General")}
              </span>
              {product.supplierPlatform === "cj" && (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                  Supplier connected
                </span>
              )}
            </div>

            <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
              {String(product.name)}
            </h1>

            <p className="mt-4 text-sm leading-7 text-slate-600">
              {String(product.shortDescription || "")}
            </p>

            <div className="mt-6 border-y border-slate-200 py-5">
              <div className="flex flex-wrap items-end gap-3">
                <p className="text-3xl font-black text-[#ff4d00]">
                  {formatPrice(String(product.price))}
                </p>
                {compareAt > current && (
                  <>
                    <p className="pb-1 text-sm text-slate-400 line-through">
                      {formatPrice(compareAt)}
                    </p>
                    <span className="mb-1 rounded-full bg-[#ff3d00] px-2 py-1 text-xs font-black text-white">
                      Save {discount}%
                    </span>
                  </>
                )}
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Price displayed in Tanzanian shillings
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#f8f9fb] p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Delivery
                </p>
                <p className="mt-2 font-bold">
                  {product.deliveryDays
                    ? `Estimated ${product.deliveryDays} days`
                    : "Confirmed before fulfilment"}
                </p>
              </div>
              <div className="rounded-2xl bg-[#f8f9fb] p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Order support
                </p>
                <p className="mt-2 font-bold">Managed by WHOKEAS ALL IN</p>
              </div>
            </div>

            {product.description && (
              <div className="mt-7">
                <h2 className="text-xl font-black">Product details</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                  {String(product.description)}
                </p>
              </div>
            )}
          </div>

          <aside className="h-fit rounded-2xl border border-orange-200 bg-[#fffaf6] p-5 lg:sticky lg:top-36">
            <p className="text-2xl font-black text-[#ff4d00]">
              {formatPrice(String(product.price))}
            </p>
            <p className="mt-2 text-sm font-bold text-emerald-700">
              Available to order
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Payment and delivery details are verified before supplier fulfilment.
            </p>

            <div className="mt-5">
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

            <div className="mt-5 space-y-3 border-t border-orange-200 pt-5 text-xs text-slate-600">
              <p>✓ Secure order recording</p>
              <p>✓ Manual payment verification</p>
              <p>✓ Supplier fulfilment control</p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
