import type { Metadata } from "next";

import { getStoreProductBySlug } from "../../../lib/store-catalog";
import {
  DEFAULT_SOCIAL_IMAGE,
  SITE_NAME,
  SITE_URL,
} from "../../../lib/seo";
import { tzsToStoreUsd } from "../../../lib/store-currency";

type ProductRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

function cleanText(value: unknown, fallback: string) {
  const text = String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (text || fallback).slice(0, 160);
}

async function readProduct(rawSlug: string) {
  const slug = decodeURIComponent(rawSlug).trim().toLowerCase();
  return getStoreProductBySlug(slug);
}

export async function generateMetadata({
  params,
}: ProductRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await readProduct(slug);

  if (!result) {
    return {
      title: "Product not found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const product = result.product as Record<string, unknown>;
  const images = result.images as Array<Record<string, unknown>>;

  const productName = String(product.name || SITE_NAME);
  const productSlug = String(product.slug || slug);
  const canonicalUrl =
    `${SITE_URL}/products/${encodeURIComponent(productSlug)}`;
  const description = cleanText(
    product.shortDescription || product.description,
    `Buy ${productName} online from ${SITE_NAME}.`,
  );
  const imageUrls = images
    .map((image) => String(image.source || "").trim())
    .filter(Boolean);

  return {
    title: productName,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "website",
      url: canonicalUrl,
      siteName: SITE_NAME,
      title: productName,
      description,
      images: imageUrls.length > 0
        ? imageUrls
        : [DEFAULT_SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: productName,
      description,
      images: imageUrls.length > 0
        ? imageUrls
        : [DEFAULT_SOCIAL_IMAGE],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export default async function ProductSeoLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{
    slug: string;
  }>;
}>) {
  const { slug } = await params;
  const result = await readProduct(slug);

  if (!result) {
    return children;
  }

  const product = result.product as Record<string, unknown>;
  const images = result.images as Array<Record<string, unknown>>;
  const variants = result.variants as Array<Record<string, unknown>>;

  const productName = String(product.name || SITE_NAME);
  const productSlug = String(product.slug || slug);
  const productUrl =
    `${SITE_URL}/products/${encodeURIComponent(productSlug)}`;
  const imageUrls = images
    .map((image) => String(image.source || "").trim())
    .filter(Boolean);
  const description = cleanText(
    product.shortDescription || product.description,
    `Buy ${productName} online from ${SITE_NAME}.`,
  );
  const hasVariants = variants.length > 0;
  const isInStock = variants.some(
    (variant) => Number(variant.stockQuantity || 0) > 0,
  );

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: productName,
    description,
    image: imageUrls,
    sku: String(product.id || productSlug),
    brand: {
      "@type": "Brand",
      name: String(product.brand || SITE_NAME),
    },
    ...(product.categoryName
      ? { category: String(product.categoryName) }
      : {}),
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "USD",
      price: tzsToStoreUsd(Number(product.price || 0)).toFixed(2),
      itemCondition: "https://schema.org/NewCondition",
      ...(hasVariants
        ? {
            availability: isInStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          }
        : {}),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      {children}
    </>
  );
}