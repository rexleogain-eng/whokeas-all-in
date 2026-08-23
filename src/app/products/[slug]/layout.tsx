import type { Metadata } from "next";

import { getStoreProductBySlug } from "../../../lib/store-catalog";
import { storefrontSummary, storefrontTitle } from "../../../lib/store-copy";
import {
  DEFAULT_SOCIAL_IMAGE,
  RETURN_POLICY_URL,
  SHIPPING_POLICY_URL,
  SITE_NAME,
  SITE_URL,
} from "../../../lib/seo";

type ProductRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

function metadataDescription(title: unknown, summary: unknown) {
  return storefrontSummary(title, summary).slice(0, 160);
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

  const productName = storefrontTitle(product.name || SITE_NAME);
  const metadataTitle = productName.length <= 70
    ? productName
    : `${productName.slice(0, 67).trimEnd()}…`;
  const productSlug = String(product.slug || slug);
  const canonicalUrl =
    `${SITE_URL}/products/${encodeURIComponent(productSlug)}`;
  const description = metadataDescription(
    product.name,
    product.shortDescription || product.description,
  );
  const imageUrls = images
    .map((image) => String(image.source || "").trim())
    .filter(Boolean);

  return {
    title: metadataTitle,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "website",
      url: canonicalUrl,
      siteName: SITE_NAME,
      title: metadataTitle,
      description,
      images: imageUrls.length > 0
        ? imageUrls
        : [DEFAULT_SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: metadataTitle,
      description,
      images: imageUrls.length > 0
        ? imageUrls
        : [DEFAULT_SOCIAL_IMAGE],
    },
    robots: {
      index: Boolean(product.usAvailable),
      follow: true,
      googleBot: {
        index: Boolean(product.usAvailable),
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

  if (!product.usAvailable) {
    return children;
  }

  const productName = storefrontTitle(product.name || SITE_NAME);
  const productSlug = String(product.slug || slug);
  const productUrl =
    `${SITE_URL}/products/${encodeURIComponent(productSlug)}`;
  const imageUrls = images
    .map((image) => String(image.source || "").trim())
    .filter(Boolean);
  const description = metadataDescription(
    product.name,
    product.shortDescription || product.description,
  );
  const hasVariants = variants.length > 0;
  const isInStock = !hasVariants || variants.some(
    (variant) => Number(variant.stockQuantity || 0) > 0,
  );

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    url: productUrl,
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
      "@id": `${productUrl}#offer`,
      url: productUrl,
      priceCurrency: "USD",
      price: Number(product.price || 0).toFixed(2),
      itemCondition: "https://schema.org/NewCondition",
      availability: isInStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@id": `${SITE_URL}/#organization`,
      },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value: "0.00",
          currency: "USD",
        },
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "US",
        },
        shippingSettingsLink: SHIPPING_POLICY_URL,
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "US",
        returnPolicyCategory:
          "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 14,
        returnMethod: "https://schema.org/ReturnByMail",
        merchantReturnLink: RETURN_POLICY_URL,
      },
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
