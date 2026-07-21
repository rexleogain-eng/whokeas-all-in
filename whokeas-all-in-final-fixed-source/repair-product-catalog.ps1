$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json")) {
  throw "Run this script inside C:\Users\Hp\Desktop\whokeas-all-in"
}

$utf8 = [System.Text.UTF8Encoding]::new($false)

New-Item -ItemType Directory -Force ".\src\db" | Out-Null
New-Item -ItemType Directory -Force ".\src\app\api\catalog-check" | Out-Null

$repairCatalog = @'
import { db } from "../lib/db";
import { categories, products, productVariants } from "./schema";

const categoryRows = [
  {
    name: "Tech",
    slug: "tech",
    description: "Technology and useful digital accessories.",
  },
  {
    name: "Study",
    slug: "study",
    description: "Study tools and productivity essentials.",
  },
  {
    name: "Fashion",
    slug: "fashion",
    description: "Style, apparel and WHOKEAS originals.",
  },
  {
    name: "Home",
    slug: "home",
    description: "Useful products for modern homes.",
  },
];

const productRows = [
  {
    categorySlug: "tech",
    name: "Wireless Earbuds",
    slug: "wireless-earbuds",
    shortDescription: "Compact wireless audio for calls, music and travel.",
    description:
      "Wireless earbuds selected for convenient everyday listening, calls and travel.",
    price: "45000",
    baseCost: "28000",
    featured: true,
  },
  {
    categorySlug: "tech",
    name: "Foldable Laptop Stand",
    slug: "foldable-laptop-stand",
    shortDescription: "Portable adjustable support for work and study.",
    description:
      "A foldable adjustable stand designed for portable study and workstation setups.",
    price: "39000",
    baseCost: "24000",
    featured: true,
  },
  {
    categorySlug: "study",
    name: "Focus Study Lamp",
    slug: "focus-study-lamp",
    shortDescription: "A compact desk light for focused evening study.",
    description:
      "A compact desk lamp for study tables, office desks and focused evening work.",
    price: "32000",
    baseCost: "19000",
    featured: true,
  },
  {
    categorySlug: "study",
    name: "Desk Organizer",
    slug: "desk-organizer",
    shortDescription: "Keep study and office essentials arranged.",
    description:
      "A practical organizer for stationery, small accessories and everyday desk essentials.",
    price: "29000",
    baseCost: "17000",
    featured: false,
  },
  {
    categorySlug: "fashion",
    name: "WAI Signature Tee",
    slug: "wai-signature-tee",
    shortDescription: "Original WHOKEAS ALL IN branded apparel.",
    description:
      "The official WHOKEAS ALL IN signature T-shirt representing full commitment and focused progress.",
    price: "49000",
    baseCost: "30000",
    featured: true,
  },
  {
    categorySlug: "home",
    name: "Smart Storage Set",
    slug: "smart-storage-set",
    shortDescription: "Simple modular storage for everyday spaces.",
    description:
      "A modular storage set designed to help organize useful household and personal items.",
    price: "36000",
    baseCost: "22000",
    featured: false,
  },
];

const variantRows: Record<
  string,
  Array<{ name: string; sku: string; stock: number }>
> = {
  "wireless-earbuds": [
    { name: "Black", sku: "WAI-EARBUD-BLK", stock: 25 },
    { name: "White", sku: "WAI-EARBUD-WHT", stock: 18 },
  ],
  "foldable-laptop-stand": [
    { name: "Silver", sku: "WAI-STAND-SLV", stock: 30 },
    { name: "Black", sku: "WAI-STAND-BLK", stock: 22 },
  ],
  "focus-study-lamp": [
    { name: "White", sku: "WAI-LAMP-WHT", stock: 20 },
    { name: "Black", sku: "WAI-LAMP-BLK", stock: 16 },
  ],
  "desk-organizer": [
    { name: "Black", sku: "WAI-ORG-BLK", stock: 20 },
    { name: "Beige", sku: "WAI-ORG-BGE", stock: 14 },
  ],
  "wai-signature-tee": [
    { name: "Black / Small", sku: "WAI-TEE-BLK-S", stock: 12 },
    { name: "Black / Medium", sku: "WAI-TEE-BLK-M", stock: 18 },
    { name: "Black / Large", sku: "WAI-TEE-BLK-L", stock: 16 },
    { name: "Black / XL", sku: "WAI-TEE-BLK-XL", stock: 10 },
  ],
  "smart-storage-set": [
    { name: "3-piece set", sku: "WAI-STORAGE-3PC", stock: 15 },
  ],
};

