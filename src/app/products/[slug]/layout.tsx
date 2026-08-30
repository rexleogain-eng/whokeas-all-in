import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { catalogSql } from "../../../lib/catalog-schema";
import {
  productLevelGtin,
  verifiedMerchantBrand,
} from "../../../lib/merchant-identifiers";
import { getStoreProductBySlug } from "../../../lib/store-catalog";
import { storefrontSummary, storefrontTitle } from "../../../lib/store-copy";
import {
  DEFAULT_SOCIAL_IMAGE,
  RETURN_POLICY_URL,
  SHIPPING_POLICY_URL,
  SITE_NAME,
  SITE_URL,
  US_RETURN_DAYS,
  usDeliveryWindow,
} from "../../../lib/seo";

type ProductRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

function metadataDescription(title: unknown, summary: unknown) {
  return storefrontSummary(title, summary).slice(0, 160);
}

function storefrontCategory(slug: string, name: unknown, categoryName: unknown) {
  const normalizedName = String(name || "");

  if (
    slug ===
      "ouhoe-peach-hair-removal-cream-gentle-non-irritant-cleaning-ladies-facial-lip-hair-quick-hair-removal-cream-198383" ||
    slug === "high-light-brightening-repair-paste-922952" ||
    /\bhair\s+removal\s+cream\b/i.test(normalizedName) ||
    /\belectric\s+nail\s+clippers?\b/i.test(normalizedName)
  ) {
    return "Beauty";
  }

  if (
    /\bweb\s*cam\b/i.test(normalizedName) ||
    /\bwalkie[-\s]?talkie\b/i.test(normalizedName) ||
    /\btwo[-\s]?way\s+radio\b/i.test(normalizedName) ||
    /\brgb\s+led\s+controller\b/i.test(normalizedName) ||
    /\bled\s+controller\b/i.test(normalizedName) ||
    /\bwireless\s+bluetooth\s+headset\b/i.test(normalizedName) ||
    /\bwireless\s+karaoke\s+(?:singing\s+)?mic(?:rophone)?\b/i.test(normalizedName)
  ) {
    return "Tech";
  }

  if (
    /\bhigh\s+pressure\s+cleaning\s+gun\b/i.test(normalizedName) ||
    /\bportable\s+power\s+washer\b/i.test(normalizedName)
  ) {
    return "Home";
  }

  if (
    /\breusable\s+cable\s+organizer\b/i.test(normalizedName) ||
    /\bcable\s+organizer\s+silicone\b/i.test(normalizedName)
  ) {
    return "Accessories";
  }

  return categoryName ? String(categoryName) : null;
}

async function readProduct(rawSlug: string) {
  const slug = decodeURIComponent(rawSlug).trim().toLowerCase();
  return getStoreProductBySlug(slug);
}

async function readSupplierRawData(productId: unknown) {
  const id = String(productId || "").trim();
  if (!id) return null;

  const sql = catalogSql();
  const rows = await sql`
    SELECT supplier_raw_data AS "supplierRawData"
    FROM products
    WHERE id = ${id}
    LIMIT 1
  `;

  return rows[0]?.supplierRawData ?? null;
}

export async function generateMetadata({
  params,
}: ProductRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await readProduct(slug);

  if (!result || !result.product.usAvailable) {
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

  if (!result || !result.product.usAvailable) {
    notFound();
  }

  const product = result.product as Record<string, unknown>;
  const images = result.images as Array<Record<string, unknown>>;
  const variants = result.variants as Array<Record<string, unknown>>;

  const productName = storefrontTitle(product.name || SITE_NAME);
  const productSlug = String(product.slug || slug);
  const categoryName = storefrontCategory(productSlug, product.name, product.categoryName);
  const productUrl =
    `${SITE_URL}/products/${encodeURIComponent(productSlug)}`;
  const imageUrls = images
    .map((image) => String(image.source || "").trim())
    .filter(Boolean);
  const description = metadataDescription(
    product.name,
    product.shortDescription || product.description,
  );
  const productBrand = verifiedMerchantBrand(product.brand, [SITE_NAME]);
  const supplierRawData = await readSupplierRawData(product.id);
  const productGtin = productLevelGtin(supplierRawData);
  const hasVariants = variants.length > 0;
  const isInStock = !hasVariants || variants.some(
    (variant) => Number(variant.stockQuantity || 0) > 0,
  );
  const deliveryWindow = usDeliveryWindow(product.deliveryDays);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    url: productUrl,
    name: productName,
    description,
    image: imageUrls,
    sku: String(product.id || productSlug),
    ...(productBrand
      ? {
          brand: {
            "@type": "Brand",
            name: productBrand,
          },
        }
      : {}),
    ...(productGtin ? { gtin: productGtin } : {}),
    ...(categoryName
      ? { category: categoryName }
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
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: deliveryWindow.minDays,
            maxValue: deliveryWindow.maxDays,
            unitCode: "DAY",
          },
        },
        shippingSettingsLink: SHIPPING_POLICY_URL,
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "US",
        returnPolicyCategory:
          "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: US_RETURN_DAYS,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees:
          "https://schema.org/ReturnFeesCustomerResponsibility",
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
