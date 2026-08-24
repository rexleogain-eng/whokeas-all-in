import {
  catalogSql,
  ensureCatalogSchema,
} from "@/lib/catalog-schema";

import {
  ensureGlobalMarketSchema,
} from "@/lib/global-markets";

export type CheckoutRequestItem = {
  productId?: string;
  variantId?: string | null;
  quantity?: number;
};

export type CheckoutMarket = {
  countryCode: string;
  countryName: string;
  currency: string;
  locale: string;
  primary: boolean;
};

export type CheckoutQuotedItem = {
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
};

export type CheckoutQuote = {
  countryCode: string;
  countryName: string;
  currency: string;
  locale: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  supplierCostTotal: number;
  items: CheckoutQuotedItem[];
};

export class CheckoutQuoteError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CheckoutQuoteError";
    this.status = status;
  }
}

const STOREFRONT_COUNTRY = "US";
const STOREFRONT_CURRENCY = "USD";
const STOREFRONT_LOCALE = "en-US";
const STOREFRONT_COUNTRY_NAME = "United States";

function clean(value: unknown, maximum = 300) {
  return typeof value === "string"
    ? value.trim().slice(0, maximum)
    : "";
}

function countryCode(value: unknown) {
  const code = clean(value, 2).toUpperCase();

  if (!/^[A-Z]{2}$/.test(code)) {
    throw new CheckoutQuoteError(
      "Choose a valid delivery country.",
    );
  }

  return code;
}

function roundMoney(value: number) {
  return Math.round(
    (Number(value) + Number.EPSILON) * 100,
  ) / 100;
}

export async function getCheckoutMarkets():
  Promise<CheckoutMarket[]> {
  await ensureCatalogSchema();
  await ensureGlobalMarketSchema();

  const sql = catalogSql();

  const rows = await sql`
    SELECT DISTINCT ON (country_code)
      country_code AS "countryCode",
      market_name AS "countryName",
      currency,
      locale
    FROM product_market_prices
    WHERE available = TRUE
      AND selling_price_local > 0
      AND country_code = ${STOREFRONT_COUNTRY}
      AND UPPER(currency) = ${STOREFRONT_CURRENCY}
    ORDER BY
      country_code,
      updated_at DESC
  `;

  if (!rows[0]) {
    return [];
  }

  return [
    {
      countryCode: STOREFRONT_COUNTRY,
      countryName:
        String(rows[0].countryName || STOREFRONT_COUNTRY_NAME),
      currency: STOREFRONT_CURRENCY,
      locale: String(rows[0].locale || STOREFRONT_LOCALE),
      primary: true,
    },
  ];
}

