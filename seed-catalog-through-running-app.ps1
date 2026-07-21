$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json")) {
  throw "Run this inside C:\Users\Hp\Desktop\whokeas-all-in"
}

$server = $null
try {
  $server = Invoke-WebRequest "http://localhost:3000/api/catalog-check" -UseBasicParsing -TimeoutSec 3
} catch {
  throw "The development server is not running. Start npm run dev in the other PowerShell window, then run this patch again."
}

$utf8 = [System.Text.UTF8Encoding]::new($false)
$routeDir = ".\src\app\api\local-catalog-seed"
New-Item -ItemType Directory -Force $routeDir | Out-Null

$route = @'
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (request.headers.get("x-local-seed") !== "WHOKEAS-LOCAL-2026") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is missing");
    }

    const sql = neon(process.env.DATABASE_URL);

    const categoryRows = [
      ["Tech", "tech", "Technology and useful digital accessories."],
      ["Study", "study", "Study tools and productivity essentials."],
      ["Fashion", "fashion", "Style, apparel and WHOKEAS originals."],
      ["Home", "home", "Useful products for modern homes."],
    ] as const;

    for (const [name, slug, description] of categoryRows) {
      await sql`
        INSERT INTO categories (name, slug, description, is_active, created_at)
        VALUES (${name}, ${slug}, ${description}, true, NOW())
        ON CONFLICT (slug)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          is_active = true
      `;
    }

    const productRows = [
      ["tech", "Wireless Earbuds", "wireless-earbuds", "Compact wireless audio for calls, music and travel.", "45000", "28000", true],
      ["tech", "Foldable Laptop Stand", "foldable-laptop-stand", "Portable adjustable support for work and study.", "39000", "24000", true],
      ["study", "Focus Study Lamp", "focus-study-lamp", "A compact desk light for focused evening study.", "32000", "19000", true],
      ["study", "Desk Organizer", "desk-organizer", "Keep study and office essentials arranged.", "29000", "17000", false],
      ["fashion", "WAI Signature Tee", "wai-signature-tee", "Original WHOKEAS ALL IN branded apparel.", "49000", "30000", true],
      ["home", "Smart Storage Set", "smart-storage-set", "Simple modular storage for everyday spaces.", "36000", "22000", false],
    ] as const;

    for (const [categorySlug, name, slug, description, price, cost, featured] of productRows) {
      const [category] = await sql`
        SELECT id FROM categories WHERE slug = ${categorySlug} LIMIT 1
      `;

      if (!category?.id) {
        throw new Error(`Missing category: ${categorySlug}`);
      }

      await sql`
        INSERT INTO products (
          category_id,
          name,
          slug,
          short_description,
          description,
          brand,
          status,
          base_cost,
          price,
          currency,
          is_featured,
          created_at,
          updated_at
        )
        VALUES (
          ${category.id},
          ${name},
          ${slug},
          ${description},
          ${description},
          'WHOKEAS ALL IN',
          'active',
          ${cost},
          ${price},
          'TZS',
          ${featured},
          NOW(),
          NOW()
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

    const variantRows = [
      ["wireless-earbuds", "Black", "WAI-EARBUD-BLK", 25],
      ["wireless-earbuds", "White", "WAI-EARBUD-WHT", 18],
      ["foldable-laptop-stand", "Silver", "WAI-STAND-SLV", 30],
      ["foldable-laptop-stand", "Black", "WAI-STAND-BLK", 22],
      ["wai-signature-tee", "Black / Small", "WAI-TEE-BLK-S", 12],
      ["wai-signature-tee", "Black / Medium", "WAI-TEE-BLK-M", 18],
      ["wai-signature-tee", "Black / Large", "WAI-TEE-BLK-L", 16],
      ["wai-signature-tee", "Black / XL", "WAI-TEE-BLK-XL", 10],
    ] as const;

    for (const [slug, name, sku, stock] of variantRows) {
      const [product] = await sql`
        SELECT id, price, base_cost
        FROM products
        WHERE slug = ${slug}
        LIMIT 1
      `;

      if (!product?.id) {
        throw new Error(`Missing product for variant: ${slug}`);
      }

      await sql`
        INSERT INTO product_variants (
          product_id,
          name,
          sku,
          options,
          cost,
          price,
          stock_quantity,
          is_active,
          created_at
        )
        VALUES (
          ${product.id},
          ${name},
          ${sku},
          '{}'::jsonb,
          ${product.base_cost ?? 0},
          ${product.price},
          ${stock},
          true,
          NOW()
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

    const catalogue = await sql`
      SELECT slug, name, status::text AS status
      FROM products
      ORDER BY name
    `;

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
  (Join-Path (Get-Location) "src\app\api\local-catalog-seed\route.ts"),
  $route,
  $utf8
)

Write-Host "Temporary seed route created. Waiting for Next.js to compile..." -ForegroundColor Cyan

$response = $null
for ($attempt = 1; $attempt -le 20; $attempt++) {
  Start-Sleep -Seconds 1

  try {
    $response = Invoke-RestMethod `
      -Method Post `
      -Uri "http://localhost:3000/api/local-catalog-seed" `
      -Headers @{ "x-local-seed" = "WHOKEAS-LOCAL-2026" } `
      -TimeoutSec 20

    if ($response.ok) {
      break
    }
  } catch {
    if ($attempt -eq 20) {
      throw "The temporary seed route did not become available: $($_.Exception.Message)"
    }
  }
}

if (-not $response.ok) {
  throw "Database seed failed: $($response.error)"
}

Write-Host ""
Write-Host "Catalogue seeded through the exact running app connection." -ForegroundColor Green
$response | ConvertTo-Json -Depth 5

Start-Sleep -Seconds 1

$check = Invoke-RestMethod "http://localhost:3000/api/catalog-check"
Write-Host ""
Write-Host "Catalogue check:" -ForegroundColor Cyan
$check | ConvertTo-Json -Depth 5

if ($check.count -lt 6) {
  throw "Catalogue still has fewer than 6 products."
}

Remove-Item -Recurse -Force $routeDir
Write-Host ""
Write-Host "Temporary seed route removed for safety." -ForegroundColor Green
Write-Host "Now refresh the product pages." -ForegroundColor Yellow
