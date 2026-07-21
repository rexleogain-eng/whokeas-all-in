import { config } from "dotenv";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from .env.local");
}

const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

const categories = [
  ["Tech", "tech"],
  ["Study", "study"],
  ["Fashion", "fashion"],
  ["Home", "home"],
] as const;

for (const [name, slug] of categories) {
  await sql`
    INSERT INTO categories (name, slug, is_active, created_at)
    VALUES (${name}, ${slug}, true, NOW())
    ON CONFLICT (slug)
    DO UPDATE SET name = EXCLUDED.name, is_active = true
  `;
}

const products = [
  ["tech", "Wireless Earbuds", "wireless-earbuds", "Compact wireless audio for calls, music and travel.", "45000", "28000", true],
  ["tech", "Foldable Laptop Stand", "foldable-laptop-stand", "Portable adjustable support for work and study.", "39000", "24000", true],
  ["study", "Focus Study Lamp", "focus-study-lamp", "A compact desk light for focused evening study.", "32000", "19000", true],
  ["study", "Desk Organizer", "desk-organizer", "Keep study and office essentials arranged.", "29000", "17000", false],
  ["fashion", "WAI Signature Tee", "wai-signature-tee", "Original WHOKEAS ALL IN branded apparel.", "49000", "30000", true],
  ["home", "Smart Storage Set", "smart-storage-set", "Simple modular storage for everyday spaces.", "36000", "22000", false],
] as const;

for (const [categorySlug, name, slug, description, price, cost, featured] of products) {
  const [category] = await sql`
    SELECT id FROM categories WHERE slug = ${categorySlug} LIMIT 1
  `;

  if (!category?.id) {
    throw new Error(`Missing category ${categorySlug}`);
  }

  await sql`
    INSERT INTO products (
      category_id, name, slug, short_description, description, brand,
      status, base_cost, price, currency, is_featured, created_at, updated_at
    )
    VALUES (
      ${category.id}, ${name}, ${slug}, ${description}, ${description},
      'WHOKEAS ALL IN', 'active', ${cost}, ${price}, 'TZS',
      ${featured}, NOW(), NOW()
    )
    ON CONFLICT (slug)
    DO UPDATE SET
      category_id = EXCLUDED.category_id,
      name = EXCLUDED.name,
      short_description = EXCLUDED.short_description,
      description = EXCLUDED.description,
      brand = 'WHOKEAS ALL IN',
      status = 'active',
      base_cost = EXCLUDED.base_cost,
      price = EXCLUDED.price,
      currency = 'TZS',
      is_featured = EXCLUDED.is_featured,
      updated_at = NOW()
  `;
}

const variants = [
  ["wireless-earbuds", "Black", "WAI-EARBUD-BLK", 25],
  ["wireless-earbuds", "White", "WAI-EARBUD-WHT", 18],
  ["foldable-laptop-stand", "Silver", "WAI-STAND-SLV", 30],
  ["foldable-laptop-stand", "Black", "WAI-STAND-BLK", 22],
  ["wai-signature-tee", "Black / Small", "WAI-TEE-BLK-S", 12],
  ["wai-signature-tee", "Black / Medium", "WAI-TEE-BLK-M", 18],
] as const;

for (const [slug, name, sku, stock] of variants) {
  const [product] = await sql`
    SELECT id, price, base_cost FROM products WHERE slug = ${slug} LIMIT 1
  `;

  await sql`
    INSERT INTO product_variants (
      product_id, name, sku, options, cost, price,
      stock_quantity, is_active, created_at
    )
    VALUES (
      ${product.id}, ${name}, ${sku}, '{}'::jsonb,
      ${product.base_cost ?? 0}, ${product.price},
      ${stock}, true, NOW()
    )
    ON CONFLICT (sku)
    DO UPDATE SET
      product_id = EXCLUDED.product_id,
      name = EXCLUDED.name,
      price = EXCLUDED.price,
      stock_quantity = EXCLUDED.stock_quantity,
      is_active = true
  `;
}

const result = await sql`
  SELECT slug, name, status::text AS status
  FROM products
  ORDER BY name
`;

console.table(result);

if (!result.some((row) => row.slug === "wireless-earbuds" && row.status === "active")) {
  throw new Error("wireless-earbuds verification failed");
}

console.log("Catalogue force-seeded successfully.");