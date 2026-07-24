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
      locale,
      is_primary AS primary
    FROM product_market_prices
    WHERE available = TRUE
      AND selling_price_local > 0
    ORDER BY
      country_code,
      is_primary DESC,
      updated_at DESC
  `;

  const markets = rows.map((row) => ({
    countryCode: String(row.countryCode).toUpperCase(),
    countryName: String(row.countryName),
    currency: String(row.currency).toUpperCase(),
    locale: String(row.locale || "en-US"),
    primary: Boolean(row.primary),
  }));

  if (
    !markets.some(
      (market) => market.countryCode === "TZ",
    )
  ) {
    markets.push({
      countryCode: "TZ",
      countryName: "Tanzania",
      currency: "TZS",
      locale: "en-TZ",
      primary: true,
    });
  }

  return markets.sort((left, right) => {
    if (left.primary !== right.primary) {
      return left.primary ? -1 : 1;
    }

    return left.countryName.localeCompare(
      right.countryName,
    );
  });
}

export async function quoteCheckout(input: {
  countryCode: string;
  items: CheckoutRequestItem[];
}): Promise<CheckoutQuote> {
  await ensureCatalogSchema();
  await ensureGlobalMarketSchema();

  const selectedCountry = countryCode(input.countryCode);
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

  let quoteCurrency = "";
  let quoteLocale = "en-US";
  let quoteCountryName =
    selectedCountry === "TZ"
      ? "Tanzania"
      : selectedCountry;

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
        product.currency AS "productCurrency",

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

      LEFT JOIN product_market_prices market
        ON market.product_id = product.id
       AND market.country_code = ${selectedCountry}

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

    const hasMarket =
      row.marketCurrency &&
      row.marketPrice &&
      row.marketAvailable === true;

    if (
      selectedCountry !== "TZ" &&
      !hasMarket
    ) {
      throw new CheckoutQuoteError(
        `${String(row.productName)} is not currently available for delivery to the selected country.`,
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

    const variantRatio =
      variantId && productPrice > 0
        ? Math.min(
            5,
            Math.max(
              0.5,
              variantPrice / productPrice,
            ),
          )
        : 1;

    const marketPrice = hasMarket
      ? Number(row.marketPrice)
      : productPrice;

    const marketCost = hasMarket
      ? Number(row.marketCost || 0)
      : variantId
        ? Number(row.variantCost || 0)
        : Number(row.productCost || 0);

    const currency = String(
      hasMarket
        ? row.marketCurrency
        : row.productCurrency || "TZS",
    ).toUpperCase();

    const locale = String(
      hasMarket
        ? row.marketLocale || "en-US"
        : "en-TZ",
    );

    if (quoteCurrency && quoteCurrency !== currency) {
      throw new CheckoutQuoteError(
        "The cart contains products using incompatible market currencies.",
      );
    }

    quoteCurrency = currency;
    quoteLocale = locale;

    if (row.marketName) {
      quoteCountryName = String(row.marketName);
    }

    const unitPrice = roundMoney(
      marketPrice * variantRatio,
    );

    const unitCost = roundMoney(
      marketCost * variantRatio,
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
    countryCode: selectedCountry,
    countryName: quoteCountryName,
    currency: quoteCurrency || "TZS",
    locale: quoteLocale,
    subtotal,
    shippingFee,
    total,
    supplierCostTotal,
    items: canonicalItems,
  };
}