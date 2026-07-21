import Link from "next/link";

import StoreHeader from "@/components/store/StoreHeader";
import StoreProductCard from "@/components/store/StoreProductCard";
import {
  getStoreCategories,
  getStoreProducts,
} from "@/lib/store-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProductsPageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
  }>;
};

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const params = await searchParams;
  const query = (params.q || "").trim();
  const category = (params.category || "").trim();
  const sort = params.sort || "newest";

  const [products, categories] = await Promise.all([
    getStoreProducts({ query, category, sort, limit: 60 }),
    getStoreCategories(),
  ]);

  const buildSortHref = (value: string) => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (category) next.set("category", category);
    next.set("sort", value);
    return `/products?${next.toString()}`;
  };

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <StoreHeader query={query} />

      <section className="border-b border-orange-100 bg-gradient-to-r from-[#fff7f0] to-white">
        <div className="mx-auto max-w-[1600px] px-4 py-9 lg:px-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff6a00]">
            WHOKEAS marketplace
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-5xl">
            {query
              ? `Search results for “${query}”`
              : category
                ? category
                : "Explore all products"}
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            {products.length} product{products.length === 1 ? "" : "s"} found
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-7 lg:grid-cols-[240px_1fr] lg:px-6">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-36">
          <div className="flex items-center justify-between">
            <h2 className="font-black">Categories</h2>
            {(query || category) && (
              <Link href="/products" className="text-xs font-bold text-[#ff6a00]">
                Clear
              </Link>
            )}
          </div>

          <div className="mt-4 space-y-1">
            <Link
              href={query ? `/products?q=${encodeURIComponent(query)}` : "/products"}
              className={`block rounded-xl px-3 py-2.5 text-sm font-semibold ${
                !category
                  ? "bg-[#fff0e6] text-[#e85f00]"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All products
            </Link>
            {categories.map((item) => {
              const next = new URLSearchParams();
              if (query) next.set("q", query);
              next.set("category", item.name);

              return (
                <Link
                  key={item.slug}
                  href={`/products?${next.toString()}`}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold ${
                    category.toLowerCase() === item.name.toLowerCase()
                      ? "bg-[#fff0e6] text-[#e85f00]"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span>{item.name}</span>
                  <span className="text-xs text-slate-400">{item.count}</span>
                </Link>
              );
            })}
          </div>
        </aside>

        <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-600">
              Products selected for Tanzania
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              {[
                ["newest", "Newest"],
                ["price-low", "Price: low to high"],
                ["price-high", "Price: high to low"],
              ].map(([value, label]) => (
                <Link
                  key={value}
                  href={buildSortHref(value)}
                  className={`rounded-full px-4 py-2 ${
                    sort === value
                      ? "bg-[#ff6a00] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-[#fff0e6] hover:text-[#e85f00]"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-orange-200 bg-white p-12 text-center">
              <h2 className="text-2xl font-black">No matching products yet</h2>
              <p className="mt-3 text-sm text-slate-500">
                Try another search or clear the category filter.
              </p>
              <Link
                href="/products"
                className="mt-6 inline-block rounded-full bg-[#ff6a00] px-6 py-3 text-sm font-black text-white"
              >
                Browse all products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {products.map((product) => (
                <StoreProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