export async function quoteCheckout(input: {
  countryCode: string;
  items: CheckoutRequestItem[];
}): Promise<CheckoutQuote> {
  await ensureCatalogSchema();
  await ensureGlobalMarketSchema();

  const selectedCountry = countryCode(input.countryCode);

  if (selectedCountry !== STOREFRONT_COUNTRY) {
    throw new CheckoutQuoteError(
      "WHOKEAS currently ships this storefront to United States addresses only.",
      400,
    );
  }

  const requestedItems = Array.isArray(input.items)
    ? input.items
    : [];

  if (
    requestedItems.length < 1 ||
    requestedItems.length > 30
  ) {
    throw new CheckoutQuoteError(
      "The cart is empty or too large.",
    );
  }

  const sql = catalogSql();
  const canonicalItems: CheckoutQuotedItem[] = [];

  let quoteCountryName = STOREFRONT_COUNTRY_NAME;

  for (const requested of requestedItems) {
    const productId = clean(
      requested.productId,
      50,
    );

    const variantId =
      clean(requested.variantId, 50) || null;

    const quantity = Math.floor(
      Number(requested.quantity),
    );

    if (
      !productId ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 5
    ) {
      throw new CheckoutQuoteError(
        "One cart item is invalid.",
      );
    }

    const rows = await sql`
      SELECT
        product.id::text AS "productId",
        product.name AS "productName",
        product.status::text AS "productStatus",
        product.price::text AS "productPrice",
        COALESCE(
          product.base_cost,
          0
        )::text AS "productCost",

        variant.id::text AS "variantId",
        variant.name AS "variantName",
        variant.sku,
        variant.price::text AS "variantPrice",
        COALESCE(
          variant.cost,
          0
        )::text AS "variantCost",
        variant.stock_quantity AS "stockQuantity",
        variant.is_active AS "variantActive",

        variant_anchor.price::text AS "variantAnchorPrice",

        market.market_name AS "marketName",
        market.currency AS "marketCurrency",
        market.locale AS "marketLocale",
        market.selling_price_local::text AS "marketPrice",
        market.landed_cost_local::text AS "marketCost",
        market.available AS "marketAvailable"

      FROM products product

      LEFT JOIN product_variants variant
        ON variant.product_id = product.id
       AND variant.id::text = ${variantId}

      LEFT JOIN LATERAL (
        SELECT anchor_variant.price
        FROM product_variants anchor_variant
        WHERE anchor_variant.product_id = product.id
          AND anchor_variant.is_active = TRUE
          AND anchor_variant.price > 0
        ORDER BY
          CASE
            WHEN anchor_variant.stock_quantity > 0 THEN 0
            ELSE 1
          END,
          anchor_variant.price ASC
        LIMIT 1
      ) variant_anchor ON TRUE

      LEFT JOIN product_market_prices market
        ON market.product_id = product.id
       AND market.country_code = ${STOREFRONT_COUNTRY}
       AND UPPER(market.currency) = ${STOREFRONT_CURRENCY}

      WHERE product.id::text = ${productId}
      LIMIT 1
    `;

    const row = rows[0];

    if (
      !row ||
      String(row.productStatus) !== "active"
    ) {
      throw new CheckoutQuoteError(
        "A cart product is unavailable.",
        409,
      );
    }

    if (variantId) {
      if (
        !row.variantId ||
        row.variantActive !== true ||
        Number(row.stockQuantity || 0) < quantity
      ) {
        throw new CheckoutQuoteError(
          "A selected product option is unavailable or has insufficient stock.",
          409,
        );
      }
    }

    const hasMarket = Boolean(
      row.marketCurrency &&
      row.marketPrice &&
      row.marketAvailable === true &&
      String(row.marketCurrency).toUpperCase() === STOREFRONT_CURRENCY,
    );

    if (!hasMarket) {
      throw new CheckoutQuoteError(
        `${String(row.productName)} is not currently available for delivery to the United States.`,
        409,
      );
    }

    const productPrice = Math.max(
      0,
      Number(row.productPrice || 0),
    );

    const variantPrice = variantId
      ? Math.max(
          0,
          Number(row.variantPrice || productPrice),
        )
      : productPrice;

    const variantAnchorPrice = Math.max(
      0,
      Number(row.variantAnchorPrice || productPrice),
    );

    const variantRatio =
      variantId && variantAnchorPrice > 0
        ? Math.min(
            5,
            Math.max(
              0.5,
              variantPrice / variantAnchorPrice,
            ),
          )
        : 1;

    const marketPrice = Number(row.marketPrice);
    const marketCost = Number(row.marketCost || 0);

    if (
      !Number.isFinite(marketPrice) ||
      marketPrice <= 0
    ) {
      throw new CheckoutQuoteError(
        `${String(row.productName)} does not have a valid United States price.`,
        409,
      );
    }

    if (row.marketName) {
      quoteCountryName = String(row.marketName);
    }

    const unitPrice = roundMoney(
      marketPrice * variantRatio,
    );

    const unitCost = roundMoney(
      Math.max(0, marketCost) * variantRatio,
    );

    canonicalItems.push({
      productId: String(row.productId),
      variantId: variantId
        ? String(row.variantId)
        : null,
      productName: String(row.productName),
      variantName: variantId
        ? String(row.variantName)
        : null,
      sku: row.sku ? String(row.sku) : null,
      quantity,
      unitPrice,
      unitCost,
      lineTotal: roundMoney(
        unitPrice * quantity,
      ),
    });
  }

  const subtotal = roundMoney(
    canonicalItems.reduce(
      (total, item) => total + item.lineTotal,
      0,
    ),
  );

  const supplierCostTotal = roundMoney(
    canonicalItems.reduce(
      (total, item) =>
        total + item.unitCost * item.quantity,
      0,
    ),
  );

  /*
   * Product market prices already contain the estimated
   * one-unit international freight used by the fixed-margin
   * catalogue engine. Therefore an additional shipping charge
   * is not added here.
   */
  const shippingFee = 0;
  const total = roundMoney(
    subtotal + shippingFee,
  );

  return {
    countryCode: STOREFRONT_COUNTRY,
    countryName: quoteCountryName || STOREFRONT_COUNTRY_NAME,
    currency: STOREFRONT_CURRENCY,
    locale: STOREFRONT_LOCALE,
    subtotal,
    shippingFee,
    total,
    supplierCostTotal,
    items: canonicalItems,
  };
}
