import type { MetadataRoute } from "next";

import {
  catalogSql,
  ensureCatalogSchema,
} from "../lib/catalog-schema";
import { SITE_URL } from "../lib/seo";

export const revalidate = 3600;

type SitemapProduct = {
  slug: string;
  updatedAt: string | null;
  image: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
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
  ];

  try {
    await ensureCatalogSchema();
    const sql = catalogSql();

    const rows = await sql`
      SELECT
        p.slug,
        p.updated_at::text AS "updatedAt",
        (
          SELECT pi.image_url
          FROM product_images pi
          WHERE pi.product_id = p.id
          ORDER BY pi.sort_order
          LIMIT 1
        ) AS image
      FROM products p
      WHERE p.status::text = 'active'
        AND COALESCE(TRIM(p.slug), '') <> ''
      ORDER BY p.updated_at DESC
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
        ...(product.image ? { images: [product.image] } : {}),
      })),
    ];
  }
  catch (error) {
    console.error("Unable to add catalogue products to sitemap:", error);
    return staticPages;
  }
}