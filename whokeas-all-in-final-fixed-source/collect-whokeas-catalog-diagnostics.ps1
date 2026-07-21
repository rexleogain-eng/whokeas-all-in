$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json")) {
  throw "Run this inside C:\Users\Hp\Desktop\whokeas-all-in"
}

$root = (Get-Location).Path
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$work = Join-Path $root ".whokeas-diagnostic-$stamp"
$zip = Join-Path ([Environment]::GetFolderPath("Desktop")) "WHOKEAS-catalog-diagnostic-$stamp.zip"
$utf8 = [System.Text.UTF8Encoding]::new($false)

New-Item -ItemType Directory -Force $work | Out-Null

function Save-Text {
  param([string]$Path, [string]$Text)

  $parent = Split-Path -Parent $Path
  if ($parent) {
    New-Item -ItemType Directory -Force $parent | Out-Null
  }

  [System.IO.File]::WriteAllText($Path, $Text, $utf8)
}

function Copy-DiagnosticFile {
  param([string]$RelativePath)

  $source = Join-Path $root $RelativePath

  if (Test-Path -LiteralPath $source) {
    $destination = Join-Path $work $RelativePath
    $parent = Split-Path -Parent $destination

    if ($parent) {
      New-Item -ItemType Directory -Force $parent | Out-Null
    }

    Copy-Item -LiteralPath $source -Destination $destination -Force
  }
}

$files = @(
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "drizzle.config.ts",
  "vercel.json",
  "src\app\layout.tsx",
  "src\app\globals.css",
  "src\app\page.tsx",
  "src\db\schema.ts",
  "src\lib\db.ts",
  "src\lib\product-admin.ts",
  "src\lib\cj.ts",
  "src\lib\cj-sync.ts",
  "src\lib\admin-auth.ts",
  "src\app\admin\products\page.tsx",
  "src\components\admin\ProductControlClient.tsx",
  "src\app\api\admin\products\route.ts",
  "src\app\api\admin\products\[id]\route.ts",
  "src\app\admin\cj\page.tsx",
  "src\components\admin\CJConnectorClient.tsx",
  "src\app\api\admin\cj\status\route.ts",
  "src\app\api\admin\cj\search\route.ts",
  "src\app\api\admin\cj\import\route.ts",
  "src\app\api\admin\cj\sync\route.ts",
  "src\app\products\page.tsx",
  "src\app\products\[slug]\page.tsx",
  "src\components\store\AddToCart.tsx",
  "src\components\store\CartButton.tsx",
  "src\components\store\CartClient.tsx",
  "src\app\cart\page.tsx",
  "src\app\checkout\page.tsx",
  "src\app\api\orders\route.ts"
)

foreach ($file in $files) {
  Copy-DiagnosticFile $file
}

# Record only environment variable NAMES. Values are never copied.
$envSummary = @()

if (Test-Path ".\.env.local") {
  foreach ($line in Get-Content -LiteralPath ".\.env.local") {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') {
      $envSummary += "$($Matches[1])=[SET]"
    }
  }
}

Save-Text (Join-Path $work "environment-variable-names.txt") (($envSummary | Sort-Object -Unique) -join "`r`n")

$systemInfo = @()
$systemInfo += "Collected: $(Get-Date -Format o)"
$systemInfo += "Project: $root"
$systemInfo += "PowerShell: $($PSVersionTable.PSVersion)"
$systemInfo += "Node: $(& node --version 2>&1)"
$systemInfo += "npm: $(& npm --version 2>&1)"
Save-Text (Join-Path $work "system-info.txt") ($systemInfo -join "`r`n")

try {
  (& git status --short 2>&1) | Out-File -LiteralPath (Join-Path $work "git-status.txt") -Encoding utf8
  (& git log -5 --oneline 2>&1) | Out-File -LiteralPath (Join-Path $work "git-log.txt") -Encoding utf8
  (& git diff --stat 2>&1) | Out-File -LiteralPath (Join-Path $work "git-diff-stat.txt") -Encoding utf8
}
catch {
  Save-Text (Join-Path $work "git-error.txt") $_.Exception.Message
}

$tree = Get-ChildItem -Path ".\src" -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object {
    $_.FullName -match '\\(app|components|db|lib)\\' -and
    $_.Extension -in ".ts", ".tsx", ".js", ".mjs", ".css"
  } |
  ForEach-Object {
    $_.FullName.Substring($root.Length + 1)
  } |
  Sort-Object

