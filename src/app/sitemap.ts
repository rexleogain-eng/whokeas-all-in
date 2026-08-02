import type { MetadataRoute } from "next";

import { catalogSql } from "../lib/catalog-schema";
import { SITE_URL } from "../lib/seo";

export const revalidate = 3600;

type SitemapProduct = {
  slug: string;
  updatedAt: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/products`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/returns-refunds`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  try {
    const sql = catalogSql();

    const rows = await sql`
      SELECT
        slug,
        updated_at::text AS "updatedAt"
      FROM products
      WHERE status::text = 'active'
        AND COALESCE(TRIM(slug), '') <> ''
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