import Link from "next/link";

import type { StoreProduct } from "@/lib/store-catalog";

function formatPrice(value: string | number) {
  return `TZS ${Math.round(Number(value || 0)).toLocaleString("en-US")}`;
}

export default function StoreProductCard({
  product,
}: {
  product: StoreProduct;
}) {
  const compareAt = Number(product.compareAtPrice || 0);
  const current = Number(product.price || 0);
  const discount =
    compareAt > current && compareAt > 0
      ? Math.round(((compareAt - current) / compareAt) * 100)
      : 0;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-xl"
    >
      <div className="relative aspect-square overflow-hidden bg-[#f7f8fa]">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl font-black text-slate-300">
            WAI
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-col gap-2">
          {discount > 0 && (
            <span className="rounded-full bg-[#ff3d00] px-2.5 py-1 text-[11px] font-black text-white">
              -{discount}%
            </span>
          )}
          {product.featured && (
            <span className="rounded-full bg-[#fff0e6] px-2.5 py-1 text-[11px] font-black text-[#e85f00]">
              Featured
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-[#ff6a00]">
          {product.categoryName || "General"}
        </p>
        <h3 className="mt-2 line-clamp-2 min-h-11 font-bold leading-5 text-slate-900 group-hover:text-[#e85f00]">
          {product.name}
        </h3>
        <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">
          {product.shortDescription || "Selected for WHOKEAS customers."}
        </p>

        <div className="mt-4 flex items-end justify-between gap-2">
          <div>
            <p className="text-lg font-black text-[#ff4d00]">
              {formatPrice(product.price)}
            </p>
            {compareAt > current && (
              <p className="text-xs text-slate-400 line-through">
                {formatPrice(compareAt)}
              </p>
            )}
          </div>
          <span className="rounded-full bg-[#ff6a00] px-3 py-2 text-xs font-black text-white">
            View
          </span>
        </div>

        <p className="mt-3 text-[11px] font-semibold text-emerald-700">
          {product.deliveryDays
            ? `Estimated delivery: ${product.deliveryDays} days`
            : "Delivery confirmed at checkout"}
        </p>
      </div>
    </Link>
  );
}
