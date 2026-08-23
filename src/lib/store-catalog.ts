import {
  catalogSql,
} from "@/lib/catalog-schema";
import { ensureGlobalMarketSchema } from "@/lib/global-markets";
import {
  US_SHIPPING_MAX_DAYS,
  US_TARGET_COUNTRY_CODE,
} from "@/lib/seo";
import {
  roundStoreUsd,
  sourcePriceToStoreUsd,
} from "@/lib/store-currency";

export type StoreProduct = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  price: string;
  compareAtPrice: string | null;
  categoryName: string | null;
  image: string | null;
  featured: boolean;
  deliveryDays: number | null;
  supplierPlatform: string | null;
  createdAt: string;
};

type StoreProductDetailRow = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  basePrice: string;
  baseCompareAtPrice: string | null;
  baseCurrency: string;
  brand: string | null;
  baseDeliveryDays: number | null;
  shippingCost: string;
  supplierPlatform: string | null;
  categoryName: string | null;
  usPrice: string | null;
  usCompareAtPrice: string | null;
  usDeliveryDays: number | null;
  usAvailable: boolean;
};

type StoreVariantRow = {
  id: string;
  name: string;
  price: string;
  stockQuantity: number;
};

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

function cleanProductCopy<
  T extends {
    shortDescription: string | null;
    description: string | null;
  },
>(product: T): T {
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

export async function getStoreProducts(options?: {
  query?: string;
  category?: string;
  featured?: boolean;
  limit?: number;
  sort?: string;
}) {
  await ensureGlobalMarketSchema();
  const sql = catalogSql();
  const query = (options?.query || "").trim();
  const category = (options?.category || "").trim();
  const featuredOnly = Boolean(options?.featured);
  const limit = Math.max(1, Math.min(100, options?.limit || 24));
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
      AND (
        ${category} = ''
        OR LOWER(COALESCE(c.name, '')) = LOWER(${category})
      )
      AND (${featuredOnly} = false OR p.is_featured = true)
    ORDER BY
      CASE WHEN ${sort} = 'price-low' THEN us_market.selling_price_local END ASC,
      CASE WHEN ${sort} = 'price-high' THEN us_market.selling_price_local END DESC,
      CASE WHEN ${sort} = 'newest' THEN p.created_at END DESC,
      p.is_featured DESC,
      p.created_at DESC
    LIMIT ${limit}
  `;

  return (rows as unknown as StoreProduct[]).map(cleanProductCopy);
}

export async function getStoreCategories() {
  await ensureGlobalMarketSchema();
  const sql = catalogSql();

  const rows = await sql`
    SELECT
      c.name,
      c.slug,
      COUNT(p.id)::int AS count
    FROM categories c
    JOIN products p ON p.category_id = c.id
    WHERE c.is_active = true
      AND p.status::text = 'active'
      AND EXISTS (
        SELECT 1
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
      )
    GROUP BY c.id, c.name, c.slug
    ORDER BY COUNT(p.id) DESC, c.name ASC
  `;

  return rows as unknown as Array<{
    name: string;
    slug: string;
    count: number;
  }>;
}

export async function getStoreProductBySlug(slug: string) {
  await ensureGlobalMarketSchema();
  const sql = catalogSql();

  const rows = await sql`
    SELECT
      p.id,
      p.name,
      p.slug,
      p.short_description AS "shortDescription",
      p.description,
      p.price::text AS "basePrice",
      p.compare_at_price::text AS "baseCompareAtPrice",
      p.currency AS "baseCurrency",
      p.brand,
      p.estimated_delivery_days AS "baseDeliveryDays",
      p.estimated_shipping_cost::text AS "shippingCost",
      p.supplier_platform AS "supplierPlatform",
      c.name AS "categoryName",
      us_market.selling_price_local::text AS "usPrice",
      us_market.compare_at_price_local::text AS "usCompareAtPrice",
      us_market.estimated_delivery_days AS "usDeliveryDays",
      (us_market.selling_price_local IS NOT NULL) AS "usAvailable"
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN LATERAL (
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
    WHERE LOWER(TRIM(p.slug)) = LOWER(TRIM(${slug}))
      AND p.status::text = 'active'
    LIMIT 1
  `;

  const product = rows[0] as unknown as
    | StoreProductDetailRow
    | undefined;
  if (!product) return null;

  const cleanedProduct = cleanProductCopy(product);
  const usAvailable = Boolean(product.usAvailable);
  const baseCurrency = String(product.baseCurrency || "TZS");
  const basePrice = Number(product.basePrice || 0);
  const priceUsd = usAvailable
    ? roundStoreUsd(product.usPrice || 0)
    : sourcePriceToStoreUsd(basePrice, baseCurrency);
  const compareAtPriceUsd = usAvailable
    ? roundStoreUsd(product.usCompareAtPrice || 0)
    : sourcePriceToStoreUsd(
        product.baseCompareAtPrice || 0,
        baseCurrency,
      );

  const images = await sql`
    SELECT image_url AS source
    FROM product_images
    WHERE product_id = ${product.id}
    ORDER BY sort_order
    LIMIT 8
  `;

  const rawVariants = await sql`
    SELECT
      id,
      name,
      price::text AS price,
      stock_quantity AS "stockQuantity"
    FROM product_variants
    WHERE product_id = ${product.id}
      AND is_active = true
    ORDER BY name
  `;

  const storeVariants = rawVariants as unknown as StoreVariantRow[];
  const inStockVariantPrices = storeVariants
    .filter((variant) => Number(variant.stockQuantity || 0) > 0)
    .map((variant) => Number(variant.price || 0))
    .filter((price) => Number.isFinite(price) && price > 0);
  const activeVariantPrices = storeVariants
    .map((variant) => Number(variant.price || 0))
    .filter((price) => Number.isFinite(price) && price > 0);
  const anchorCandidates = inStockVariantPrices.length > 0
    ? inStockVariantPrices
    : activeVariantPrices;
  const variantPriceAnchor = anchorCandidates.length > 0
    ? Math.min(...anchorCandidates)
    : basePrice;

  const variants = storeVariants.map((variant) => {
    const rawVariantPrice = Number(variant.price || 0);
    const price = usAvailable && variantPriceAnchor > 0
      ? roundStoreUsd(
          priceUsd * Math.min(
            5,
            Math.max(0.5, rawVariantPrice / variantPriceAnchor),
          ),
        )
      : sourcePriceToStoreUsd(rawVariantPrice, baseCurrency);

    return {
      ...variant,
      price: String(price),
    };
  });

  return {
    product: {
      ...cleanedProduct,
      price: String(priceUsd),
      compareAtPrice:
        compareAtPriceUsd > priceUsd
          ? String(compareAtPriceUsd)
          : null,
      deliveryDays: usAvailable
        ? product.usDeliveryDays
        : product.baseDeliveryDays,
      usAvailable,
    },
    images,
    variants,
  };
}
