import { catalogSql } from "@/lib/catalog-schema";
import { ensureGlobalMarketSchema } from "@/lib/global-markets";
import {
  productLevelGtin,
  verifiedMerchantBrand,
} from "@/lib/merchant-identifiers";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  US_SHIPPING_MAX_DAYS,
  US_TARGET_COUNTRY_CODE,
} from "@/lib/seo";
import { isRestrictedStorefrontProduct } from "@/lib/store-catalog";
import { storefrontSummary, storefrontTitle } from "@/lib/store-copy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MerchantProductRow = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  brand: string | null;
  supplierRawData: unknown;
  categoryName: string | null;
  priceUsd: string;
  images: unknown;
  hasVariants: boolean;
  variantInStock: boolean;
};

// Keep Merchant Center at least as strict as the indexable storefront/sitemap.
// These rules only hold products out of Google Shopping; they do not delete or
// deactivate catalogue records.
const MERCHANT_RESTRICTED_PRODUCT_PATTERNS = [
  /\bmini\s+fan\s+heater\s+wall[-\s]?mounted\s+dormitory\s+warm\s+artifact\b/i,
  /\bhearing\s+(?:aid|amplifier)\b/i,
  /\bpersonal\s+sound\s+amplifier\b/i,
  /\b(?:medical|physiotherapy|rehabilitation|chiropractic)\b/i,
  /\b(?:moxibustion|acupuncture|acupoint)\b/i,
  /\b(?:blood\s+pressure|blood\s+glucose|glucose\s+meter|oximeter|nebulizer|insulin)\b/i,
  /\b(?:pregnan\w*|fertility|ovulation|breast\s+pump)\b/i,
  /\b(?:pelvic|vaginal|erectile|prostate|penis|sex\s+toy|adult\s+toy)\b/i,
  /\b(?:plasma\s+(?:pen|spot)|electroporation|mesotherapy)\b/i,
  /\b(?:mole|wart|tattoo|freckle)\s+remov(?:al|er)\b/i,
  /\b(?:orthodontic|dental\s+scaler|teeth?\s+whitening\s+(?:instrument|device))\b/i,
  /\b(?:microneedl\w*|derma\s+roller)\b/i,
  /\b(?:eye\s+care\s+device|heated\s+eye\s+massager)\b/i,
  /\b(?:radiation\s+protection|radiation\s+shield(?:ing)?)\b/i,
];

const MERCHANT_RESTRICTED_CLAIM_PATTERNS = [
  /\b(?:slimming|weight\s*loss|fat\s*burn(?:ing)?|body\s+shaping|body\s+sculpt(?:ing)?)\b/i,
  /\b(?:face|facial)\s+sculpt(?:ing)?\b/i,
  /\banti[-\s]?cellulite\b/i,
  /\b(?:skin\s+tightening|facial\s+lifting)\b/i,
  /\b(?:hair\s+growth|hair\s+regrowth|anti[-\s]?hair\s+loss|stimulates?\s+hair\s+follicles?)\b/i,
  /\blymphatic\s+drainage\b/i,
  /\b(?:skin\s+)?whitening\b/i,
  /\bskin\s+rejuvenation\b/i,
  /\bbreast\s+enlargement\b/i,
  /\b(?:prevent|cure|treat(?:ment)?|heal(?:ing)?)\s+(?:a|an|the\s+)?(?:disease|condition|ailment|pain)\b/i,
];

function removeInvalidXmlCharacters(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ");
}

