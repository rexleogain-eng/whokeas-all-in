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
      className="group block border border-[#d8cfbf] bg-[#fffdf8] transition hover:-translate-y-1 hover:border-[#b89a59] hover:shadow-[0_22px_55px_rgba(38,30,20,0.12)]"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[#f2ede4]">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-contain p-6 transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-serif text-3xl text-[#9f9586]">
            WAI
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-col gap-2">
          {discount > 0 && (
            <span className="bg-[#171512] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
              Save {discount}%
            </span>
          )}
          {product.featured && (
            <span className="border border-[#b89a59] bg-[#fffdf8]/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a6824]">
              Curated
            </span>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9b762c]">
          {product.categoryName || "General"}
        </p>
        <h3 className="mt-2 line-clamp-2 min-h-12 text-[17px] font-normal leading-6 text-[#1d1914] group-hover:text-[#8a6824]">
          {product.name}
        </h3>
        <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-[#746d62]">
          {product.shortDescription || "Selected for WHOKEAS customers."}
        </p>

        <div className="mt-5 border-t border-[#e3dbce] pt-4">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-base font-bold text-[#171512]">
                {formatPrice(product.price)}
              </p>
              {compareAt > current && (
                <p className="mt-1 text-xs text-[#9a9287] line-through">
                  {formatPrice(compareAt)}
                </p>
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9b762c]">
              View item →
            </span>
          </div>

          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#5e745f]">
            {product.deliveryDays
              ? `Estimated delivery · ${product.deliveryDays} days`
              : "Delivery confirmed at checkout"}
          </p>
        </div>
      </div>
    </Link>
  );
}
