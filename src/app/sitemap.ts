import type { MetadataRoute } from "next";

import { catalogSql } from "../lib/catalog-schema";
import { ensureGlobalMarketSchema } from "../lib/global-markets";
import {
  SITE_URL,
  US_SHIPPING_MAX_DAYS,
  US_TARGET_COUNTRY_CODE,
} from "../lib/seo";

export const revalidate = 3600;

const STATIC_PAGE_LAST_MODIFIED = new Date("2026-08-22T00:00:00.000Z");
const DEAL_PAGE_LAST_MODIFIED = new Date("2026-08-22T00:00:00.000Z");

type SitemapProduct = {
  slug: string;
  updatedAt: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

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
      url: `${SITE_URL}/deal`,
      lastModified: DEAL_PAGE_LAST_MODIFIED,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/shop/portable-power-banks`,
      lastModified: STATIC_PAGE_LAST_MODIFIED,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/shop/car-fm-transmitters`,
      lastModified: STATIC_PAGE_LAST_MODIFIED,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/shop/beauty-grooming-essentials`,
      lastModified: STATIC_PAGE_LAST_MODIFIED,
      changeFrequency: "daily",
      priority: 0.82,
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

    const products = rows as unknown as SitemapProduct[];

    return [
      ...staticPages,
      ...products.map((product) => ({
        url: `${SITE_URL}/products/${encodeURIComponent(product.slug)}`,
        lastModified: product.updatedAt
          ? new Date(product.updatedAt)
          : now,
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
