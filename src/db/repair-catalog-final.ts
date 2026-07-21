import { config } from "dotenv";

config({ path: ".env.local" });

const { catalogSql, ensureCatalogSchema } = await import(
  "../lib/catalog-schema"
);

await ensureCatalogSchema();
const sql = catalogSql();

const [health] = await sql`
  SELECT
    current_database() AS database,
    to_regclass('public.products')::text AS products,
    to_regclass('public.product_variants')::text AS product_variants,
    to_regclass('public.product_images')::text AS product_images,
    (SELECT COUNT(*)::int FROM products) AS product_count,
    (SELECT COUNT(*)::int FROM product_variants) AS variant_count,
    (SELECT COUNT(*)::int FROM product_images) AS image_count
`;

console.log("WHOKEAS catalogue schema is ready:", health);
