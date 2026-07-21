$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json")) {
  throw "Run this inside C:\Users\Hp\Desktop\whokeas-all-in"
}

$utf8 = [System.Text.UTF8Encoding]::new($false)

$directories = @(
  ".\src\lib",
  ".\src\db",
  ".\src\components\admin",
  ".\src\app\admin\cj",
  ".\src\app\api\admin\cj\status",
  ".\src\app\api\admin\cj\search",
  ".\src\app\api\admin\cj\import",
  ".\src\app\api\admin\cj\sync",
  ".\src\app\api\cron\cj-sync"
)

foreach ($directory in $directories) {
  New-Item -ItemType Directory -Force $directory | Out-Null
}

$envPath = Join-Path (Get-Location) ".env.local"

if (-not (Test-Path $envPath)) {
  New-Item -ItemType File -Path $envPath | Out-Null
}

function Add-EnvValueIfMissing {
  param(
    [string]$Name,
    [string]$Value
  )

  $current = [System.IO.File]::ReadAllText($envPath)

  if ($current -notmatch "(?m)^$([Regex]::Escape($Name))=") {
    [System.IO.File]::AppendAllText(
      $envPath,
      "`r`n$Name=`"$Value`"`r`n",
      $utf8
    )
  }
}

Add-EnvValueIfMissing -Name "CJ_USD_TO_TZS_RATE" -Value "2700"
Add-EnvValueIfMissing -Name "CJ_DEFAULT_MARGIN_PERCENT" -Value "35"
Add-EnvValueIfMissing -Name "CJ_RISK_RESERVE_TZS" -Value "3000"

$currentEnv = [System.IO.File]::ReadAllText($envPath)

if ($currentEnv -notmatch '(?m)^CRON_SECRET=') {
  $bytes = New-Object byte[] 48
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()

  try {
    $rng.GetBytes($bytes)
  }
  finally {
    $rng.Dispose()
  }

  $cronSecret = [Convert]::ToBase64String($bytes)

  [System.IO.File]::AppendAllText(
    $envPath,
    "`r`nCRON_SECRET=`"$cronSecret`"`r`n",
    $utf8
  )
}

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

await sql`
  CREATE INDEX IF NOT EXISTS products_supplier_sync_idx
  ON products (supplier_platform, supplier_sync_enabled, last_supplier_sync_at)
`;

console.log("CJ connector migration complete.");
'@

$cjLib = @'
const CJ_BASE = "https://developers.cjdropshipping.com/api2.0";

type CJEnvelope<T> = {
  code?: number;
  result?: boolean;
  success?: boolean;
  message?: string;
  data?: T;
  requestId?: string;
};

type TokenData = {
  accessToken: string;
  accessTokenExpiryDate?: string;
};

let tokenCache:
  | {
      token: string;
      expiresAt: number;
    }
  | undefined;

function getApiKey() {
  const apiKey = process.env.CJ_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("CJ_API_KEY is missing.");
  }

  return apiKey;
}

async function requestToken() {
  const response = await fetch(
    `${CJ_BASE}/v1/authentication/getAccessToken`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: getApiKey() }),
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as CJEnvelope<TokenData>;

  if (
    !response.ok ||
    payload.result === false ||
    payload.success === false ||
    !payload.data?.accessToken
  ) {
    throw new Error(
      payload.message ||
        `CJ authentication failed with HTTP ${response.status}.`,
    );
  }

  const parsedExpiry = payload.data.accessTokenExpiryDate
    ? new Date(payload.data.accessTokenExpiryDate).getTime()
    : Date.now() + 6 * 60 * 60 * 1000;

  tokenCache = {
    token: payload.data.accessToken,
    expiresAt: Number.isFinite(parsedExpiry)
      ? parsedExpiry
      : Date.now() + 6 * 60 * 60 * 1000,
  };

  return tokenCache.token;
}

export async function getCJAccessToken(forceRefresh = false) {
  if (
    !forceRefresh &&
    tokenCache &&
    tokenCache.expiresAt > Date.now() + 5 * 60 * 1000
  ) {
    return tokenCache.token;
  }

  return requestToken();
}

