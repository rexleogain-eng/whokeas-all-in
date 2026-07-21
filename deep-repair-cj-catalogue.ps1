$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json")) {
  throw "Run this inside C:\Users\Hp\Desktop\whokeas-all-in"
}

$utf8 = [System.Text.UTF8Encoding]::new($false)

New-Item -ItemType Directory -Force ".\src\db" | Out-Null
New-Item -ItemType Directory -Force ".\src\app\api\admin\cj\import" | Out-Null

$migration = @'
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
  CREATE INDEX IF NOT EXISTS product_media_product_idx
  ON product_media(product_id, sort_order)
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
  DO $$
  DECLARE
    enum_name text;
  BEGIN
    SELECT t.typname
    INTO enum_name
    FROM pg_type t
    JOIN pg_attribute a ON a.atttypid = t.oid
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'products'
      AND a.attname = 'status'
      AND t.typtype = 'e'
    LIMIT 1;

    IF enum_name IS NOT NULL THEN
      EXECUTE format(
        'ALTER TYPE %I ADD VALUE IF NOT EXISTS %L',
        enum_name,
        'draft'
      );

      EXECUTE format(
        'ALTER TYPE %I ADD VALUE IF NOT EXISTS %L',
        enum_name,
        'archived'
      );
    END IF;
  END
  $$;
`;

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS products_supplier_external_unique
  ON products (supplier_platform, supplier_external_product_id)
  WHERE supplier_platform IS NOT NULL
    AND supplier_external_product_id IS NOT NULL
`;

const schema = await sql`
  SELECT
    to_regclass('public.products')::text AS products,
    to_regclass('public.product_variants')::text AS variants,
    to_regclass('public.product_media')::text AS media,
    to_regclass('public.suppliers')::text AS suppliers
`;

const catalogue = await sql`
  SELECT
    p.id,
    p.name,
    p.slug,
    p.short_description AS "shortDescription",
    p.description,
    p.status::text AS status,
    p.price::text AS price,
    p.base_cost::text AS "baseCost",
    p.estimated_shipping_cost::text AS "shippingCost",
    p.is_featured AS featured,
    p.supplier_product_url AS "supplierUrl",
    p.estimated_delivery_days AS "deliveryDays",
    p.fulfillment_notes AS "fulfillmentNotes",
    c.name AS "categoryName",
    s.name AS "supplierName",
    COALESCE(
      (
        SELECT string_agg(pm.source, E'\n' ORDER BY pm.sort_order)
        FROM product_media pm
        WHERE pm.product_id = p.id
      ),
      ''
    ) AS "imageUrls",
    COALESCE(
      (
        SELECT string_agg(
          CONCAT(v.name, '|', v.sku, '|', v.price::text, '|', v.stock_quantity),
          E'\n'
          ORDER BY v.name
        )
        FROM product_variants v
        WHERE v.product_id = p.id
          AND v.is_active = true
      ),
      ''
    ) AS "variantsText"
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN suppliers s ON s.id = p.supplier_id
  ORDER BY p.created_at DESC
  LIMIT 5
`;

console.log("Schema:", schema[0]);
console.log("Catalogue query passed. Products found:", catalogue.length);

for (const product of catalogue) {
  console.log("-", product.name, `[${product.status}]`);
}
'@

$importRoute = @'
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import {
  calculateSellingPrice,
  cjNumber,
  cjRequest,
  pricingDefaults,
  roundUp,
  slugify,
  stripHtml,
} from "@/lib/cj";

export const dynamic = "force-dynamic";

type CJInventory = {
  countryCode?: string;
  totalInventory?: number;
  cjInventory?: number;
  factoryInventory?: number;
};

type CJVariant = {
  vid?: string;
  variantNameEn?: string;
  variantKey?: string;
  variantSku?: string;
  variantSellPrice?: number | string;
  inventories?: CJInventory[];
};

type CJProductDetail = {
  pid?: string;
  productNameEn?: string;
  productSku?: string;
  bigImage?: string;
  productImage?: string;
  productImageSet?: string[] | string;
  categoryName?: string;
  description?: string;
  sellPrice?: number | string;
  supplierName?: string;
  supplierId?: string;
  status?: string | number;
  variants?: CJVariant[];
};

function getInventory(variant: CJVariant) {
  const rows = Array.isArray(variant.inventories)
    ? variant.inventories
    : [];

  return Math.max(
    0,
    Math.floor(
      rows.reduce(
        (sum, row) =>
          sum +
          cjNumber(
            row.totalInventory ??
              row.cjInventory ??
              row.factoryInventory,
          ),
        0,
      ),
    ),
  );
}

