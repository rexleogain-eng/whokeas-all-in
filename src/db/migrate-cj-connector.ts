import { config } from "dotenv";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from .env.local");
}

const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

await sql`
  ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_platform varchar(40)
`;

await sql`
  ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_external_product_id varchar(220)
`;

await sql`
  ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_price_usd numeric(14,4)
`;

await sql`
  ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_sync_enabled boolean NOT NULL DEFAULT false
`;

await sql`
  ALTER TABLE products
  ADD COLUMN IF NOT EXISTS last_supplier_sync_at timestamptz
`;

await sql`
  ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_sync_error text
`;

await sql`
  ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_raw_data jsonb
`;

await sql`
  ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS external_variant_id varchar(220)
`;

await sql`
  ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS supplier_price_usd numeric(14,4)
`;

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS products_supplier_external_unique
  ON products (supplier_platform, supplier_external_product_id)
  WHERE supplier_platform IS NOT NULL
    AND supplier_external_product_id IS NOT NULL
`;

await sql`
  CREATE INDEX IF NOT EXISTS products_supplier_sync_idx
  ON products (supplier_platform, supplier_sync_enabled, last_supplier_sync_at)
`;

console.log("CJ connector migration complete.");