async function makeRequest<T>(
  path: string,
  init: RequestInit,
  forceRefresh = false,
) {
  const token = await getCJAccessToken(forceRefresh);

  const response = await fetch(`${CJ_BASE}${path}`, {
    ...init,
    headers: {
      "CJ-Access-Token": token,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as CJEnvelope<T>;

  return { response, payload };
}

export async function cjRequest<T>(
  path: string,
  init: RequestInit = { method: "GET" },
): Promise<T> {
  let result = await makeRequest<T>(path, init);

  const authenticationFailed =
    result.response.status === 401 ||
    result.payload.code === 1600001 ||
    result.payload.message?.toLowerCase().includes("authentication");

  if (authenticationFailed) {
    tokenCache = undefined;
    result = await makeRequest<T>(path, init, true);
  }

  if (
    !result.response.ok ||
    result.payload.result === false ||
    result.payload.success === false ||
    result.payload.data === undefined
  ) {
    throw new Error(
      result.payload.message ||
        `CJ request failed with HTTP ${result.response.status}.`,
    );
  }

  return result.payload.data;
}

export function cjNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundUp(value: number, increment = 500) {
  return Math.ceil(value / increment) * increment;
}

export function pricingDefaults() {
  return {
    usdToTzsRate: Math.max(
      1,
      Number(process.env.CJ_USD_TO_TZS_RATE || 2700),
    ),
    marginPercent: Math.max(
      0,
      Number(process.env.CJ_DEFAULT_MARGIN_PERCENT || 35),
    ),
    reserveTzs: Math.max(
      0,
      Number(process.env.CJ_RISK_RESERVE_TZS || 3000),
    ),
  };
}

export function calculateSellingPrice(
  supplierCostTzs: number,
  shippingTzs: number,
  reserveTzs: number,
  marginPercent: number,
) {
  const landed = supplierCostTzs + shippingTzs + reserveTzs;
  return roundUp(landed * (1 + marginPercent / 100));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 130);
}

export function stripHtml(value: unknown, maximum = 5000) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}
'@

$cjSyncLib = @'
import { neon } from "@neondatabase/serverless";

import {
  calculateSellingPrice,
  cjNumber,
  cjRequest,
  pricingDefaults,
} from "@/lib/cj";

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
  status?: string | number;
  sellPrice?: number | string;
  variants?: CJVariant[];
};

function variantInventory(variant: CJVariant) {
  const inventories = Array.isArray(variant.inventories)
    ? variant.inventories
    : [];

  return Math.max(
    0,
    Math.floor(
      inventories.reduce(
        (total, inventory) =>
          total +
          cjNumber(
            inventory.totalInventory ??
              inventory.cjInventory ??
              inventory.factoryInventory,
          ),
        0,
      ),
    ),
  );
}

