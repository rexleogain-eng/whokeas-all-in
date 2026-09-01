import type { Metadata } from "next";
import Link from "next/link";

import StoreHeader from "@/components/store/StoreHeader";
import StoreProductCard from "@/components/store/StoreProductCard";
import { getStoreCategories } from "@/lib/store-catalog";
import { getStoreProductPage } from "@/lib/store-catalog-page";
import {
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PRODUCTS_PER_PAGE = 60;

type ProductsPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    category?: string | string[];
    sort?: string | string[];
    page?: string | string[];
  }>;
};

function filterValue(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;

  return String(text || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function positivePage(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(text || "1"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function generateMetadata({
  searchParams,
}: ProductsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const query = filterValue(params.q);
  const category = filterValue(params.category);
  const sort = filterValue(params.sort);
  const page = positivePage(params.page);
  const canonicalQuery = new URLSearchParams();

  if (category) canonicalQuery.set("category", category);
  if (page > 1) canonicalQuery.set("page", String(page));

  const canonicalUrl = canonicalQuery.size > 0
    ? `${SITE_URL}/products?${canonicalQuery.toString()}`
    : `${SITE_URL}/products`;
  const baseTitle = query
    ? `Search results for “${query}”`
    : category
      ? `${category} Products Online`
      : "Shop Products Online in the U.S.";
  const title = page > 1 ? `${baseTitle} – Page ${page}` : baseTitle;
  const description = category
    ? `Shop ${category} products from ${SITE_NAME}, with USD pricing and free standard U.S. shipping.`
    : `Browse curated products from ${SITE_NAME}, with USD pricing, free standard U.S. shipping and clear customer support.`;
  const indexable = !query && !sort;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "website",
      url: canonicalUrl,
      siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`,
      description,
    },
    robots: {
      index: indexable,
      follow: true,
    },
  };
}

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const params = await searchParams;
  const query = filterValue(params.q);
  const category = filterValue(params.category);
  const sort = filterValue(params.sort) || "newest";
  const requestedPage = positivePage(params.page);

  const [catalogPage, categories] = await Promise.all([
    getStoreProductPage({
      query,
      category,
      sort,
      page: requestedPage,
      pageSize: PRODUCTS_PER_PAGE,
    }),
    getStoreCategories(),
  ]);

  const visibleCategories = categories.filter(
    (item) => item.name.toLowerCase() !== "study",
  );
  const {
    products,
    total: totalAvailable,
    page,
    pageSize,
    totalPages,
  } = catalogPage;
  const firstVisible = totalAvailable > 0 ? (page - 1) * pageSize + 1 : 0;
  const lastVisible = totalAvailable > 0
    ? Math.min(totalAvailable, firstVisible + products.length - 1)
    : 0;
  const productCountLabel = totalAvailable > products.length || page > 1
    ? `Showing ${firstVisible}–${lastVisible} of ${totalAvailable} products`
    : `${totalAvailable} product${totalAvailable === 1 ? "" : "s"} available`;

  const buildSortHref = (value: string) => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (category) next.set("category", category);
    next.set("sort", value);
    return `/products?${next.toString()}`;
  };

  const buildPageHref = (nextPage: number) => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (category) next.set("category", category);
    if (sort !== "newest") next.set("sort", sort);
    if (nextPage > 1) next.set("page", String(nextPage));
    const suffix = next.toString();
    return suffix ? `/products?${suffix}` : "/products";
  };

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader query={query} />

      <section className="border-b border-[#d8cfbf] bg-[#171512] text-white">
        <div className="mx-auto max-w-[1580px] px-4 py-14 sm:px-6 lg:py-20">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d6bd7b]">
            WHOKEAS Collection
          </p>
          <h1 className="mt-4 max-w-5xl text-4xl font-normal leading-tight sm:text-6xl">
            {query
              ? `Results for “${query}”`
              : category
                ? category
                : "A considered catalogue for modern living."}
          </h1>
          <p className="mt-4 text-sm text-white/55">
            {productCountLabel}
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1580px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[245px_1fr] lg:py-14">
        <aside className="h-fit border border-[#d8cfbf] bg-[#fffdf8] lg:sticky lg:top-40">
          <div className="flex items-center justify-between border-b border-[#e1d8ca] px-5 py-4">
            <h2 className="text-lg font-normal">Collections</h2>
            {(query || category) && (
              <Link href="/products" className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9b762c]">
                Clear
              </Link>
            )}
          </div>

          <div className="p-3">
            <Link
              href={query ? `/products?q=${encodeURIComponent(query)}` : "/products"}
              className={`flex items-center justify-between border-b border-[#eee7dc] px-3 py-3 text-xs font-bold uppercase tracking-[0.1em] ${
                !category
                  ? "text-[#9b762c]"
                  : "text-[#5f584e] hover:text-[#9b762c]"
              }`}
            >
              <span>All products</span>
              <span>→</span>
            </Link>

            {visibleCategories.map((item) => {
              const next = new URLSearchParams();
              if (query) next.set("q", query);
              next.set("category", item.name);
              const active = category.toLowerCase() === item.name.toLowerCase();

              return (
                <Link
                  key={item.slug}
                  href={`/products?${next.toString()}`}
                  className={`flex items-center justify-between border-b border-[#eee7dc] px-3 py-3 text-xs font-bold uppercase tracking-[0.1em] ${
                    active
                      ? "text-[#9b762c]"
                      : "text-[#5f584e] hover:text-[#9b762c]"
                  }`}
                >
                  <span>{item.name}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              );
            })}
          </div>
        </aside>

        <section>
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-[#cfc4b1] pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#746d62]">
              Selected for U.S. shoppers
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                ["newest", "Newest"],
                ["price-low", "Price low"],
                ["price-high", "Price high"],
              ].map(([value, label]) => (
                <Link
                  key={value}
                  href={buildSortHref(value)}
                  className={`border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] ${
                    sort === value
                      ? "border-[#171512] bg-[#171512] text-white"
                      : "border-[#cfc4b1] bg-[#fffdf8] text-[#5f584e] hover:border-[#9b762c] hover:text-[#9b762c]"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {products.length === 0 ? (
            <div className="border border-dashed border-[#c8bda9] bg-[#fffdf8] p-14 text-center">
              <h2 className="text-3xl font-normal">No matching products</h2>
              <p className="mt-3 text-sm text-[#746d62]">
                Try another search or return to the complete collection.
              </p>
              <Link href="/products" className="classic-button-dark mt-7">
                Browse all products
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                  <StoreProductCard key={product.id} product={product} />
                ))}
              </div>

              {totalPages > 1 && (
                <nav
                  className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#cfc4b1] pt-6"
                  aria-label="Product catalogue pages"
                >
                  {page > 1 ? (
                    <Link
                      href={buildPageHref(page - 1)}
                      className="classic-button-light"
                    >
                      ← Previous
                    </Link>
                  ) : (
                    <span className="border border-[#d8cfbf] px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#b2aa9f]">
                      ← Previous
                    </span>
                  )}

                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#746d62]">
                    Page {page} of {totalPages}
                  </p>

                  {page < totalPages ? (
                    <Link
                      href={buildPageHref(page + 1)}
                      className="classic-button-dark"
                    >
                      Next →
                    </Link>
                  ) : (
                    <span className="border border-[#d8cfbf] px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#b2aa9f]">
                      Next →
                    </span>
                  )}
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
