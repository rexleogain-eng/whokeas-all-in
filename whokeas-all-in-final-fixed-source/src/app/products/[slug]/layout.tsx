import type { Metadata } from "next";

import { getStoreProductBySlug } from "../../../lib/store-catalog";
import {
  DEFAULT_SOCIAL_IMAGE,
  SITE_NAME,
  SITE_URL,
} from "../../../lib/seo";

type ProductRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

type ProductRecord = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  price: string;
  brand: string | null;
  categoryName: string | null;
};

type ProductImage = {
  source: string | null;
};

type ProductVariant = {
  stockQuantity: number | null;
};

function cleanDescription(value: string | null | undefined) {
  return (
    value
      ?.replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160) ||
    `Buy this product online from ${SITE_NAME}.`
  );
}

async function readProduct(slug: string) {
  const result = await getStoreProductBySlug(slug);

  if (!result) {
    return null;
  }

  return {
    product: result.product as unknown as ProductRecord,
    images: result.images as unknown as ProductImage[],
    variants: result.variants as unknown as ProductVariant[],
  };
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

  const { product, images } = result;
  const canonicalUrl = `${SITE_URL}/products/${encodeURIComponent(product.slug)}`;
  const description = cleanDescription(
    product.shortDescription || product.description,
  );
  const imageUrls = images
    .map((image) => image.source)
    .filter((image): image is string => Boolean(image));

  return {
    title: product.name,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "website",
      url: canonicalUrl,
      siteName: SITE_NAME,
      title: product.name,
      description,
      images: imageUrls.length > 0 ? imageUrls : [DEFAULT_SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      images: imageUrls.length > 0 ? imageUrls : [DEFAULT_SOCIAL_IMAGE],
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

  const { product, images, variants } = result;
  const canonicalUrl = `${SITE_URL}/products/${encodeURIComponent(product.slug)}`;
  const imageUrls = images
    .map((image) => image.source)
    .filter((image): image is string => Boolean(image));
  const hasKnownStock = variants.length > 0;
  const isInStock = variants.some(
    (variant) => Number(variant.stockQuantity || 0) > 0,
  );

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: cleanDescription(
      product.shortDescription || product.description,
    ),
    image: imageUrls,
    sku: product.id,
    brand: {
      "@type": "Brand",
      name: product.brand || SITE_NAME,
    },
    ...(product.categoryName
      ? { category: product.categoryName }
      : {}),
    offers: {
      "@type": "Offer",
      url: canonicalUrl,
      priceCurrency: "TZS",
      price: Number(product.price || 0).toFixed(2),
      itemCondition: "https://schema.org/NewCondition",
      ...(hasKnownStock
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