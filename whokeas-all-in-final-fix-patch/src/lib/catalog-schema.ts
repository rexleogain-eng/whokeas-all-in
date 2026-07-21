import { neon } from "@neondatabase/serverless";

let schemaPromise: Promise<void> | null = null;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error("DATABASE_URL is missing.");
  }

  return value;
}

export function catalogSql() {
  return neon(databaseUrl());
}

async function repairCatalogSchema() {
  const sql = catalogSql();

  await sql`
    DO $$
    BEGIN
      CREATE TYPE product_status AS ENUM ('draft', 'active', 'archived');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END
    $$
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(120) NOT NULL,
      slug varchar(140) NOT NULL UNIQUE,
      description text,
      image_url text,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
      name varchar(180) NOT NULL,
      slug varchar(200) NOT NULL UNIQUE,
      short_description text,
      description text,
      brand varchar(100) DEFAULT 'WHOKEAS ALL IN',
      status product_status NOT NULL DEFAULT 'draft',
      supplier_type varchar(50),
      supplier_product_id varchar(150),
      base_cost numeric(14,2) DEFAULT 0,
      price numeric(14,2) NOT NULL,
      compare_at_price numeric(14,2),
      currency varchar(3) NOT NULL DEFAULT 'TZS',
      is_featured boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS product_variants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name text NOT NULL,
      sku varchar(180) NOT NULL UNIQUE,
      options jsonb DEFAULT '{}'::jsonb,
      supplier_variant_id varchar(200),
      cost numeric(14,2) DEFAULT 0,
      price numeric(14,2) NOT NULL,
      stock_quantity integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS product_images (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      image_url text NOT NULL,
      alt_text varchar(240),
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE products ALTER COLUMN short_description TYPE text`;
  await sql`ALTER TABLE products ALTER COLUMN base_cost TYPE numeric(14,2)`;
  await sql`ALTER TABLE products ALTER COLUMN price TYPE numeric(14,2)`;
  await sql`ALTER TABLE products ALTER COLUMN compare_at_price TYPE numeric(14,2)`;
  await sql`ALTER TABLE product_variants ALTER COLUMN name TYPE text`;
  await sql`ALTER TABLE product_variants ALTER COLUMN sku TYPE varchar(180)`;
  await sql`ALTER TABLE product_variants ALTER COLUMN cost TYPE numeric(14,2)`;
  await sql`ALTER TABLE product_variants ALTER COLUMN price TYPE numeric(14,2)`;
  await sql`ALTER TABLE product_images ALTER COLUMN alt_text TYPE varchar(240)`;

  await sql`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS estimated_shipping_cost numeric(14,2) NOT NULL DEFAULT 0
  `;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_product_url text`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS estimated_delivery_days integer`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS fulfillment_notes text`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_platform varchar(40)`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_external_product_id varchar(220)`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_price_usd numeric(14,4)`;
  await sql`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS supplier_sync_enabled boolean NOT NULL DEFAULT false
  `;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS last_supplier_sync_at timestamptz`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_sync_error text`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_raw_data jsonb`;

  await sql`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS external_variant_id varchar(220)`;
  await sql`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS supplier_price_usd numeric(14,4)`;

  await sql`
    CREATE INDEX IF NOT EXISTS products_supplier_lookup_idx
    ON products (supplier_platform, supplier_external_product_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS products_supplier_sync_idx
    ON products (supplier_platform, supplier_sync_enabled, last_supplier_sync_at)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS product_images_product_idx
    ON product_images (product_id, sort_order)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS product_variants_product_idx
    ON product_variants (product_id, is_active)
  `;

  // Preserve images created by earlier experimental patches, but keep
  // product_images as the single canonical media table from now on.
  await sql`
    DO $$
    BEGIN
      IF to_regclass('public.product_media') IS NOT NULL THEN
        EXECUTE '
          INSERT INTO product_images (
            id, product_id, image_url, alt_text, sort_order, created_at
          )
          SELECT
            id, product_id, source, alt_text, sort_order, created_at
          FROM product_media
          WHERE source IS NOT NULL
          ON CONFLICT (id) DO NOTHING
        ';
      END IF;
    END
    $$
  `;

  // Bring the two original supplier columns forward when the newer columns
  // are still empty. This keeps older seeded products compatible.
  await sql`
    UPDATE products
    SET
      supplier_platform = COALESCE(supplier_platform, supplier_type),
      supplier_external_product_id = COALESCE(
        supplier_external_product_id,
        supplier_product_id
      )
    WHERE supplier_platform IS NULL
       OR supplier_external_product_id IS NULL
  `;
}

export async function ensureCatalogSchema() {
  if (!schemaPromise) {
    schemaPromise = repairCatalogSchema().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  return schemaPromise;
}