export async function syncCJProducts(limit = 10) {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing.");
  }

  const sql = neon(process.env.DATABASE_URL);
  const defaults = pricingDefaults();

  const products = await sql`
    SELECT
      id,
      supplier_external_product_id AS "externalProductId",
      estimated_shipping_cost::text AS "shippingTzs"
    FROM products
    WHERE supplier_platform = 'cj'
      AND supplier_sync_enabled = true
    ORDER BY last_supplier_sync_at NULLS FIRST, updated_at ASC
    LIMIT ${Math.max(1, Math.min(25, limit))}
  `;

  const report: Array<Record<string, unknown>> = [];

  for (const product of products) {
    const productId = String(product.id);
    const externalProductId = String(product.externalProductId);
    const shippingTzs = cjNumber(product.shippingTzs);

    try {
      const detail = await cjRequest<CJProductDetail>(
        `/v1/product/query?pid=${encodeURIComponent(externalProductId)}`,
      );

      const variants = Array.isArray(detail.variants) ? detail.variants : [];
      const activeSupplierStatus = String(detail.status ?? "3") === "3";

      let minimumCostTzs = Number.POSITIVE_INFINITY;
      let minimumSellingPrice = Number.POSITIVE_INFINITY;
      let totalStock = 0;

      for (const variant of variants.slice(0, 100)) {
        if (!variant.vid) continue;

        const supplierPriceUsd = cjNumber(
          variant.variantSellPrice ?? detail.sellPrice,
        );
        const supplierCostTzs = Math.ceil(
          supplierPriceUsd * defaults.usdToTzsRate,
        );
        const sellingPrice = calculateSellingPrice(
          supplierCostTzs,
          shippingTzs,
          defaults.reserveTzs,
          defaults.marginPercent,
        );
        const stock = variantInventory(variant);

        minimumCostTzs = Math.min(minimumCostTzs, supplierCostTzs);
        minimumSellingPrice = Math.min(minimumSellingPrice, sellingPrice);
        totalStock += stock;

        await sql`
          UPDATE product_variants
          SET
            name = COALESCE(
              ${variant.variantNameEn || variant.variantKey || null},
              name
            ),
            cost = ${supplierCostTzs},
            price = ${sellingPrice},
            stock_quantity = ${stock},
            supplier_price_usd = ${supplierPriceUsd},
            is_active = ${activeSupplierStatus}
          WHERE product_id = ${productId}
            AND external_variant_id = ${variant.vid}
        `;
      }

      const productSupplierPriceUsd = cjNumber(detail.sellPrice);

      if (!Number.isFinite(minimumCostTzs)) {
        minimumCostTzs = Math.ceil(
          productSupplierPriceUsd * defaults.usdToTzsRate,
        );
      }

      if (!Number.isFinite(minimumSellingPrice)) {
        minimumSellingPrice = calculateSellingPrice(
          minimumCostTzs,
          shippingTzs,
          defaults.reserveTzs,
          defaults.marginPercent,
        );
      }

      await sql`
        UPDATE products
        SET
          base_cost = ${minimumCostTzs},
          price = ${minimumSellingPrice},
          supplier_price_usd = ${productSupplierPriceUsd},
          status = CASE
            WHEN ${activeSupplierStatus} = false THEN 'draft'
            WHEN ${totalStock} <= 0 THEN 'draft'
            ELSE status
          END,
          last_supplier_sync_at = NOW(),
          supplier_sync_error = NULL,
          updated_at = NOW()
        WHERE id = ${productId}
      `;

      report.push({
        id: productId,
        externalProductId,
        ok: true,
        variants: variants.length,
        stock: totalStock,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown CJ synchronization error.";

      await sql`
        UPDATE products
        SET
          last_supplier_sync_at = NOW(),
          supplier_sync_error = ${message},
          updated_at = NOW()
        WHERE id = ${productId}
      `;

      report.push({
        id: productId,
        externalProductId,
        ok: false,
        error: message,
      });
    }
  }

  return {
    processed: products.length,
    successful: report.filter((entry) => entry.ok).length,
    failed: report.filter((entry) => !entry.ok).length,
    report,
  };
}
'@

$statusRoute = @'
import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { getCJAccessToken, pricingDefaults } from "@/lib/cj";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    await getCJAccessToken();

    return NextResponse.json({
      ok: true,
      connected: true,
      defaults: pricingDefaults(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        connected: false,
        error:
          error instanceof Error
            ? error.message
            : "CJ connection failed.",
        defaults: pricingDefaults(),
      },
      { status: 500 },
    );
  }
}
'@

$searchRoute = @'
import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { cjNumber, cjRequest } from "@/lib/cj";

export const dynamic = "force-dynamic";

type CJSearchProduct = {
  id?: string;
  pid?: string;
  nameEn?: string;
  productNameEn?: string;
  sku?: string;
  productSku?: string;
  bigImage?: string;
  productImage?: string;
  sellPrice?: string | number;
  nowPrice?: string | number;
  discountPrice?: string | number;
  categoryId?: string;
  categoryName?: string;
  oneCategoryName?: string;
  twoCategoryName?: string;
  threeCategoryName?: string;
  supplierName?: string;
  warehouseInventoryNum?: number;
  totalVerifiedInventory?: number;
  listedNum?: number;
  deliveryCycle?: string;
};

type CJSearchGroup = {
  productList?: CJSearchProduct[];
};

type CJSearchResponse = {
  content?: CJSearchGroup[];
  list?: CJSearchProduct[];
  totalRecords?: number;
  total?: number;
  totalPages?: number;
};

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") || "").trim().slice(0, 120);
    const page = Math.max(1, Math.min(1000, Number(url.searchParams.get("page") || 1)));

    if (query.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Enter at least two search characters." },
        { status: 400 },
      );
    }

    const params = new URLSearchParams({
      page: String(page),
      size: "20",
      keyWord: query,
      orderBy: "0",
      sort: "desc",
    });

    const data = await cjRequest<CJSearchResponse>(
      `/v1/product/listV2?${params.toString()}`,
    );

    const products = Array.isArray(data.content)
      ? data.content.flatMap((group) =>
          Array.isArray(group.productList) ? group.productList : [],
        )
      : Array.isArray(data.list)
        ? data.list
        : [];

    const normalized = products
      .map((product) => {
        const pid = product.id || product.pid || "";
        const price = cjNumber(
          product.discountPrice ??
            product.nowPrice ??
            product.sellPrice,
        );

        return {
          pid,
          name:
            product.nameEn ||
            product.productNameEn ||
            "Unnamed CJ product",
          sku: product.sku || product.productSku || "",
          image: product.bigImage || product.productImage || "",
          priceUsd: price,
          category:
            product.threeCategoryName ||
            product.categoryName ||
            product.twoCategoryName ||
            product.oneCategoryName ||
            "General",
          supplierName: product.supplierName || "CJdropshipping",
          inventory:
            product.totalVerifiedInventory ??
            product.warehouseInventoryNum ??
            0,
          listedNum: product.listedNum ?? 0,
          deliveryCycle: product.deliveryCycle || null,
        };
      })
      .filter((product) => product.pid);

    return NextResponse.json({
      ok: true,
      products: normalized,
      page,
      total: data.totalRecords ?? data.total ?? normalized.length,
      totalPages: data.totalPages ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "CJ product search failed.",
      },
      { status: 500 },
    );
  }
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
  variantImage?: string;
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

