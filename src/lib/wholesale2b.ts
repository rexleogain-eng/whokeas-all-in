import { createHash, randomUUID } from "node:crypto";

import {
  calculateMarketSellingPrice,
} from "@/lib/automation-config";
import { getAutomationSettings } from "@/lib/catalog-automation";
import { catalogSql, ensureCatalogSchema } from "@/lib/catalog-schema";
import {
  ensureGlobalMarketSchema,
} from "@/lib/global-markets";
import {
  GOOGLE_MERCHANT_MIN_IMAGE_SIDE,
  selectMerchantPrimaryImage,
} from "@/lib/merchant-image-quality";
import { US_SHIPPING_MAX_DAYS } from "@/lib/seo";

export type Wholesale2BStatus = {
  configured: boolean;
  feedConfigured: boolean;
  apiConfigured: boolean;
  importedProducts: number;
  activeProducts: number;
  drafts: number;
  lastSyncAt: string | null;
};

export type Wholesale2BImportReport = {
  configured: boolean;
  fetched: number;
  considered: number;
  imported: number;
  published: number;
  drafts: number;
  duplicates: number;
  skipped: number;
  failed: number;
  message: string;
  products: Array<{
    externalId: string;
    name: string;
    status: "active" | "draft" | "skipped" | "failed";
    reason?: string;
  }>;
};

type FeedRecord = Record<string, string>;

type NormalizedProduct = {
  externalId: string;
  name: string;
  description: string;
  category: string;
  wholesalePrice: number;
  listPrice: number | null;
  shippingCost: number;
  shippingCostProvided: boolean;
  stock: number;
  brand: string | null;
  upc: string | null;
  images: string[];
  deliveryDays: number | null;
  raw: FeedRecord;
};

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function clean(value: unknown, max = 5000) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
}

