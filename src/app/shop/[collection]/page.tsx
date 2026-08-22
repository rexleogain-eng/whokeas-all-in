import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import StoreHeader from "@/components/store/StoreHeader";
import StoreProductCard from "@/components/store/StoreProductCard";
import { getStoreProducts } from "@/lib/store-catalog";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

type CollectionConfig = {
  title: string;
  eyebrow: string;
  description: string;
  query: string;
  searchIntent: string;
};

const collections: Record<string, CollectionConfig> = {
  "portable-power-banks": {
    title: "Portable Power Banks & Backup Chargers",
    eyebrow: "Portable charging",
    description:
      "Shop portable power banks and backup chargers selected for everyday carry, travel and convenient charging, with USD pricing and free standard U.S. shipping.",
    query: "power bank",
    searchIntent: "portable power banks and backup chargers",
  },
  "car-fm-transmitters": {
    title: "Wireless Car FM Transmitters",
    eyebrow: "Car audio accessories",
    description:
      "Browse wireless car FM transmitters and practical in-car audio accessories for everyday driving, with clear USD pricing and free standard U.S. shipping.",
    query: "fm transmitter",
    searchIntent: "wireless car FM transmitters",
  },
  "beauty-grooming-essentials": {
    title: "Beauty & Grooming Essentials",
    eyebrow: "Everyday beauty",
    description:
      "Explore practical beauty and grooming essentials for simple at-home routines, with transparent USD pricing and free standard U.S. shipping.",
    query: "hair",
    searchIntent: "beauty and grooming essentials",
  },
};

type PageProps = {
  params: Promise<{ collection: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { collection } = await params;
  const config = collections[collection];

  if (!config) {
    return {
      title: "Collection not found",
      robots: { index: false, follow: false },
    };
  }

  const url = `${SITE_URL}/shop/${collection}`;

  return {
    title: config.title,
    description: config.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: SITE_NAME,
      title: `${config.title} | ${SITE_NAME}`,
      description: config.description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${config.title} | ${SITE_NAME}`,
      description: config.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function BuyerCollectionPage({ params }: PageProps) {
  const { collection } = await params;
  const config = collections[collection];
  if (!config) notFound();

  const products = await getStoreProducts({
    query: config.query,
    limit: 24,
    sort: "newest",
  });

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: config.title,
    description: config.description,
    url: `${SITE_URL}/shop/${collection}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: products.slice(0, 12).map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}/products/${encodeURIComponent(product.slug)}`,
        name: product.name,
      })),
    },
  };

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <section className="border-b border-[#2d2923] bg-[#171512] text-white">
        <div className="mx-auto max-w-[1450px] px-5 py-14 sm:px-7 lg:py-20">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d6bd7b]">
            {config.eyebrow} · U.S. shopping
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl font-normal leading-tight sm:text-7xl">
            {config.title}
          </h1>
          <p className="mt-6 max-w-3xl text-sm leading-7 text-white/65 sm:text-base">
            {config.description}
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">
            <span className="border border-white/15 px-3 py-2">USD pricing</span>
            <span className="border border-white/15 px-3 py-2">Free U.S. standard shipping</span>
            <span className="border border-white/15 px-3 py-2">Guest checkout</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1450px] px-5 py-12 sm:px-7 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9b762c]">
              Shop {config.searchIntent}
            </p>
            <h2 className="mt-3 text-3xl font-normal sm:text-4xl">
              Current U.S.-available picks
            </h2>
          </div>
          <Link
            href="/products"
            className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9b762c] hover:text-[#171512]"
          >
            Browse all products →
          </Link>
        </div>

        {products.length > 0 ? (
          <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((product) => (
              <StoreProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="mt-9 border border-[#d8cfbf] bg-[#fffdf8] p-10 text-center">
            <h2 className="text-2xl font-normal">This collection is being refreshed.</h2>
            <p className="mt-3 text-sm leading-7 text-[#746d62]">
              Browse the full U.S. catalogue while new matching products are reviewed.
            </p>
            <Link href="/products" className="classic-button-dark mt-7">
              Shop all products
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
