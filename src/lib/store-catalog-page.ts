import { catalogSql } from "@/lib/catalog-schema";
import { ensureGlobalMarketSchema } from "@/lib/global-markets";
import {
  US_SHIPPING_MAX_DAYS,
  US_TARGET_COUNTRY_CODE,
} from "@/lib/seo";
import {
  isRestrictedStorefrontProduct,
  type StoreProduct,
} from "@/lib/store-catalog";

function cleanSupplierCopy(value: string | null) {
  const cleaned = String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[*_`]{1,3}/g, " ")
    .replace(
      /\b(?:Highlights?|Specifications?|Details?|Product Description)\s*[:-]?\s*/gi,
      " ",
    )
    .replace(/\b(?:undefined|null)\b/gi, " ")
    .replace(/\bsupplied through CJdropshipping\b\.?/gi, " ")
    .replace(
      /\bAvailable\s+Ship\s+to\s*:\s*(?:Puerto\s+Rico\s*,\s*)?United\s+States\b[.,;:]?\s*/gi,
      " ",
    )
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || null;
}

function compactSupplierSummary(value: string | null) {
  if (!value || value.length <= 220) return value;

  const preview = value.slice(0, 220);
  const sentenceEnd = Math.max(
    preview.lastIndexOf(". "),
    preview.lastIndexOf("! "),
    preview.lastIndexOf("? "),
  );
  const cutAt = sentenceEnd >= 90 ? sentenceEnd + 1 : 217;

  return `${preview.slice(0, cutAt).trimEnd()}…`;
}

function cleanProductCopy(product: StoreProduct): StoreProduct {
  const description = cleanSupplierCopy(product.description);
  const shortDescription = compactSupplierSummary(
    cleanSupplierCopy(product.shortDescription) ||
      description ||
      "Selected for WHOKEAS customers.",
  );

  return {
    ...product,
    shortDescription,
    description,
  };
}

function storefrontCategory(product: StoreProduct) {
  const name = String(product.name || "");

  if (
    product.slug ===
      "ouhoe-peach-hair-removal-cream-gentle-non-irritant-cleaning-ladies-facial-lip-hair-quick-hair-removal-cream-198383" ||
    /\bhair\s+removal\s+cream\b/i.test(name)
  ) {
    return "Beauty";
  }

  // Correct only high-confidence electronics that were imported into Fashion.
  // This is intentionally narrow so catalogue records stay untouched and
  // ambiguous products keep their stored category until reviewed.
  if (
    /\bweb\s*cam\b/i.test(name) ||
    /\bwalkie[-\s]?talkie\b/i.test(name) ||
    /\btwo[-\s]?way\s+radio\b/i.test(name) ||
    /\brgb\s+led\s+controller\b/i.test(name) ||
    /\bled\s+controller\b/i.test(name)
  ) {
    return "Tech";
  }

  // Correct only obvious recovered catalogue items whose stored category is wrong.
  // Keep these title matches precise to avoid moving ambiguous products.
  if (
    /\bhigh\s+pressure\s+cleaning\s+gun\b/i.test(name) ||
    /\bportable\s+power\s+washer\b/i.test(name)
  ) {
    return "Home";
  }

  if (
    /\breusable\s+cable\s+organizer\b/i.test(name) ||
    /\bcable\s+organizer\s+silicone\b/i.test(name)
  ) {
    return "Accessories";
  }

  return product.categoryName || null;
}

export async function getStoreProductPage(options?: {
  query?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}) {
  await ensureGlobalMarketSchema();
  const sql = catalogSql();
  const query = (options?.query || "").trim();
  const category = (options?.category || "").trim();
  const pageSize = Math.max(12, Math.min(60, options?.pageSize || 60));
  const requestedPage = Math.max(1, Math.floor(options?.page || 1));
  const sort = options?.sort || "newest";

  const rows = await sql`
    SELECT
      p.id,
      p.name,
      p.slug,
      p.short_description AS "shortDescription",
      p.description,
      us_market.selling_price_local::text AS price,
      us_market.compare_at_price_local::text AS "compareAtPrice",
      c.name AS "categoryName",
      p.is_featured AS featured,
      us_market.estimated_delivery_days AS "deliveryDays",
      p.supplier_platform AS "supplierPlatform",
      p.created_at::text AS "createdAt",
      (
        SELECT pi.image_url
        FROM product_images pi
        WHERE pi.product_id = p.id
        ORDER BY pi.sort_order
        LIMIT 1
      ) AS image
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    JOIN LATERAL (
      SELECT
        market.selling_price_local,
        market.compare_at_price_local,
        market.estimated_delivery_days
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
      AND (
        ${query} = ''
        OR p.name ILIKE ${`%${query}%`}
        OR COALESCE(p.short_description, '') ILIKE ${`%${query}%`}
        OR COALESCE(c.name, '') ILIKE ${`%${query}%`}
      )
    ORDER BY
      CASE WHEN ${sort} = 'price-low' THEN us_market.selling_price_local END ASC,
      CASE WHEN ${sort} = 'price-high' THEN us_market.selling_price_local END DESC,
      CASE WHEN ${sort} = 'newest' THEN us_market.estimated_delivery_days END ASC NULLS LAST,
      CASE WHEN ${sort} = 'newest' THEN p.created_at END DESC,
      p.is_featured DESC,
      p.created_at DESC
  `;

  const eligibleProducts = (rows as unknown as StoreProduct[])
    .filter((product) => !isRestrictedStorefrontProduct(product))
    .map((product) => ({
      ...cleanProductCopy(product),
      categoryName: storefrontCategory(product),
    }))
    .filter(
      (product) =>
        !category ||
        String(product.categoryName || "").toLowerCase() === category.toLowerCase(),
    );
  const total = eligibleProducts.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;
  const products = eligibleProducts.slice(offset, offset + pageSize);

  return {
    products,
    total,
    page,
    pageSize,
    totalPages,
  };
}
