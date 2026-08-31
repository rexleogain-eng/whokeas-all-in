import type { MetadataRoute } from "next";

import {
  DEFAULT_AUTOMATION_CONFIG,
  blockedProductReason,
} from "../lib/automation-config";
import { catalogSql } from "../lib/catalog-schema";
import { ensureGlobalMarketSchema } from "../lib/global-markets";
import {
  SITE_URL,
  US_SHIPPING_MAX_DAYS,
  US_TARGET_COUNTRY_CODE,
} from "../lib/seo";
import { isRestrictedStorefrontProduct } from "../lib/store-catalog";

export const revalidate = 3600;

const STATIC_PAGE_LAST_MODIFIED = new Date("2026-08-26T00:00:00.000Z");
const DEAL_PAGE_LAST_MODIFIED = new Date("2026-08-23T00:00:00.000Z");
const PRODUCT_TEMPLATE_LAST_MODIFIED = new Date("2026-08-24T01:34:14.824Z");

type SitemapProduct = {
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  updatedAt: string | null;
};

function productLastModified(updatedAt: string | null) {
  if (!updatedAt) {
    return PRODUCT_TEMPLATE_LAST_MODIFIED;
  }

  const productUpdatedAt = new Date(updatedAt);

  if (Number.isNaN(productUpdatedAt.getTime())) {
    return PRODUCT_TEMPLATE_LAST_MODIFIED;
  }

  return productUpdatedAt > PRODUCT_TEMPLATE_LAST_MODIFIED
    ? productUpdatedAt
    : PRODUCT_TEMPLATE_LAST_MODIFIED;
}

function sitemapEligibleProduct(product: SitemapProduct) {
  const policyText = [
    product.name,
    product.shortDescription,
    product.description,
  ]
    .filter(Boolean)
    .join(" ");

  if (blockedProductReason(policyText, DEFAULT_AUTOMATION_CONFIG)) {
    return false;
  }

  return !isRestrictedStorefrontProduct(product);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: STATIC_PAGE_LAST_MODIFIED,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/products`,
      lastModified: STATIC_PAGE_LAST_MODIFIED,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/handcrafted`,
      lastModified: STATIC_PAGE_LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/deal`,
      lastModified: DEAL_PAGE_LAST_MODIFIED,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/guides`,
      lastModified: STATIC_PAGE_LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.78,
    },
    {
      url: `${SITE_URL}/guides/digital-display-power-bank-under-30`,
      lastModified: STATIC_PAGE_LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.82,
    },
    {
      url: `${SITE_URL}/guides/bluetooth-fm-transmitter-car-charger`,
      lastModified: STATIC_PAGE_LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.82,
    },
    {
      url: `${SITE_URL}/returns-refunds`,
      lastModified: STATIC_PAGE_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/shipping-delivery`,
      lastModified: STATIC_PAGE_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  try {
    await ensureGlobalMarketSchema();
    const sql = catalogSql();

    const rows = await sql`
      SELECT
        slug,
        name,
        short_description AS "shortDescription",
        description,
        updated_at::text AS "updatedAt"
      FROM products
      WHERE status::text = 'active'
        AND COALESCE(TRIM(slug), '') <> ''
        AND EXISTS (
          SELECT 1
          FROM product_market_prices market
          WHERE market.product_id = products.id
            AND market.country_code = ${US_TARGET_COUNTRY_CODE}
            AND market.currency = 'USD'
            AND market.available = true
            AND market.selling_price_local > 0
            AND (
              market.estimated_delivery_days IS NULL
              OR market.estimated_delivery_days <= ${US_SHIPPING_MAX_DAYS}
            )
        )
      ORDER BY updated_at DESC
    `;

    const products = (rows as unknown as SitemapProduct[]).filter(
      sitemapEligibleProduct,
    );

    return [
      ...staticPages,
      ...products.map((product) => ({
        url: `${SITE_URL}/products/${encodeURIComponent(product.slug)}`,
        lastModified: productLastModified(product.updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  }
  catch (error) {
    console.error("WHOKEAS sitemap product query failed:", error);
    return staticPages;
  }
}
