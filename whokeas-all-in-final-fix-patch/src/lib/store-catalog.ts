import {
  catalogSql,
  ensureCatalogSchema,
} from "@/lib/catalog-schema";

export type StoreProduct = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  price: string;
  compareAtPrice: string | null;
  categoryName: string | null;
  image: string | null;
  featured: boolean;
  deliveryDays: number | null;
  supplierPlatform: string | null;
  createdAt: string;
};

export async function getStoreProducts(options?: {
  query?: string;
  category?: string;
  featured?: boolean;
  limit?: number;
  sort?: string;
}) {
  await ensureCatalogSchema();
  const sql = catalogSql();
  const query = (options?.query || "").trim();
  const category = (options?.category || "").trim();
  const featuredOnly = Boolean(options?.featured);
  const limit = Math.max(1, Math.min(100, options?.limit || 24));
  const sort = options?.sort || "newest";

  const rows = await sql`
    SELECT
      p.id,
      p.name,
      p.slug,
      p.short_description AS "shortDescription",
      p.description,
      p.price::text AS price,
      p.compare_at_price::text AS "compareAtPrice",
      c.name AS "categoryName",
      p.is_featured AS featured,
      p.estimated_delivery_days AS "deliveryDays",
      p.supplier_platform AS "supplierPlatform",
      p.created_at::text AS "createdAt",
      (
        SELECT pi.image_url
        FROM product_images pi
        WHERE pi.product_id = p.id
        ORDER BY pi.sort_order
        LIMIT 1
      ) AS image
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.status::text = 'active'
      AND (
        ${query} = ''
        OR p.name ILIKE ${`%${query}%`}
        OR COALESCE(p.short_description, '') ILIKE ${`%${query}%`}
        OR COALESCE(c.name, '') ILIKE ${`%${query}%`}
      )
      AND (
        ${category} = ''
        OR LOWER(COALESCE(c.name, '')) = LOWER(${category})
      )
      AND (${featuredOnly} = false OR p.is_featured = true)
    ORDER BY
      CASE WHEN ${sort} = 'price-low' THEN p.price END ASC,
      CASE WHEN ${sort} = 'price-high' THEN p.price END DESC,
      CASE WHEN ${sort} = 'newest' THEN p.created_at END DESC,
      p.is_featured DESC,
      p.created_at DESC
    LIMIT ${limit}
  `;

  return rows as unknown as StoreProduct[];
}

export async function getStoreCategories() {
  await ensureCatalogSchema();
  const sql = catalogSql();

  const rows = await sql`
    SELECT
      c.name,
      c.slug,
      COUNT(p.id)::int AS count
    FROM categories c
    JOIN products p ON p.category_id = c.id
    WHERE c.is_active = true
      AND p.status::text = 'active'
    GROUP BY c.id, c.name, c.slug
    ORDER BY COUNT(p.id) DESC, c.name ASC
  `;

  return rows as unknown as Array<{
    name: string;
    slug: string;
    count: number;
  }>;
}

export async function getStoreProductBySlug(slug: string) {
  await ensureCatalogSchema();
  const sql = catalogSql();

  const rows = await sql`
    SELECT
      p.id,
      p.name,
      p.slug,
      p.short_description AS "shortDescription",
      p.description,
      p.price::text AS price,
      p.compare_at_price::text AS "compareAtPrice",
      p.brand,
      p.estimated_delivery_days AS "deliveryDays",
      p.estimated_shipping_cost::text AS "shippingCost",
      p.supplier_platform AS "supplierPlatform",
      c.name AS "categoryName"
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE LOWER(TRIM(p.slug)) = LOWER(TRIM(${slug}))
      AND p.status::text = 'active'
    LIMIT 1
  `;

  const product = rows[0];
  if (!product) return null;

  const images = await sql`
    SELECT image_url AS source
    FROM product_images
    WHERE product_id = ${product.id}
    ORDER BY sort_order
    LIMIT 8
  `;

  const variants = await sql`
    SELECT
      id,
      name,
      price::text AS price,
      stock_quantity AS "stockQuantity"
    FROM product_variants
    WHERE product_id = ${product.id}
      AND is_active = true
    ORDER BY name
  `;

  return {
    product,
    images,
    variants,
  };
}
