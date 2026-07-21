$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json")) {
  throw "Run this inside C:\Users\Hp\Desktop\whokeas-all-in"
}

$utf8 = [System.Text.UTF8Encoding]::new($false)

$routeDir = ".\src\app\api\admin\cj\import"
$dbDir = ".\src\db"

New-Item -ItemType Directory -Force $routeDir | Out-Null
New-Item -ItemType Directory -Force $dbDir | Out-Null

$migration = @'
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

console.log("CJ draft-import schema verified.");
'@

$route = @'
import { neon } from "@neondatabase/serverless";
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
import { saveProduct } from "@/lib/product-admin";

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
  productImageSet?: string[];
  categoryName?: string;
  description?: string;
  sellPrice?: number | string;
  supplierName?: string;
  supplierId?: string;
  status?: string | number;
  productProEnSet?: string[];
  variants?: CJVariant[];
};

type CJFreightOption = {
  logisticAging?: string;
  logisticPrice?: number | string;
  totalPostageFee?: number | string;
  logisticName?: string;
};

function inventoryOf(variant: CJVariant) {
  const rows = Array.isArray(variant.inventories)
    ? variant.inventories
    : [];

  return Math.max(
    0,
    Math.floor(
      rows.reduce(
        (total, row) =>
          total +
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

    const pid = String(body.pid || "").trim();

    if (!pid) {
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
        AND supplier_external_product_id = ${pid}
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
      `/v1/product/query?pid=${encodeURIComponent(pid)}`,
    );

    if (!detail.pid || !detail.productNameEn) {
      throw new Error("CJ returned incomplete product details.");
    }

    const variants = Array.isArray(detail.variants)
      ? detail.variants.filter((variant) => variant.vid).slice(0, 50)
      : [];

    let freightUsd = 0;
    let freightName = "";
    let freightAging = "";
    let freightWarning = "";

    const trialVariant = variants[0];

    if (trialVariant?.vid) {
      const origin =
        trialVariant.inventories?.find((item) => item.countryCode)
          ?.countryCode || "CN";

      try {
        const freight = await cjRequest<CJFreightOption[]>(
          "/v1/logistic/freightCalculate",
          {
            method: "POST",
            body: JSON.stringify({
              startCountryCode: origin,
              endCountryCode: "TZ",
              products: [
                {
                  quantity: 1,
                  vid: trialVariant.vid,
                },
              ],
            }),
          },
        );

        const available = (Array.isArray(freight) ? freight : [])
          .map((option) => ({
            ...option,
            amount: cjNumber(
              option.totalPostageFee ?? option.logisticPrice,
            ),
          }))
          .filter((option) => option.amount > 0)
          .sort((left, right) => left.amount - right.amount);

        if (available[0]) {
          freightUsd = available[0].amount;
          freightName = available[0].logisticName || "";
          freightAging = available[0].logisticAging || "";
        } else {
          freightWarning =
            "No CJ shipping option to Tanzania was returned. Review shipping before publishing.";
        }
      } catch (caught) {
        freightWarning =
          caught instanceof Error
            ? `Freight check failed: ${caught.message}`
            : "Freight check failed. Review shipping before publishing.";
      }
    } else {
      freightWarning =
        "CJ returned no usable variant for freight calculation.";
    }

    const shippingTzs = Math.ceil(freightUsd * usdToTzsRate);

    const normalizedVariants = variants.map((variant, index) => {
      const supplierPriceUsd = cjNumber(
        variant.variantSellPrice ?? detail.sellPrice,
      );

      const supplierCostTzs = Math.ceil(
        supplierPriceUsd * usdToTzsRate,
      );

      const sellingPrice = calculateSellingPrice(
        supplierCostTzs,
        shippingTzs,
        reserveTzs,
        marginPercent,
      );

      const name = (
        variant.variantNameEn ||
        variant.variantKey ||
        `Option ${index + 1}`
      )
        .replace(/\|/g, "/")
        .slice(0, 180);

      const sku = (
        variant.variantSku ||
        `${detail.productSku || "CJ"}-${index + 1}`
      )
        .replace(/\|/g, "-")
        .toUpperCase()
        .slice(0, 120);

      return {
        externalVariantId: String(variant.vid),
        supplierPriceUsd,
        supplierCostTzs,
        sellingPrice,
        name,
        sku,
        stock: inventoryOf(variant),
      };
    });

    const productSupplierPriceUsd =
      normalizedVariants.length > 0
        ? Math.min(
            ...normalizedVariants.map(
              (variant) => variant.supplierPriceUsd,
            ),
          )
        : cjNumber(detail.sellPrice);

    const productCostTzs =
      normalizedVariants.length > 0
        ? Math.min(
            ...normalizedVariants.map(
              (variant) => variant.supplierCostTzs,
            ),
          )
        : Math.ceil(productSupplierPriceUsd * usdToTzsRate);

    const productSellingPrice =
      normalizedVariants.length > 0
        ? Math.min(
            ...normalizedVariants.map(
              (variant) => variant.sellingPrice,
            ),
          )
        : calculateSellingPrice(
            productCostTzs,
            shippingTzs,
            reserveTzs,
            marginPercent,
          );

    const name = detail.productNameEn.slice(0, 180);
    const productSlug = `${slugify(name)}-${detail.pid
      .slice(0, 6)
      .toLowerCase()}`;

    const description = stripHtml(detail.description, 5000);

    const images = [
      ...(Array.isArray(detail.productImageSet)
        ? detail.productImageSet
        : []),
      detail.bigImage || "",
    ]
      .filter(Boolean)
      .filter((value, index, list) => list.indexOf(value) === index)
      .slice(0, 4);

    const variantsText = normalizedVariants
      .map(
        (variant) =>
          `${variant.name}|${variant.sku}|${variant.sellingPrice}|${variant.stock}`,
      )
      .join("\n");

    const fulfillmentNotes = [
      `CJ Product ID: ${detail.pid}`,
      freightName ? `Estimated logistics: ${freightName}` : "",
      freightAging ? `Estimated CJ transit: ${freightAging} days` : "",
      freightWarning,
      `Pricing rule: ${usdToTzsRate} TZS/USD, ${marginPercent}% markup, ${reserveTzs} TZS reserve.`,
    ]
      .filter(Boolean)
      .join("\n");

    const productId = await saveProduct({
      name,
      slug: productSlug,
      categoryName: categoryLeaf(detail.categoryName),
      shortDescription:
        description.slice(0, 420) ||
        `${name} sourced through CJdropshipping.`,
      description,
      status: "draft",
      price: String(roundUp(productSellingPrice)),
      baseCost: String(productCostTzs),
      shippingCost: String(shippingTzs),
      featured: false,
      imageUrls: images.join("\n"),
      supplierName: "CJdropshipping",
      supplierContact: detail.supplierName || "",
      supplierPhone: "",
      supplierEmail: "",
      supplierWebsite: "https://cjdropshipping.com",
      supplierCountry: "China",
      supplierUrl: "",
      deliveryDays: freightAging
        ? String(
            Math.max(
              1,
              Number(freightAging.split("-").at(-1)) || 21,
            ),
          )
        : "",
      supplierNotes: `CJ Supplier ID: ${detail.supplierId || "Not supplied"}`,
      fulfillmentNotes,
      variantsText,
    });

    await sql`
      UPDATE products
      SET
        supplier_platform = 'cj',
        supplier_external_product_id = ${detail.pid},
        supplier_price_usd = ${productSupplierPriceUsd},
        supplier_sync_enabled = true,
        last_supplier_sync_at = NOW(),
        supplier_sync_error = ${freightWarning || null},
        supplier_raw_data = ${JSON.stringify({
          pid: detail.pid,
          productSku: detail.productSku || null,
          supplierId: detail.supplierId || null,
          supplierName: detail.supplierName || null,
          productProperties: detail.productProEnSet || [],
          freight: {
            usd: freightUsd,
            method: freightName || null,
            aging: freightAging || null,
            warning: freightWarning || null,
          },
          importedAt: new Date().toISOString(),
        })}::jsonb,
        updated_at = NOW()
      WHERE id = ${productId}
    `;

    for (const variant of normalizedVariants) {
      await sql`
        UPDATE product_variants
        SET
          external_variant_id = ${variant.externalVariantId},
          supplier_price_usd = ${variant.supplierPriceUsd}
        WHERE product_id = ${productId}
          AND sku = ${variant.sku}
      `;
    }

    return NextResponse.json({
      ok: true,
      product: {
        id: productId,
        slug: productSlug,
        name,
        status: "draft",
        supplierCostTzs: productCostTzs,
        shippingTzs,
        sellingPriceTzs: roundUp(productSellingPrice),
        estimatedProfitTzs:
          roundUp(productSellingPrice) -
          productCostTzs -
          shippingTzs,
        variants: normalizedVariants.length,
        freightMethod: freightName || null,
        freightAging: freightAging || null,
        warning: freightWarning || null,
      },
    });
  } catch (error) {
    console.error("CJ draft import failed:", error);

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
  (Join-Path (Get-Location) "src\db\repair-cj-draft-import.ts"),
  $migration,
  $utf8
)

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\app\api\admin\cj\import\route.ts"),
  $route,
  $utf8
)

Write-Host "Verifying the CJ import database fields..." -ForegroundColor Cyan
npx tsx .\src\db\repair-cj-draft-import.ts

Remove-Item -Recurse -Force ".\.next" -ErrorAction SilentlyContinue

Write-Host "Running production build verification..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "CJ draft import repair completed." -ForegroundColor Green
Write-Host "Run: npm run dev" -ForegroundColor Yellow
Write-Host "Then open: http://localhost:3000/admin/cj" -ForegroundColor Yellow