async function repairCatalog() {
  for (const category of categoryRows) {
    await db
      .insert(categories)
      .values({
        ...category,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: categories.slug,
        set: {
          name: category.name,
          description: category.description,
          isActive: true,
        },
      });
  }

  const savedCategories = await db.select().from(categories);
  const categoryIdBySlug = Object.fromEntries(
    savedCategories.map((category) => [category.slug, category.id]),
  );

  for (const product of productRows) {
    const categoryId = categoryIdBySlug[product.categorySlug];

    if (!categoryId) {
      throw new Error(`Missing category: ${product.categorySlug}`);
    }

    await db
      .insert(products)
      .values({
        categoryId,
        name: product.name,
        slug: product.slug,
        shortDescription: product.shortDescription,
        description: product.description,
        brand: "WHOKEAS ALL IN",
        status: "active",
        baseCost: product.baseCost,
        price: product.price,
        currency: "TZS",
        isFeatured: product.featured,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: products.slug,
        set: {
          categoryId,
          name: product.name,
          shortDescription: product.shortDescription,
          description: product.description,
          brand: "WHOKEAS ALL IN",
          status: "active",
          baseCost: product.baseCost,
          price: product.price,
          currency: "TZS",
          isFeatured: product.featured,
          updatedAt: new Date(),
        },
      });
  }

  const savedProducts = await db.select().from(products);

  for (const product of savedProducts) {
    const variants = variantRows[product.slug] ?? [];

    for (const variant of variants) {
      await db
        .insert(productVariants)
        .values({
          productId: product.id,
          name: variant.name,
          sku: variant.sku,
          cost: product.baseCost ?? "0",
          price: product.price,
          stockQuantity: variant.stock,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: productVariants.sku,
          set: {
            productId: product.id,
            name: variant.name,
            cost: product.baseCost ?? "0",
            price: product.price,
            stockQuantity: variant.stock,
            isActive: true,
          },
        });
    }
  }

  const verified = await db
    .select({
      slug: products.slug,
      name: products.name,
      status: products.status,
      price: products.price,
    })
    .from(products);

  console.table(verified);

  const required = ["wireless-earbuds", "wai-signature-tee"];

  for (const slug of required) {
    const product = verified.find((row) => row.slug === slug);

    if (!product || product.status !== "active") {
      throw new Error(`Product verification failed for ${slug}`);
    }
  }

  console.log(`Catalogue repaired successfully: ${verified.length} products.`);
}

repairCatalog()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
'@

$catalogCheck = @'
import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { products } from "@/db/schema";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const catalogue = await db
      .select({
        slug: products.slug,
        name: products.name,
        status: products.status,
        price: products.price,
      })
      .from(products)
      .orderBy(asc(products.name));

    return NextResponse.json({
      ok: true,
      count: catalogue.length,
      catalogue,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
'@

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\db\repair-catalog.ts"),
  $repairCatalog,
  $utf8
)

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\app\api\catalog-check\route.ts"),
  $catalogCheck,
  $utf8
)

Write-Host "Repairing and verifying Neon catalogue..." -ForegroundColor Cyan
npx tsx .\src\db\repair-catalog.ts

Remove-Item -Recurse -Force ".\.next" -ErrorAction SilentlyContinue

Write-Host "Running production build verification..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "Catalogue repaired and verified successfully." -ForegroundColor Green
Write-Host "Run: npm run dev" -ForegroundColor Yellow
Write-Host "Then open: http://localhost:3000/api/catalog-check" -ForegroundColor Yellow
