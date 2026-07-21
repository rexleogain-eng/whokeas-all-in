import { config } from "dotenv";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from .env.local");
}

const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS suppliers (
    id uuid PRIMARY KEY,
    name varchar(180) NOT NULL,
    contact_name varchar(180),
    phone varchar(40),
    email varchar(220),
    website text,
    country varchar(100),
    notes text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
  )
`;

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS suppliers_name_lower_unique
  ON suppliers (LOWER(name))
`;

await sql`
  CREATE TABLE IF NOT EXISTS product_media (
    id uuid PRIMARY KEY,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    source text NOT NULL,
    alt_text varchar(240),
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT NOW()
  )
`;

await sql`
  ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL
`;

await sql`
  ALTER TABLE products
  ADD COLUMN IF NOT EXISTS estimated_shipping_cost numeric(14,2) NOT NULL DEFAULT 0
`;

await sql`
  ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_product_url text
`;

await sql`
  ALTER TABLE products
  ADD COLUMN IF NOT EXISTS estimated_delivery_days integer
`;

await sql`
  ALTER TABLE products
  ADD COLUMN IF NOT EXISTS fulfillment_notes text
`;

await sql`
  DO $$
  DECLARE enum_name text;
  BEGIN
    SELECT t.typname INTO enum_name
    FROM pg_type t
    JOIN pg_attribute a ON a.atttypid = t.oid
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'products'
      AND a.attname = 'status'
      AND t.typtype = 'e'
    LIMIT 1;

    IF enum_name IS NOT NULL THEN
      EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', enum_name, 'draft');
      EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', enum_name, 'archived');
    END IF;
  END
  $$;
`;

console.log("Product control database migration completed.");