function stockForVariant(variant: CJVariant) {
  const inventories = Array.isArray(variant.inventories)
    ? variant.inventories
    : [];

  return Math.max(
    0,
    Math.floor(
      inventories.reduce(
        (total, inventory) =>
          total +
          cjNumber(
            inventory.totalInventory ??
              inventory.cjInventory ??
              inventory.factoryInventory,
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

    const pid = (body.pid || "").trim();

    if (!pid) {
      return NextResponse.json(
        { ok: false, error: "CJ product ID is missing." },
        { status: 400 },
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
      throw new Error("CJ returned incomplete product information.");
    }

    const sql = neon(process.env.DATABASE_URL);

    const duplicate = await sql`
      SELECT id, slug
      FROM products
      WHERE supplier_platform = 'cj'
        AND supplier_external_product_id = ${detail.pid}
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

    const variants = Array.isArray(detail.variants)
      ? detail.variants.filter((variant) => variant.vid).slice(0, 50)
      : [];

    let freightUsd = 0;
    let freightName: string | null = null;
    let freightAging: string | null = null;
    let freightWarning: string | null = null;

    const trialVariant = variants[0];

    if (trialVariant?.vid) {
      const origin =
        trialVariant.inventories?.find((entry) => entry.countryCode)
          ?.countryCode || "CN";

      try {
        const freightOptions = await cjRequest<CJFreightOption[]>(
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

        const validOptions = (Array.isArray(freightOptions)
          ? freightOptions
          : []
        )
          .map((option) => ({
            ...option,
            normalizedPrice: cjNumber(
              option.totalPostageFee ?? option.logisticPrice,
            ),
          }))
          .filter((option) => option.normalizedPrice > 0)
          .sort((left, right) => left.normalizedPrice - right.normalizedPrice);

        const cheapest = validOptions[0];

        if (cheapest) {
          freightUsd = cheapest.normalizedPrice;
          freightName = cheapest.logisticName || null;
          freightAging = cheapest.logisticAging || null;
        } else {
          freightWarning =
            "CJ returned no shipping option to Tanzania. Review shipping before publishing.";
        }
      } catch (error) {
        freightWarning =
          error instanceof Error
            ? `Freight check failed: ${error.message}`
            : "Freight check failed. Review shipping before publishing.";
      }
    } else {
      freightWarning =
        "CJ returned no usable variant for freight calculation.";
    }

    const shippingTzs = Math.ceil(freightUsd * usdToTzsRate);

    const variantRecords = variants.map((variant, index) => {
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

      return {
        externalVariantId: String(variant.vid),
        name: (
          variant.variantNameEn ||
          variant.variantKey ||
          `Option ${index + 1}`
        ).slice(0, 180),
        sku: (
          variant.variantSku ||
          `${detail.productSku || "CJ"}-${index + 1}`
        )
          .toUpperCase()
          .slice(0, 120),
        supplierPriceUsd,
        supplierCostTzs,
        sellingPrice,
        stock: stockForVariant(variant),
      };
    });

    const productSupplierPriceUsd =
      variantRecords.length > 0
        ? Math.min(
            ...variantRecords.map((variant) => variant.supplierPriceUsd),
          )
        : cjNumber(detail.sellPrice);
    const productCostTzs =
      variantRecords.length > 0
        ? Math.min(
            ...variantRecords.map((variant) => variant.supplierCostTzs),
          )
        : Math.ceil(productSupplierPriceUsd * usdToTzsRate);
    const productSellingPrice =
      variantRecords.length > 0
        ? Math.min(
            ...variantRecords.map((variant) => variant.sellingPrice),
          )
        : calculateSellingPrice(
            productCostTzs,
            shippingTzs,
            reserveTzs,
            marginPercent,
          );

    const productId = randomUUID();
    const name = detail.productNameEn.slice(0, 180);
    const slug = `${slugify(name)}-${detail.pid.slice(0, 6).toLowerCase()}`;
    const leafCategory = categoryLeaf(detail.categoryName);
    const categorySlug = slugify(leafCategory) || "general";
    const cleanedDescription = stripHtml(detail.description, 5000);
    const shortDescription =
      cleanedDescription.slice(0, 420) ||
      `${name} sourced through CJdropshipping.`;
    const images = [
      ...(Array.isArray(detail.productImageSet)
        ? detail.productImageSet
        : []),
      detail.bigImage || "",
    ]
      .filter(Boolean)
      .filter((value, index, list) => list.indexOf(value) === index)
      .slice(0, 4);

    await sql`
      INSERT INTO categories (name, slug, is_active, created_at)
      VALUES (${leafCategory}, ${categorySlug}, true, NOW())
      ON CONFLICT (slug)
      DO UPDATE SET name = EXCLUDED.name, is_active = true
    `;

    const [category] = await sql`
      SELECT id
      FROM categories
      WHERE slug = ${categorySlug}
      LIMIT 1
    `;

    let supplierId: string;

    const existingSupplier = await sql`
      SELECT id
      FROM suppliers
      WHERE LOWER(name) = LOWER('CJdropshipping')
      LIMIT 1
    `;

    if (existingSupplier[0]?.id) {
      supplierId = String(existingSupplier[0].id);

      await sql`
        UPDATE suppliers
        SET
          website = 'https://cjdropshipping.com',
          country = 'China',
          notes = ${`CJ Product ID: ${detail.pid}`},
          is_active = true,
          updated_at = NOW()
        WHERE id = ${supplierId}
      `;
    } else {
      supplierId = randomUUID();

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
          ${`CJ Product ID: ${detail.pid}`},
          true,
          NOW(),
          NOW()
        )
      `;
    }

    const fulfillmentNotes = [
      `CJ Product ID: ${detail.pid}`,
      freightName ? `Estimated logistics: ${freightName}` : "",
      freightAging ? `Estimated CJ transit: ${freightAging} days` : "",
      freightWarning || "",
      `Pricing rule: ${usdToTzsRate} TZS/USD, ${marginPercent}% markup, ${reserveTzs} TZS reserve.`,
    ]
      .filter(Boolean)
      .join("\n");

    const rawData = {
      pid: detail.pid,
      productSku: detail.productSku || null,
      supplierId: detail.supplierId || null,
      supplierName: detail.supplierName || null,
      productProperties: detail.productProEnSet || [],
      freight: {
        usd: freightUsd,
        method: freightName,
        aging: freightAging,
        warning: freightWarning,
      },
      importedAt: new Date().toISOString(),
    };

    const queries = [
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
          ${category.id},
          ${supplierId},
          ${name},
          ${slug},
          ${shortDescription},
          ${cleanedDescription || null},
          'WHOKEAS ALL IN',
          'draft',
          ${productCostTzs},
          ${roundUp(productSellingPrice)},
          ${shippingTzs},
          'TZS',
          false,
          NULL,
          ${
            freightAging
              ? Math.max(
                  1,
                  Number(String(freightAging).split("-").at(-1)) || 21,
                )
              : null
          },
          ${fulfillmentNotes},
          'cj',
          ${detail.pid},
          ${productSupplierPriceUsd},
          true,
          NOW(),
          ${freightWarning},
          ${JSON.stringify(rawData)}::jsonb,
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
      ...variantRecords.map(
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
            ${variant.externalVariantId},
            ${variant.supplierPriceUsd},
            NOW()
          )
          ON CONFLICT (sku)
          DO NOTHING
        `,
      ),
    ];

    await sql.transaction(queries);

    return NextResponse.json({
      ok: true,
      product: {
        id: productId,
        slug,
        name,
        status: "draft",
        supplierCostTzs: productCostTzs,
        shippingTzs,
        sellingPriceTzs: roundUp(productSellingPrice),
        estimatedProfitTzs:
          roundUp(productSellingPrice) -
          productCostTzs -
          shippingTzs,
        variants: variantRecords.length,
        freightMethod: freightName,
        freightAging,
        warning: freightWarning,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "CJ import failed.",
      },
      { status: 500 },
    );
  }
}
'@

$syncRoute = @'
import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { syncCJProducts } from "@/lib/cj-sync";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const report = await syncCJProducts(10);
    return NextResponse.json({ ok: true, ...report });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "CJ synchronization failed.",
      },
      { status: 500 },
    );
  }
}
'@

$cronRoute = @'
import { NextResponse } from "next/server";

import { syncCJProducts } from "@/lib/cj-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const report = await syncCJProducts(10);
    return NextResponse.json({ ok: true, ...report });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Scheduled CJ synchronization failed.",
      },
      { status: 500 },
    );
  }
}
'@

$cjClient = @'
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type SearchProduct = {
  pid: string;
  name: string;
  sku: string;
  image: string;
  priceUsd: number;
  category: string;
  supplierName: string;
  inventory: number;
  listedNum: number;
  deliveryCycle: string | null;
};

type ImportResult = {
  id: string;
  slug: string;
  name: string;
  status: string;
  supplierCostTzs: number;
  shippingTzs: number;
  sellingPriceTzs: number;
  estimatedProfitTzs: number;
  variants: number;
  freightMethod: string | null;
  freightAging: string | null;
  warning: string | null;
};

function formatTzs(value: number) {
  return `TZS ${Math.round(value).toLocaleString("en-US")}`;
}

function formatUsd(value: number) {
  return `$${Number(value).toFixed(2)}`;
}

export default function CJConnectorClient() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [query, setQuery] = useState("portable rechargeable fan");
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [importingPid, setImportingPid] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [usdToTzsRate, setUsdToTzsRate] = useState(2700);
  const [marginPercent, setMarginPercent] = useState(35);
  const [reserveTzs, setReserveTzs] = useState(3000);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/admin/cj/status", {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.error || "CJ connection failed.");
        }

        setConnected(true);
        setUsdToTzsRate(result.defaults.usdToTzsRate);
        setMarginPercent(result.defaults.marginPercent);
        setReserveTzs(result.defaults.reserveTzs);
      } catch (caught) {
        setConnected(false);
        setError(
          caught instanceof Error
            ? caught.message
            : "CJ connection failed.",
        );
      }
    })();
  }, []);

  const pricingExample = useMemo(() => {
    const supplier = 10 * usdToTzsRate;
    const shipping = 5 * usdToTzsRate;
    const selling = Math.ceil(
      ((supplier + shipping + reserveTzs) *
        (1 + marginPercent / 100)) /
        500,
    ) * 500;

    return {
      supplier,
      shipping,
      selling,
      profit: selling - supplier - shipping,
    };
  }, [usdToTzsRate, marginPercent, reserveTzs]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    setError("");
    setMessage("");
    setImportResult(null);

    try {
      const response = await fetch(
        `/api/admin/cj/search?q=${encodeURIComponent(query)}`,
        { cache: "no-store" },
      );
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Search failed.");
      }

      setProducts(result.products);
      setMessage(
        result.products.length > 0
          ? `${result.products.length} CJ products loaded.`
          : "No matching CJ products were found.",
      );
    } catch (caught) {
      setProducts([]);
      setError(
        caught instanceof Error ? caught.message : "Search failed.",
      );
    } finally {
      setSearching(false);
    }
  }

  async function importProduct(pid: string) {
    setImportingPid(pid);
    setError("");
    setMessage("");
    setImportResult(null);

    try {
      const response = await fetch("/api/admin/cj/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid,
          usdToTzsRate,
          marginPercent,
          reserveTzs,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Import failed.");
      }

      setImportResult(result.product);
      setMessage(
        `${result.product.name} was imported as a draft product.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Import failed.",
      );
    } finally {
      setImportingPid("");
    }
  }

  async function syncProducts() {
    setSyncing(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/cj/sync", {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Synchronization failed.");
      }

      setMessage(
        `CJ synchronization complete: ${result.successful} successful, ${result.failed} failed.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Synchronization failed.",
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b36f00]">
                Connection
              </p>
              <h2 className="mt-1 text-2xl font-black">CJdropshipping API</h2>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-sm font-black ${
                connected === true
                  ? "bg-emerald-100 text-emerald-700"
                  : connected === false
                    ? "bg-red-100 text-red-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {connected === true
                ? "Connected"
                : connected === false
                  ? "Connection failed"
                  : "Checking..."}
            </span>
          </div>

          <form onSubmit={search} className="mt-6 flex gap-3">
            <input
              required
              minLength={2}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products, for example: wireless earbuds"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#e49b00]"
            />
            <button
              type="submit"
              disabled={searching || connected !== true}
              className="rounded-lg bg-[#ffd814] px-5 py-3 font-black hover:bg-[#f7ca00] disabled:opacity-50"
            >
              {searching ? "Searching..." : "Search CJ"}
            </button>
          </form>
        </div>

        <aside className="rounded-xl bg-[#101820] p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffd814]">
            Automatic pricing
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <label>
              <span className="text-xs text-white/70">TZS per USD</span>
              <input
                type="number"
                min={1}
                value={usdToTzsRate}
                onChange={(event) =>
                  setUsdToTzsRate(Number(event.target.value))
                }
                className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-black"
              />
            </label>

            <label>
              <span className="text-xs text-white/70">Markup %</span>
              <input
                type="number"
                min={0}
                value={marginPercent}
                onChange={(event) =>
                  setMarginPercent(Number(event.target.value))
                }
                className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-black"
              />
            </label>

            <label>
              <span className="text-xs text-white/70">Reserve TZS</span>
              <input
                type="number"
                min={0}
                value={reserveTzs}
                onChange={(event) =>
                  setReserveTzs(Number(event.target.value))
                }
                className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-black"
              />
            </label>
          </div>

          <div className="mt-5 rounded-lg bg-white/10 p-4 text-sm">
            <p>
              Example supplier:{" "}
              <strong>{formatTzs(pricingExample.supplier)}</strong>
            </p>
            <p className="mt-1">
              Example shipping:{" "}
              <strong>{formatTzs(pricingExample.shipping)}</strong>
            </p>
            <p className="mt-1">
              Suggested selling:{" "}
              <strong>{formatTzs(pricingExample.selling)}</strong>
            </p>
            <p className="mt-1 text-emerald-300">
              Estimated profit:{" "}
              <strong>{formatTzs(pricingExample.profit)}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={syncProducts}
            disabled={syncing || connected !== true}
            className="mt-5 w-full rounded-lg border border-white/30 px-4 py-3 text-sm font-black hover:border-white disabled:opacity-50"
          >
            {syncing ? "Synchronizing..." : "Sync Imported CJ Products"}
          </button>
        </aside>
      </section>

      {message && (
        <div className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {importResult && (
        <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h3 className="text-xl font-black text-emerald-800">
            Draft imported successfully
          </h3>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Supplier cost</p>
              <p className="font-black">
                {formatTzs(importResult.supplierCostTzs)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Shipping estimate</p>
              <p className="font-black">
                {formatTzs(importResult.shippingTzs)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Selling price</p>
              <p className="font-black">
                {formatTzs(importResult.sellingPriceTzs)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Estimated profit</p>
              <p className="font-black text-emerald-700">
                {formatTzs(importResult.estimatedProfitTzs)}
              </p>
            </div>
          </div>

          {importResult.warning && (
            <p className="mt-4 rounded-lg bg-amber-100 p-3 text-sm font-semibold text-amber-800">
              {importResult.warning}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/admin/products"
              className="rounded-lg bg-[#101820] px-4 py-2 text-sm font-black text-white"
            >
              Review in Product Control
            </a>
            <a
              href={`/products/${importResult.slug}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black"
            >
              Preview product route
            </a>
          </div>
        </section>
      )}

      <section className="mt-7">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b36f00]">
              CJ catalogue
            </p>
            <h2 className="mt-1 text-3xl font-black">Search results</h2>
          </div>
          <p className="text-sm text-slate-500">{products.length} shown</p>
        </div>

        {products.length === 0 ? (
          <div className="mt-5 rounded-xl bg-white p-8 shadow-sm">
            Search CJ to load products.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => {
              const approximateTzs = product.priceUsd * usdToTzsRate;

              return (
                <article
                  key={product.pid}
                  className="overflow-hidden rounded-xl bg-white shadow-sm"
                >
                  <div className="aspect-square bg-slate-100">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl font-black text-slate-400">
                        CJ
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">
                      {product.category}
                    </p>
                    <h3 className="mt-2 line-clamp-2 text-lg font-black">
                      {product.name}
                    </h3>
                    <p className="mt-2 text-xs text-slate-500">
                      SKU: {product.sku || "Not shown"}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">CJ price</p>
                        <p className="font-black">
                          {formatUsd(product.priceUsd)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">
                          Approx. product cost
                        </p>
                        <p className="font-black">
                          {formatTzs(approximateTzs)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 text-sm text-slate-600">
                      CJ inventory: {product.inventory.toLocaleString("en-US")}
                    </p>
                    {product.deliveryCycle && (
                      <p className="mt-1 text-sm text-slate-600">
                        CJ handling: {product.deliveryCycle} days
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => importProduct(product.pid)}
                      disabled={Boolean(importingPid)}
                      className="mt-5 w-full rounded-full bg-[#ffd814] px-5 py-3 text-sm font-black hover:bg-[#f7ca00] disabled:opacity-50"
                    >
                      {importingPid === product.pid
                        ? "Checking freight and importing..."
                        : "Import as Draft"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
'@

$cjPage = @'
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import CJConnectorClient from "@/components/admin/CJConnectorClient";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function CJAdminPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  return (
    <main className="min-h-screen bg-[#eaeded] text-[#0f1111]">
      <header className="bg-[#101820] text-white shadow-md">
        <div className="mx-auto flex min-h-16 max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-12 w-[72px]">
              <Image
                src="/brand/logo-mark.png"
                alt=""
                fill
                priority
                sizes="72px"
                className="object-contain"
              />
            </div>
            <div>
              <div className="font-black tracking-[0.12em]">WHOKEAS</div>
              <div className="text-[10px] font-black tracking-[0.3em] text-[#f3b61f]">
                CJ AUTOMATION
              </div>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/orders"
              className="rounded-lg border border-white/25 px-4 py-2 text-sm font-bold"
            >
              Orders
            </Link>
            <Link
              href="/admin/products"
              className="rounded-lg border border-white/25 px-4 py-2 text-sm font-bold"
            >
              Products
            </Link>
            <Link
              href="/admin/cj"
              className="rounded-lg bg-[#ffd814] px-4 py-2 text-sm font-bold text-black"
            >
              CJ Import
            </Link>
            <form action="/api/admin/logout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-white/25 px-4 py-2 text-sm font-bold"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-7 lg:px-6">
        <div className="mb-6">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#b36f00]">
            Automated supplier sourcing
          </p>
          <h1 className="mt-2 text-4xl font-black">
            CJ Product Import Centre
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Search CJ, estimate freight to Tanzania, calculate WHOKEAS pricing,
            import complete draft products and synchronize supplier stock.
          </p>
        </div>

        <CJConnectorClient />
      </div>
    </main>
  );
}
'@

$files = @{
  "src\db\migrate-cj-connector.ts" = $migration
  "src\lib\cj.ts" = $cjLib
  "src\lib\cj-sync.ts" = $cjSyncLib
  "src\app\api\admin\cj\status\route.ts" = $statusRoute
  "src\app\api\admin\cj\search\route.ts" = $searchRoute
  "src\app\api\admin\cj\import\route.ts" = $importRoute
  "src\app\api\admin\cj\sync\route.ts" = $syncRoute
  "src\app\api\cron\cj-sync\route.ts" = $cronRoute
  "src\components\admin\CJConnectorClient.tsx" = $cjClient
  "src\app\admin\cj\page.tsx" = $cjPage
}

foreach ($relativePath in $files.Keys) {
  $fullPath = Join-Path (Get-Location) $relativePath
  [System.IO.File]::WriteAllText($fullPath, $files[$relativePath], $utf8)
}

$vercelPath = Join-Path (Get-Location) "vercel.json"
$cronRecord = [PSCustomObject]@{
  path = "/api/cron/cj-sync"
  schedule = "0 2 * * *"
}

if (Test-Path $vercelPath) {
  $vercel = Get-Content -LiteralPath $vercelPath -Raw | ConvertFrom-Json

  if (-not $vercel.PSObject.Properties.Name.Contains("crons")) {
    $vercel | Add-Member -MemberType NoteProperty -Name "crons" -Value @()
  }

  $existingCrons = @($vercel.crons) |
    Where-Object { $_.path -ne "/api/cron/cj-sync" }

  $vercel.crons = @($existingCrons) + @($cronRecord)
}
else {
  $vercel = [PSCustomObject]@{
    '$schema' = "https://openapi.vercel.sh/vercel.json"
    crons = @($cronRecord)
  }
}

$vercelJson = $vercel | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($vercelPath, $vercelJson, $utf8)

Write-Host "Migrating Neon for the CJ connector..." -ForegroundColor Cyan
npx tsx .\src\db\migrate-cj-connector.ts

Remove-Item -Recurse -Force ".\.next" -ErrorAction SilentlyContinue

Write-Host "Running production build verification..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "CJ automation connector installed." -ForegroundColor Green
Write-Host "Run: npm run dev" -ForegroundColor Yellow
Write-Host "Open: http://localhost:3000/admin/cj" -ForegroundColor Yellow
Write-Host ""
Write-Host "Important: add CJ_API_KEY and CRON_SECRET to Vercel before deploying." -ForegroundColor Yellow
