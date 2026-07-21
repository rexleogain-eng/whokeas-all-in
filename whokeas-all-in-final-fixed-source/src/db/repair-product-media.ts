import { config } from "dotenv";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from .env.local");
}

const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

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
  CREATE INDEX IF NOT EXISTS product_media_product_idx
  ON product_media(product_id, sort_order)
`;

await sql`
  DO $$
  DECLARE
    source_col text;
    alt_col text;
    sort_col text;
    has_id boolean;
    has_created_at boolean;
    id_expression text;
    alt_expression text;
    sort_expression text;
    created_expression text;
    statement text;
  BEGIN
    IF to_regclass('public.product_images') IS NULL THEN
      RETURN;
    END IF;

    SELECT column_name
    INTO source_col
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_images'
      AND column_name IN ('source', 'image_url', 'url')
    ORDER BY CASE column_name
      WHEN 'source' THEN 1
      WHEN 'image_url' THEN 2
      WHEN 'url' THEN 3
      ELSE 4
    END
    LIMIT 1;

    IF source_col IS NULL THEN
      RETURN;
    END IF;

    SELECT column_name
    INTO alt_col
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_images'
      AND column_name IN ('alt_text', 'alt')
    ORDER BY CASE column_name
      WHEN 'alt_text' THEN 1
      WHEN 'alt' THEN 2
      ELSE 3
    END
    LIMIT 1;

    SELECT column_name
    INTO sort_col
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_images'
      AND column_name IN ('sort_order', 'position', 'display_order')
    ORDER BY CASE column_name
      WHEN 'sort_order' THEN 1
      WHEN 'position' THEN 2
      WHEN 'display_order' THEN 3
      ELSE 4
    END
    LIMIT 1;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'product_images'
        AND column_name = 'id'
    ) INTO has_id;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'product_images'
        AND column_name = 'created_at'
    ) INTO has_created_at;

    id_expression := CASE
      WHEN has_id THEN 'pi.id'
      ELSE 'gen_random_uuid()'
    END;

    alt_expression := CASE
      WHEN alt_col IS NULL THEN 'NULL::varchar(240)'
      ELSE format('LEFT(pi.%I::text, 240)', alt_col)
    END;

    sort_expression := CASE
      WHEN sort_col IS NULL THEN '0'
      ELSE format('COALESCE(pi.%I::integer, 0)', sort_col)
    END;

    created_expression := CASE
      WHEN has_created_at THEN 'COALESCE(pi.created_at, NOW())'
      ELSE 'NOW()'
    END;

    statement := format(
      'INSERT INTO product_media
        (id, product_id, source, alt_text, sort_order, created_at)
       SELECT
        %s,
        pi.product_id,
        pi.%I::text,
        %s,
        %s,
        %s
       FROM product_images pi
       WHERE pi.%I IS NOT NULL
       ON CONFLICT (id) DO NOTHING',
      id_expression,
      source_col,
      alt_expression,
      sort_expression,
      created_expression,
      source_col
    );

    EXECUTE statement;
  END
  $$;
`;

const result = await sql`
  SELECT
    to_regclass('public.product_media')::text AS relation,
    COUNT(*)::int AS media_rows
  FROM product_media
`;

console.log("Product media repair complete:", result[0]);