function numberValue(value: unknown) {
  const normalized = String(value || "")
    .replace(/[$,]/g, "")
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function integerValue(value: unknown) {
  return Math.max(0, Math.floor(numberValue(value)));
}

function headerKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pick(record: FeedRecord, aliases: string[]) {
  for (const alias of aliases) {
    const value = record[headerKey(alias)];
    if (value !== undefined && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function hasField(record: FeedRecord, aliases: string[]) {
  return aliases.some((alias) => record[headerKey(alias)] !== undefined);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((item) => item.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((item) => item.trim() !== "")) rows.push(row);
  }

  if (rows.length < 2) return [] as FeedRecord[];
  const headers = rows[0].map((item) => headerKey(item));
  return rows.slice(1).map((cells) => {
    const record: FeedRecord = {};
    headers.forEach((header, index) => {
      if (header) record[header] = cells[index] ?? "";
    });
    return record;
  });
}

function deliveryDays(value: string) {
  const matches = value.match(/\d+/g);
  if (!matches?.length) return null;
  return Math.max(1, Number(matches.at(-1)) || 0) || null;
}

function normalize(record: FeedRecord): NormalizedProduct | null {
  const externalId = clean(
    pick(record, ["item number", "item no", "product id", "product_id", "sku", "id"]),
    220,
  );
  const name = clean(pick(record, ["item name", "product name", "title", "name"]), 180);
  const description = clean(
    pick(record, ["item description", "product description", "description", "details"]),
    9000,
  );
  const category = clean(
    pick(record, ["sub-category name", "subcategory", "sub category", "category name", "category"]),
    120,
  ) || "General";
  const wholesalePrice = numberValue(
    pick(record, ["wholesale price", "wholesale_price", "wholesale", "cost", "dealer price"]),
  );
  const listPriceRaw = pick(record, ["list price", "retail price", "msrp", "map price"]);
  const listPrice = listPriceRaw ? numberValue(listPriceRaw) : null;
  const shippingAliases = ["shipping cost", "shipping", "fixed shipping", "shipping price"];
  const shippingCostProvided = hasField(record, shippingAliases);
  const shippingCost = Math.max(0, numberValue(pick(record, shippingAliases)));
  const stock = integerValue(
    pick(record, ["quantity in stock", "quantity", "qty", "stock", "inventory"]),
  );
  const brand = clean(pick(record, ["brand name", "brand", "manufacturer"]), 100) || null;
  const upc = clean(pick(record, ["upc", "ean", "gtin"]), 80) || null;
  const delivery = deliveryDays(
    pick(record, ["delivery days", "delivery time", "shipping time", "ship time"]),
  );

  const images = Array.from(
    new Set(
      [
        "url to largest image1", "url to largest image2", "url to largest image3",
        "image1", "image2", "image3", "image4", "image 1", "image 2", "image 3",
        "image url", "image", "main image",
      ]
        .map((alias) => pick(record, [alias]))
        .filter((value) => /^https?:\/\//i.test(value)),
    ),
  ).slice(0, 8);

  if (!externalId || name.length < 3 || wholesalePrice <= 0 || images.length === 0) {
    return null;
  }

  return {
    externalId,
    name,
    description,
    category,
    wholesalePrice,
    listPrice: listPrice && listPrice > 0 ? listPrice : null,
    shippingCost,
    shippingCostProvided,
    stock,
    brand,
    upc,
    images,
    deliveryDays: delivery,
    raw: record,
  };
}

async function fetchFeed() {
  const feedUrl = env("WHOLESALE2B_FEED_URL");
  if (!feedUrl) {
    throw new Error("WHOLESALE2B_FEED_URL is not configured.");
  }
  const response = await fetch(feedUrl, {
    cache: "no-store",
    headers: { Accept: "text/csv,text/plain,*/*" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`Wholesale2B feed returned HTTP ${response.status}.`);
  }
  const text = await response.text();
  if (!text.trim()) throw new Error("Wholesale2B returned an empty feed.");
  return parseCsv(text);
}

function stableSku(externalId: string) {
  const readable = externalId.replace(/[^A-Za-z0-9]+/g, "").slice(0, 24).toUpperCase();
  const hash = createHash("sha1").update(externalId).digest("hex").slice(0, 8).toUpperCase();
  return `W2B-${readable || "ITEM"}-${hash}`.slice(0, 170);
}

export async function getWholesale2BStatus(): Promise<Wholesale2BStatus> {
  await ensureCatalogSchema();
  const sql = catalogSql();
  const rows = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status::text = 'active')::int AS active,
      COUNT(*) FILTER (WHERE status::text = 'draft')::int AS drafts,
      MAX(last_supplier_sync_at) AS "lastSyncAt"
    FROM products
    WHERE supplier_platform = 'wholesale2b'
  `;
  const row = rows[0] || {};
  const feedConfigured = Boolean(env("WHOLESALE2B_FEED_URL"));
  const apiConfigured = Boolean(env("WHOLESALE2B_API_KEY") && env("WHOLESALE2B_API_BASE_URL"));
  return {
    configured: feedConfigured || apiConfigured,
    feedConfigured,
    apiConfigured,
    importedProducts: Number(row.total || 0),
    activeProducts: Number(row.active || 0),
    drafts: Number(row.drafts || 0),
    lastSyncAt: row.lastSyncAt ? String(row.lastSyncAt) : null,
  };
}

export async function importWholesale2BProducts(limit = 10): Promise<Wholesale2BImportReport> {
  await ensureCatalogSchema();
  await ensureGlobalMarketSchema();
  const sql = catalogSql();
  const records = await fetchFeed();
  const normalized = records.map(normalize).filter((item): item is NormalizedProduct => Boolean(item));
  const config = await getAutomationSettings();
  const usMarket = config.markets.find((market) => market.enabled && market.countryCode === "US" && market.currency === "USD");
  if (!usMarket) throw new Error("The U.S. USD market is not enabled in WHOKEAS automation settings.");

  const report: Wholesale2BImportReport = {
    configured: true,
    fetched: records.length,
    considered: 0,
    imported: 0,
    published: 0,
    drafts: 0,
    duplicates: 0,
    skipped: Math.max(0, records.length - normalized.length),
    failed: 0,
    message: "Wholesale2B import completed.",
    products: [],
  };

  const candidates = normalized.slice(0, Math.max(1, Math.min(25, limit)));

  for (const item of candidates) {
    report.considered += 1;
    try {
      const duplicate = await sql`
        SELECT id
        FROM products
        WHERE supplier_platform = 'wholesale2b'
          AND supplier_external_product_id = ${item.externalId}
        LIMIT 1
      `;
      if (duplicate.length > 0) {
        report.duplicates += 1;
        report.products.push({ externalId: item.externalId, name: item.name, status: "skipped", reason: "Already imported." });
        continue;
      }

      if (!item.shippingCostProvided) {
        report.skipped += 1;
        report.products.push({ externalId: item.externalId, name: item.name, status: "skipped", reason: "Feed did not provide a shipping-cost field, so landed cost cannot be verified safely." });
        continue;
      }
      if (item.stock <= 0) {
        report.skipped += 1;
        report.products.push({ externalId: item.externalId, name: item.name, status: "skipped", reason: "Out of stock." });
        continue;
      }
      if (item.deliveryDays !== null && item.deliveryDays > US_SHIPPING_MAX_DAYS) {
        report.skipped += 1;
        report.products.push({ externalId: item.externalId, name: item.name, status: "skipped", reason: `Delivery estimate exceeds ${US_SHIPPING_MAX_DAYS} days.` });
        continue;
      }

      const imageSelection = await selectMerchantPrimaryImage(item.images);
      const pricing = calculateMarketSellingPrice({
        supplierCostUsd: item.wholesalePrice,
        freightUsd: item.shippingCost,
        fxRate: 1,
        reserveLocal: usMarket.riskReserveLocal,
        markupPercent: Math.max(config.defaultMarkupPercent, usMarket.markupPercent),
        minimumProfitLocal: usMarket.minimumProfitLocal,
        paymentFeePercent: usMarket.paymentFeePercent,
        roundingIncrementLocal: usMarket.roundingIncrementLocal,
      });
      const priceAllowed = pricing.sellingPriceLocal > 0 && pricing.sellingPriceLocal <= usMarket.maximumSellingPriceLocal;
      const canPublish = Boolean(imageSelection.primary && priceAllowed);
      const status: "active" | "draft" = canPublish ? "active" : "draft";
      const id = randomUUID();
      const categorySlug = slugify(item.category) || "general";
      const slug = `${slugify(item.name)}-${createHash("sha1").update(item.externalId).digest("hex").slice(0, 7)}`.slice(0, 195);
      const compareAt = Math.max(
        pricing.sellingPriceLocal,
        item.listPrice || 0,
        Math.ceil(pricing.sellingPriceLocal * 1.12),
      );
      const warning = !imageSelection.primary
        ? `No product image met the ${GOOGLE_MERCHANT_MIN_IMAGE_SIDE} x ${GOOGLE_MERCHANT_MIN_IMAGE_SIDE} Merchant Center minimum.`
        : !priceAllowed
          ? `Selling price exceeds the configured U.S. maximum of USD ${usMarket.maximumSellingPriceLocal}.`
          : null;

      await sql`
        INSERT INTO categories (name, slug, is_active, created_at)
        VALUES (${item.category}, ${categorySlug}, true, NOW())
        ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, is_active = true
      `;
      const categoryRows = await sql`SELECT id FROM categories WHERE slug = ${categorySlug} LIMIT 1`;
      if (!categoryRows[0]?.id) throw new Error("Could not resolve Wholesale2B category.");

      await sql`
        INSERT INTO products (
          id, category_id, name, slug, short_description, description, brand, status,
          base_cost, price, compare_at_price, estimated_shipping_cost, currency,
          supplier_platform, supplier_external_product_id, supplier_price_usd,
          supplier_sync_enabled, last_supplier_sync_at, supplier_sync_error,
          supplier_raw_data, estimated_delivery_days, fulfillment_notes,
          created_at, updated_at
        ) VALUES (
          ${id}, ${categoryRows[0].id}, ${item.name}, ${slug},
          ${clean(item.description || item.name, 1200)}, ${item.description || null},
          ${item.brand}, ${status}, ${pricing.supplierCostLocal}, ${pricing.sellingPriceLocal},
          ${compareAt}, ${pricing.shippingLocal}, 'USD', 'wholesale2b', ${item.externalId},
          ${item.wholesalePrice}, true, NOW(), ${warning},
          ${JSON.stringify({ wholesale2b: { upc: item.upc, brand: item.brand, source: item.raw } })}::jsonb,
          ${item.deliveryDays}, 'Wholesale2B supplier fulfillment. Order routing will be enabled after API credentials are activated.',
          NOW(), NOW()
        )
      `;

      for (let index = 0; index < imageSelection.images.length; index += 1) {
        await sql`
          INSERT INTO product_images (id, product_id, image_url, alt_text, sort_order, created_at)
          VALUES (${randomUUID()}, ${id}, ${imageSelection.images[index]}, ${item.name}, ${index}, NOW())
        `;
      }

      await sql`
        INSERT INTO product_variants (
          id, product_id, name, sku, options, cost, price, stock_quantity, is_active,
          external_variant_id, supplier_price_usd, created_at
        ) VALUES (
          ${randomUUID()}, ${id}, 'Standard', ${stableSku(item.externalId)}, '{}'::jsonb,
          ${pricing.supplierCostLocal}, ${pricing.sellingPriceLocal}, ${item.stock}, true,
          ${item.externalId}, ${item.wholesalePrice}, NOW()
        )
      `;

      await sql`
        INSERT INTO product_market_prices (
          product_id, market_key, market_name, country_code, currency, locale, is_primary,
          supplier_cost_usd, freight_usd, fx_rate, supplier_cost_local, shipping_local,
          landed_cost_local, selling_price_local, compare_at_price_local, estimated_profit_local,
          estimated_delivery_days, freight_method, freight_is_estimate, available, warning, updated_at
        ) VALUES (
          ${id}, ${usMarket.key}, ${usMarket.name}, 'US', 'USD', ${usMarket.locale}, true,
          ${item.wholesalePrice}, ${item.shippingCost}, 1, ${pricing.supplierCostLocal}, ${pricing.shippingLocal},
          ${pricing.landedCostLocal}, ${pricing.sellingPriceLocal}, ${compareAt}, ${pricing.estimatedProfitLocal},
          ${item.deliveryDays}, 'Wholesale2B supplier shipping', false, ${priceAllowed}, ${warning}, NOW()
        )
        ON CONFLICT (product_id, market_key) DO UPDATE SET
          supplier_cost_usd = EXCLUDED.supplier_cost_usd,
          freight_usd = EXCLUDED.freight_usd,
          selling_price_local = EXCLUDED.selling_price_local,
          compare_at_price_local = EXCLUDED.compare_at_price_local,
          estimated_profit_local = EXCLUDED.estimated_profit_local,
          estimated_delivery_days = EXCLUDED.estimated_delivery_days,
          available = EXCLUDED.available,
          warning = EXCLUDED.warning,
          updated_at = NOW()
      `;

      report.imported += 1;
      if (status === "active") report.published += 1;
      else report.drafts += 1;
      report.products.push({ externalId: item.externalId, name: item.name, status, reason: warning || undefined });
    } catch (error) {
      report.failed += 1;
      report.products.push({
        externalId: item.externalId,
        name: item.name,
        status: "failed",
        reason: error instanceof Error ? error.message : "Wholesale2B import failed.",
      });
    }
  }

  report.message = `${report.imported} Wholesale2B products imported: ${report.published} published, ${report.drafts} drafts, ${report.duplicates} duplicates, ${report.skipped} skipped.`;
  return report;
}