Save-Text (Join-Path $work "source-tree.txt") ($tree -join "`r`n")

$diagnosticTs = @'
import { config } from "dotenv";
import { writeFile } from "node:fs/promises";

config({ path: ".env.local" });

const output = process.argv[2];

if (!output) {
  throw new Error("Diagnostic output path was not supplied.");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from .env.local");
}

const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

const result: Record<string, unknown> = {
  generatedAt: new Date().toISOString(),
};

async function safe(name: string, operation: () => Promise<unknown>) {
  try {
    result[name] = await operation();
  } catch (error) {
    result[name] = {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

await safe("connection", async () => {
  return sql`
    SELECT
      current_database() AS database,
      current_schema() AS schema,
      current_user AS database_user,
      version() AS postgres_version
  `;
});

await safe("tables", async () => {
  return sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
});

await safe("catalogueColumns", async () => {
  return sql`
    SELECT
      table_name,
      ordinal_position,
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'categories',
        'products',
        'product_variants',
        'product_images',
        'product_media',
        'suppliers',
        'orders',
        'order_items'
      )
    ORDER BY table_name, ordinal_position
  `;
});

await safe("enumValues", async () => {
  return sql`
    SELECT
      t.typname AS enum_name,
      e.enumlabel AS enum_value,
      e.enumsortorder
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname ILIKE '%product%'
       OR t.typname ILIKE '%order%'
       OR t.typname ILIKE '%payment%'
    ORDER BY t.typname, e.enumsortorder
  `;
});

await safe("constraints", async () => {
  return sql`
    SELECT
      tc.table_name,
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name IN (
        'categories',
        'products',
        'product_variants',
        'product_images',
        'product_media',
        'suppliers'
      )
    ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name
  `;
});

await safe("productCount", async () => {
  return sql`SELECT COUNT(*)::int AS count FROM products`;
});

await safe("variantCount", async () => {
  return sql`SELECT COUNT(*)::int AS count FROM product_variants`;
});

await safe("productMediaCount", async () => {
  return sql`SELECT COUNT(*)::int AS count FROM product_media`;
});

await safe("productImagesCount", async () => {
  return sql`SELECT COUNT(*)::int AS count FROM product_images`;
});

await safe("supplierCount", async () => {
  return sql`SELECT COUNT(*)::int AS count FROM suppliers`;
});

await safe("productSamples", async () => {
  return sql`
    SELECT *
    FROM products
    ORDER BY created_at DESC NULLS LAST
    LIMIT 5
  `;
});

await safe("catalogueQueryCurrentlyUsed", async () => {
  return sql`
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
      s.contact_name AS "supplierContact",
      s.phone AS "supplierPhone",
      s.email AS "supplierEmail",
      s.website AS "supplierWebsite",
      s.country AS "supplierCountry",
      s.notes AS "supplierNotes",
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
    LIMIT 10
  `;
});

await writeFile(output, JSON.stringify(result, null, 2), "utf8");
console.log(`Database diagnostics written to ${output}`);
'@

$tempDiagnostic = Join-Path $root "__whokeas_catalog_diagnostic.ts"
Save-Text $tempDiagnostic $diagnosticTs

try {
  $dbOutput = Join-Path $work "database-diagnostic.json"
  & npx tsx $tempDiagnostic $dbOutput 2>&1 |
    Out-File -LiteralPath (Join-Path $work "database-diagnostic-run.txt") -Encoding utf8
}
catch {
  Save-Text (Join-Path $work "database-diagnostic-error.txt") $_.Exception.ToString()
}
finally {
  Remove-Item -LiteralPath $tempDiagnostic -Force -ErrorAction SilentlyContinue
}

$previousErrorPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"

try {
  & npm run build *>&1 |
    Out-File -LiteralPath (Join-Path $work "npm-build-log.txt") -Encoding utf8
}
finally {
  $ErrorActionPreference = $previousErrorPreference
}

if (Test-Path -LiteralPath $zip) {
  Remove-Item -LiteralPath $zip -Force
}

Compress-Archive -Path (Join-Path $work "*") -DestinationPath $zip -CompressionLevel Optimal

Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "WHOKEAS diagnostic package created successfully." -ForegroundColor Green
Write-Host "Upload this file here:" -ForegroundColor Yellow
Write-Host $zip -ForegroundColor Cyan
Write-Host ""
Write-Host "Secrets were excluded. Only environment variable names were recorded." -ForegroundColor Green