function xml(value: unknown) {
  return removeInvalidXmlCharacters(String(value ?? ""))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanText(value: unknown, maximumLength: number) {
  return removeInvalidXmlCharacters(String(value ?? ""))
    .replace(/<[^>]*>/g, " ")
    .replace(/\b(?:Highlights|Specification|Details)\s+undefined\b/gi, " ")
    .replace(/\bsupplied through CJdropshipping\.?\b/gi, " ")
    .replace(/\b(?:supplied|fulfilled)\s+(?:through|by)\s*\.\s*/gi, " ")
    // Supplier MOQ notes are fulfilment metadata, not a customer-facing offer
    // condition, and must not leak into Google Shopping descriptions.
    .replace(/\b(?:note\s*:\s*)?MOQ\s*(?:is|[:=])?\s*\d+(?:\s*(?:pieces?|pcs?))?\b[.;,]?/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
}

function merchantTitle(value: unknown) {
  const curated = cleanText(storefrontTitle(value), 150);
  if (curated && !curated.endsWith("…")) return curated;

  const full = cleanText(value, 150)
    .replace(/\bCJ\s*dropshipping\b/gi, "")
    .replace(/\bdropshipping\b/gi, "")
    .replace(/\bwholesale\b/gi, "")
    .replace(/\bhot\s*sale\b/gi, "")
    .replace(/\bnew\s*arrival\b/gi, "")
    .replace(/\b202[0-9]\b/g, "")
    .replace(/[_|]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[,;:\-–—\s]+|[,;:\-–—\s]+$/g, "")
    .trim();

  return full || curated || "WHOKEAS Selection";
}

function absoluteHttpUrl(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  try {
    const url = new URL(text, `${SITE_URL}/`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  }
  catch {
    return null;
  }
}

function readImageUrls(value: unknown) {
  const rawValues = Array.isArray(value)
    ? value
    : (() => {
        if (typeof value !== "string") return [];
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        }
        catch {
          return [];
        }
      })();

  return [...new Set(
    rawValues
      .map(absoluteHttpUrl)
      .filter((item): item is string => Boolean(item)),
  )].slice(0, 11);
}

function merchantIdentifier(value: unknown, maximumLength: number) {
  return cleanText(value, maximumLength)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function merchantPolicyEligible(row: MerchantProductRow) {
  if (
    isRestrictedStorefrontProduct({
      name: row.name,
      shortDescription: row.shortDescription,
      description: row.description,
    })
  ) {
    return false;
  }

  const productIdentity = [row.name, storefrontTitle(row.name), row.categoryName]
    .filter(Boolean)
    .join(" ");

  if (MERCHANT_RESTRICTED_PRODUCT_PATTERNS.some((pattern) => pattern.test(productIdentity))) {
    return false;
  }

  const productClaims = [productIdentity, row.shortDescription, row.description]
    .filter(Boolean)
    .join(" ");

  return !MERCHANT_RESTRICTED_CLAIM_PATTERNS.some((pattern) => pattern.test(productClaims));
}

function merchantItem(row: MerchantProductRow) {
  const productId = merchantIdentifier(row.id, 50);
  const title = merchantTitle(row.name);
  const description = cleanText(
    storefrontSummary(row.name, row.shortDescription || row.description),
    1500,
  ) || `Buy ${title} online from ${SITE_NAME}.`;
  const productUrl = `${SITE_URL}/products/${encodeURIComponent(row.slug)}`;
  const imageUrls = readImageUrls(row.images);
  const mainImage = imageUrls[0];
  const priceUsd = Number(row.priceUsd || 0);
  const availability = row.hasVariants && !row.variantInStock ? "out_of_stock" : "in_stock";

  const brand = verifiedMerchantBrand(row.brand, [SITE_NAME]) || "";
  const gtin = productLevelGtin(row.supplierRawData);
  const identifierExists = Boolean(brand || gtin);

  if (!productId || !title || !mainImage || priceUsd <= 0) return null;

  const additionalImages = imageUrls
    .slice(1, 11)
    .map((image) => `    <g:additional_image_link>${xml(image)}</g:additional_image_link>`)
    .join("\n");

  const optionalLines = [
    brand ? `    <g:brand>${xml(brand)}</g:brand>` : "",
    gtin ? `    <g:gtin>${xml(gtin)}</g:gtin>` : "",
    `    <g:identifier_exists>${identifierExists ? "true" : "false"}</g:identifier_exists>`,
    additionalImages,
  ].filter(Boolean).join("\n");

  return [
    "  <item>",
    `    <g:id>${xml(productId)}</g:id>`,
    `    <g:title>${xml(title)}</g:title>`,
    `    <g:description>${xml(description)}</g:description>`,
    `    <g:link>${xml(productUrl)}</g:link>`,
    `    <g:image_link>${xml(mainImage)}</g:image_link>`,
    "    <g:condition>new</g:condition>",
    `    <g:availability>${availability}</g:availability>`,
    `    <g:price>${priceUsd.toFixed(2)} USD</g:price>`,
    "    <g:adult>false</g:adult>",
    optionalLines,
    "  </item>",
  ].filter(Boolean).join("\n");
}

async function readMerchantProducts() {
  await ensureGlobalMarketSchema();
  const sql = catalogSql();

  const rows = await sql`
    SELECT
      p.id::text AS id,
      p.name,
      p.slug,
      p.short_description AS "shortDescription",
      p.description,
      p.brand,
      p.supplier_raw_data AS "supplierRawData",
      c.name AS "categoryName",
      us_market.selling_price_local::text AS "priceUsd",
      (
        SELECT COALESCE(
          json_agg(pi.image_url ORDER BY pi.sort_order ASC, pi.created_at ASC),
          '[]'::json
        )
        FROM product_images pi
        WHERE pi.product_id = p.id
          AND NULLIF(TRIM(pi.image_url), '') IS NOT NULL
      ) AS images,
      EXISTS (
        SELECT 1
        FROM product_variants pv
        WHERE pv.product_id = p.id
          AND pv.is_active = true
      ) AS "hasVariants",
      EXISTS (
        SELECT 1
        FROM product_variants pv
        WHERE pv.product_id = p.id
          AND pv.is_active = true
          AND pv.stock_quantity > 0
      ) AS "variantInStock"
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    JOIN LATERAL (
      SELECT market.selling_price_local
      FROM product_market_prices market
      WHERE market.product_id = p.id
        AND market.country_code = ${US_TARGET_COUNTRY_CODE}
        AND market.currency = 'USD'
        AND market.available = true
        AND market.selling_price_local > 0
        AND (
          market.estimated_delivery_days IS NULL
          OR market.estimated_delivery_days <= ${US_SHIPPING_MAX_DAYS}
        )
      ORDER BY market.is_primary DESC, market.updated_at DESC
      LIMIT 1
    ) us_market ON true
    WHERE p.status::text = 'active'
      AND EXISTS (
        SELECT 1
        FROM product_images pi
        WHERE pi.product_id = p.id
          AND NULLIF(TRIM(pi.image_url), '') IS NOT NULL
      )
    ORDER BY p.is_featured DESC, p.updated_at DESC, p.created_at DESC
  `;

  return rows as unknown as MerchantProductRow[];
}

function feedDocument(items: string[]) {
  const generatedAt = new Date().toUTCString();
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">',
    "<channel>",
    `  <title>${xml(`${SITE_NAME} US Product Feed`)}</title>`,
    `  <link>${xml(SITE_URL)}</link>`,
    `  <description>${xml(SITE_DESCRIPTION)}</description>`,
    `  <lastBuildDate>${xml(generatedAt)}</lastBuildDate>`,
    ...items,
    "</channel>",
    "</rss>",
    "",
  ].join("\n");
}

export async function GET() {
  try {
    const products = await readMerchantProducts();
    const eligibleProducts = products.filter(merchantPolicyEligible);
    const items = eligibleProducts
      .map(merchantItem)
      .filter((item): item is string => Boolean(item));

    return new Response(feedDocument(items), {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
        "X-WHOKEAS-Feed-Items": String(items.length),
        "X-WHOKEAS-Feed-Excluded": String(products.length - eligibleProducts.length),
      },
    });
  }
  catch (error) {
    console.error("Google Merchant feed generation failed:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?>\n<error>Product feed is temporarily unavailable.</error>\n',
      {
        status: 503,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }
}