function categoryLeaf(value: string | undefined) {
  const parts = (value || "General")
    .split(/[/>]/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.at(-1) || "General";
}

function getImages(detail: CJProductDetail) {
  const imageSet = Array.isArray(detail.productImageSet)
    ? detail.productImageSet
    : typeof detail.productImageSet === "string"
      ? detail.productImageSet
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

  return [
    ...imageSet,
    detail.bigImage || "",
    detail.productImage || "",
  ]
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 4);
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is missing.");
    }

    const body = (await request.json()) as {
      pid?: string;
      usdToTzsRate?: number;
      marginPercent?: number;
      reserveTzs?: number;
    };

    const requestedPid = String(body.pid || "").trim();

    if (!requestedPid) {
      return NextResponse.json(
        { ok: false, error: "CJ product ID is missing." },
        { status: 400 },
      );
    }

    const sql = neon(process.env.DATABASE_URL);

    const duplicate = await sql`
      SELECT id, slug
      FROM products
      WHERE supplier_platform = 'cj'
        AND supplier_external_product_id = ${requestedPid}
      LIMIT 1
    `;

    if (duplicate.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "This CJ product is already imported.",
          existingProductId: duplicate[0].id,
          existingSlug: duplicate[0].slug,
        },
        { status: 409 },
      );
    }

    const defaults = pricingDefaults();

    const usdToTzsRate = Math.max(
      1,
      cjNumber(body.usdToTzsRate) || defaults.usdToTzsRate,
    );

    const marginPercent = Math.max(
      0,
      cjNumber(body.marginPercent) || defaults.marginPercent,
    );

    const reserveTzs = Math.max(
      0,
      cjNumber(body.reserveTzs) || defaults.reserveTzs,
    );

    const detail = await cjRequest<CJProductDetail>(
      `/v1/product/query?pid=${encodeURIComponent(requestedPid)}`,
    );

    const pid = String(detail.pid || requestedPid).trim();
    const name = String(detail.productNameEn || "")
      .trim()
      .slice(0, 180);

    if (!pid || !name) {
      throw new Error("CJ returned incomplete product details.");
    }

    const sourceVariants = Array.isArray(detail.variants)
      ? detail.variants.filter((variant) => variant.vid).slice(0, 50)
      : [];

    const variants = sourceVariants.map((variant, index) => {
      const supplierPriceUsd = cjNumber(
        variant.variantSellPrice ?? detail.sellPrice,
      );

      const supplierCostTzs = Math.ceil(
        supplierPriceUsd * usdToTzsRate,
      );

      const sellingPrice = calculateSellingPrice(
        supplierCostTzs,
        0,
        reserveTzs,
        marginPercent,
      );

      const externalId = String(variant.vid || "");
      const baseSku = String(
        variant.variantSku ||
          `${detail.productSku || "CJ"}-${index + 1}`,
      )
        .replace(/[^A-Za-z0-9_-]+/g, "-")
        .toUpperCase()
        .slice(0, 100);

      return {
        externalId,
        name: String(
          variant.variantNameEn ||
            variant.variantKey ||
            `Option ${index + 1}`,
        )
          .replace(/\|/g, "/")
          .slice(0, 180),
        sku: `${baseSku}-${externalId.slice(-6)}`.slice(0, 120),
        supplierPriceUsd,
        supplierCostTzs,
        sellingPrice,
        stock: getInventory(variant),
      };
    });

    if (variants.length === 0) {
      const supplierPriceUsd = cjNumber(detail.sellPrice);
      const supplierCostTzs = Math.ceil(
        supplierPriceUsd * usdToTzsRate,
      );

      variants.push({
        externalId: "",
        name: "Standard",
        sku: `CJ-${pid.slice(0, 12)}`.toUpperCase(),
        supplierPriceUsd,
        supplierCostTzs,
        sellingPrice: calculateSellingPrice(
          supplierCostTzs,
          0,
          reserveTzs,
          marginPercent,
        ),
        stock: 0,
      });
    }

    const supplierPriceUsd = Math.min(
      ...variants.map((variant) => variant.supplierPriceUsd),
    );

    const baseCostTzs = Math.min(
      ...variants.map((variant) => variant.supplierCostTzs),
    );

    const sellingPriceTzs = roundUp(
      Math.min(...variants.map((variant) => variant.sellingPrice)),
    );

    const categoryName = categoryLeaf(detail.categoryName);
    const categorySlug = slugify(categoryName) || "general";
    const temporaryCategoryId = randomUUID();

    await sql`
      INSERT INTO categories (
        id,
        name,
        slug,
        is_active,
        created_at
      )
      VALUES (
        ${temporaryCategoryId},
        ${categoryName},
        ${categorySlug},
        true,
        NOW()
      )
      ON CONFLICT (slug)
      DO UPDATE SET
        name = EXCLUDED.name,
        is_active = true
    `;

    const categories = await sql`
      SELECT id
      FROM categories
      WHERE slug = ${categorySlug}
      LIMIT 1
    `;

    if (!categories[0]?.id) {
      throw new Error("Could not create the product category.");
    }

    const suppliers = await sql`
      SELECT id
      FROM suppliers
      WHERE LOWER(name) = LOWER('CJdropshipping')
      LIMIT 1
    `;

    const supplierId = suppliers[0]?.id
      ? String(suppliers[0].id)
      : randomUUID();

    if (suppliers.length > 0) {
      await sql`
        UPDATE suppliers
        SET
          website = 'https://cjdropshipping.com',
          country = 'China',
          notes = ${`CJ Product ID: ${pid}`},
          is_active = true,
          updated_at = NOW()
        WHERE id = ${supplierId}
      `;
    } else {
      await sql`
        INSERT INTO suppliers (
          id,
          name,
          website,
          country,
          notes,
          is_active,
          created_at,
          updated_at
        )
        VALUES (
          ${supplierId},
          'CJdropshipping',
          'https://cjdropshipping.com',
          'China',
          ${`CJ Product ID: ${pid}`},
          true,
          NOW(),
          NOW()
        )
      `;
    }

    const productId = randomUUID();
    const productSlug = `${slugify(name)}-${pid
      .slice(0, 6)
      .toLowerCase()}`;

    const description = stripHtml(detail.description, 5000);
    const shortDescription =
      description.slice(0, 420) ||
      `${name} sourced through CJdropshipping.`;

    const images = getImages(detail);
    const shippingWarning =
      "Imported successfully. Tanzania shipping must be verified before this draft is activated.";

    const statements = [
      sql`
        INSERT INTO products (
          id,
          category_id,
          supplier_id,
          name,
          slug,
          short_description,
          description,
          brand,
          status,
          base_cost,
          price,
          estimated_shipping_cost,
          currency,
          is_featured,
          supplier_product_url,
          estimated_delivery_days,
          fulfillment_notes,
          supplier_platform,
          supplier_external_product_id,
          supplier_price_usd,
          supplier_sync_enabled,
          last_supplier_sync_at,
          supplier_sync_error,
          supplier_raw_data,
          created_at,
          updated_at
        )
        VALUES (
          ${productId},
          ${categories[0].id},
          ${supplierId},
          ${name},
          ${productSlug},
          ${shortDescription},
          ${description || null},
          'WHOKEAS ALL IN',
          'draft',
          ${baseCostTzs},
          ${sellingPriceTzs},
          0,
          'TZS',
          false,
          NULL,
          NULL,
          ${shippingWarning},
          'cj',
          ${pid},
          ${supplierPriceUsd},
          true,
          NOW(),
          ${shippingWarning},
          ${JSON.stringify({
            pid,
            productSku: detail.productSku || null,
            supplierId: detail.supplierId || null,
            supplierName: detail.supplierName || null,
            importedAt: new Date().toISOString(),
          })}::jsonb,
          NOW(),
          NOW()
        )
      `,
      ...images.map(
        (source, index) => sql`
          INSERT INTO product_media (
            id,
            product_id,
            source,
            alt_text,
            sort_order,
            created_at
          )
          VALUES (
            ${randomUUID()},
            ${productId},
            ${source},
            ${name},
            ${index},
            NOW()
          )
        `,
      ),
      ...variants.map(
        (variant) => sql`
          INSERT INTO product_variants (
            id,
            product_id,
            name,
            sku,
            options,
            cost,
            price,
            stock_quantity,
            is_active,
            external_variant_id,
            supplier_price_usd,
            created_at
          )
          VALUES (
            ${randomUUID()},
            ${productId},
            ${variant.name},
            ${variant.sku},
            '{}'::jsonb,
            ${variant.supplierCostTzs},
            ${variant.sellingPrice},
            ${variant.stock},
            true,
            ${variant.externalId || null},
            ${variant.supplierPriceUsd},
            NOW()
          )
        `,
      ),
    ];

    await sql.transaction(statements);

    const verification = await sql`
      SELECT id, name, slug, status::text AS status
      FROM products
      WHERE id = ${productId}
      LIMIT 1
    `;

    if (verification.length === 0) {
      throw new Error("The database did not retain the imported product.");
    }

    return NextResponse.json({
      ok: true,
      product: {
        id: productId,
        slug: productSlug,
        name,
        status: "draft",
        supplierCostTzs: baseCostTzs,
        shippingTzs: 0,
        sellingPriceTzs,
        estimatedProfitTzs: sellingPriceTzs - baseCostTzs,
        variants: variants.length,
        freightMethod: null,
        freightAging: null,
        warning: shippingWarning,
      },
    });
  } catch (error) {
    console.error("CJ import failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "CJ draft import failed.",
      },
      { status: 500 },
    );
  }
}
'@

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\db\deep-repair-catalogue.ts"),
  $migration,
  $utf8
)

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\app\api\admin\cj\import\route.ts"),
  $importRoute,
  $utf8
)

Write-Host "Repairing and validating the complete catalogue schema..." -ForegroundColor Cyan
npx tsx .\src\db\deep-repair-catalogue.ts

Remove-Item -Recurse -Force ".\.next" -ErrorAction SilentlyContinue

Write-Host "Running production build verification..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "Deep catalogue and CJ import repair completed." -ForegroundColor Green
Write-Host "Run: npm run dev" -ForegroundColor Yellow
Write-Host "Test: http://localhost:3000/api/admin/products" -ForegroundColor Yellow
Write-Host "Then import one product at: http://localhost:3000/admin/cj" -ForegroundColor Yellow
