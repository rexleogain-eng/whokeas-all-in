export type AutomationCategoryRule = {
  key: string;
  category: string;
  enabled: boolean;
  searchTerms: string[];
  matchKeywords: string[];
  markupPercent: number;
  maxImportsPerRun: number;
};

export type AutomationMarketRule = {
  key: string;
  name: string;
  countryCode: string;
  currency: string;
  locale: string;
  enabled: boolean;
  primary: boolean;
  exactFreight: boolean;
  markupPercent: number;
  paymentFeePercent: number;
  riskReserveLocal: number;
  minimumProfitLocal: number;
  maximumSellingPriceLocal: number;
  roundingIncrementLocal: number;
};

export type CatalogAutomationConfig = {
  enabled: boolean;
  autoPublish: boolean;
  productsPerRun: number;
  categoriesPerRun: number;
  searchResultsPerCategory: number;
  maximumActivePerCategory: number;
  minimumInventory: number;
  minimumSupplierPriceUsd: number;
  maximumSupplierPriceUsd: number;
  defaultMarkupPercent: number;
  minimumMarketsAvailable: number;
  maximumExactFreightMarkets: number;
  estimatedFreightMultiplier: number;
  fxRefreshHours: number;
  blockedKeywords: string[];
  categoryRules: AutomationCategoryRule[];
  markets: AutomationMarketRule[];

  // Legacy fields remain only for backwards compatibility with saved JSON.
  // They are never used to expose Tanzania or another customer-facing market.
  maximumSellingPriceTzs: number;
  usdToTzsRate: number;
  paymentFeePercent: number;
  riskReserveTzs: number;
  minimumProfitTzs: number;
  roundingIncrementTzs: number;
};

export const COMPETITIVE_GROSS_MARGIN_PERCENT = 15;

const UNITED_STATES_MARKET: AutomationMarketRule = {
  key: "us",
  name: "United States",
  countryCode: "US",
  currency: "USD",
  locale: "en-US",
  enabled: true,
  primary: true,
  exactFreight: true,
  markupPercent: COMPETITIVE_GROSS_MARGIN_PERCENT,
  paymentFeePercent: 3.5,
  riskReserveLocal: 1,
  minimumProfitLocal: 0,
  maximumSellingPriceLocal: 140,
  roundingIncrementLocal: 1,
};

const DEFAULT_MARKETS: AutomationMarketRule[] = [UNITED_STATES_MARKET];

export const DEFAULT_AUTOMATION_CONFIG: CatalogAutomationConfig = {
  enabled: true,
  autoPublish: true,
  productsPerRun: 3,
  categoriesPerRun: 3,
  searchResultsPerCategory: 12,
  maximumActivePerCategory: 30,
  minimumInventory: 30,
  minimumSupplierPriceUsd: 1.5,
  maximumSupplierPriceUsd: 45,
  defaultMarkupPercent: COMPETITIVE_GROSS_MARGIN_PERCENT,
  minimumMarketsAvailable: 1,
  maximumExactFreightMarkets: 1,
  estimatedFreightMultiplier: 1.18,
  fxRefreshHours: 20,
  blockedKeywords: [
    "adult",
    "sex",
    "vape",
    "cigarette",
    "nicotine",
    "tobacco",
    "cbd",
    "hemp",
    "marijuana",
    "alcohol",
    "beer",
    "wine",
    "whiskey",
    "knife",
    "weapon",
    "gun",
    "ammunition",
    "prescription",
    "medicine",
    "medical drug",
    "supplement",
    "weight loss",
    "skin whitening",
    "replica",
    "counterfeit",
    "copyright character",
  ],
  markets: DEFAULT_MARKETS,
  categoryRules: [
    {
      key: "tech",
      category: "Tech",
      enabled: true,
      searchTerms: [
        "wireless earbuds",
        "power bank",
        "rechargeable mini fan",
        "bluetooth speaker",
        "phone stand",
      ],
      matchKeywords: [
        "earbud",
        "headphone",
        "bluetooth",
        "speaker",
        "power bank",
        "charger",
        "usb",
        "electronic",
        "rechargeable fan",
        "phone stand",
      ],
      markupPercent: COMPETITIVE_GROSS_MARGIN_PERCENT,
      maxImportsPerRun: 1,
    },
    {
      key: "study",
      category: "Study",
      enabled: true,
      searchTerms: [
        "study lamp",
        "desk organizer",
        "laptop stand",
        "student stationery organizer",
      ],
      matchKeywords: [
        "study",
        "desk",
        "stationery",
        "notebook",
        "laptop stand",
        "reading lamp",
        "book",
      ],
      markupPercent: COMPETITIVE_GROSS_MARGIN_PERCENT,
      maxImportsPerRun: 1,
    },
    {
      key: "home",
      category: "Home",
      enabled: true,
      searchTerms: [
        "home organizer",
        "kitchen storage",
        "rechargeable light",
        "cleaning tool",
      ],
      matchKeywords: [
        "home",
        "kitchen",
        "storage",
        "organizer",
        "cleaning",
        "household",
        "light",
      ],
      markupPercent: COMPETITIVE_GROSS_MARGIN_PERCENT,
      maxImportsPerRun: 1,
    },
    {
      key: "fashion",
      category: "Fashion",
      enabled: true,
      searchTerms: [
        "crossbody bag",
        "unisex cap",
        "wallet",
        "casual t shirt",
      ],
      matchKeywords: [
        "fashion",
        "shirt",
        "t-shirt",
        "bag",
        "wallet",
        "cap",
        "clothing",
        "apparel",
      ],
      markupPercent: COMPETITIVE_GROSS_MARGIN_PERCENT,
      maxImportsPerRun: 1,
    },
    {
      key: "beauty",
      category: "Beauty",
      enabled: true,
      searchTerms: [
        "makeup organizer",
        "hair accessory",
        "beauty tool",
        "cosmetic storage",
      ],
      matchKeywords: [
        "beauty",
        "makeup",
        "cosmetic",
        "hair",
        "mirror",
        "brush",
      ],
      markupPercent: COMPETITIVE_GROSS_MARGIN_PERCENT,
      maxImportsPerRun: 1,
    },
    {
      key: "accessories",
      category: "Accessories",
      enabled: true,
      searchTerms: [
        "phone accessories",
        "travel organizer",
        "watch strap",
        "cable organizer",
      ],
      matchKeywords: [
        "accessory",
        "accessories",
        "phone case",
        "phone stand",
        "watch strap",
        "travel organizer",
        "cable organizer",
      ],
      markupPercent: COMPETITIVE_GROSS_MARGIN_PERCENT,
      maxImportsPerRun: 1,
    },
  ],
  maximumSellingPriceTzs: 250000,
  usdToTzsRate: 2700,
  paymentFeePercent: 3.5,
  riskReserveTzs: 3000,
  minimumProfitTzs: 0,
  roundingIncrementTzs: 500,
};

function numberWithin(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function stringList(value: unknown, fallback: string[], maximum = 40) {
  if (!Array.isArray(value)) return fallback;

  return value
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, maximum);
}

function sanitizeRules(value: unknown) {
  if (!Array.isArray(value)) return DEFAULT_AUTOMATION_CONFIG.categoryRules;

  const rules = value
    .map((raw, index): AutomationCategoryRule | null => {
      if (!raw || typeof raw !== "object") return null;
      const record = raw as Record<string, unknown>;
      const category = String(record.category || "").trim().slice(0, 120);
      if (!category) return null;

      const fallback =
        DEFAULT_AUTOMATION_CONFIG.categoryRules.find(
          (item) => item.category.toLowerCase() === category.toLowerCase(),
        ) || DEFAULT_AUTOMATION_CONFIG.categoryRules[index];

      return {
        key:
          String(record.key || fallback?.key || category)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 60) || `category-${index + 1}`,
        category,
        enabled: record.enabled !== false,
        searchTerms: stringList(
          record.searchTerms,
          fallback?.searchTerms || [category],
          12,
        ),
        matchKeywords: stringList(
          record.matchKeywords,
          fallback?.matchKeywords || [category.toLowerCase()],
          30,
        ),
        // Keep saved legacy 30% settings from silently restoring expensive prices.
        markupPercent: COMPETITIVE_GROSS_MARGIN_PERCENT,
        maxImportsPerRun: Math.floor(
          numberWithin(
            record.maxImportsPerRun,
            fallback?.maxImportsPerRun || 1,
            1,
            5,
          ),
        ),
      };
    })
    .filter((item): item is AutomationCategoryRule => Boolean(item));

  return rules.length > 0
    ? rules.slice(0, 12)
    : DEFAULT_AUTOMATION_CONFIG.categoryRules;
}

function sanitizeMarkets(value: unknown): AutomationMarketRule[] {
  const savedUs = Array.isArray(value)
    ? value.find((raw) => {
        if (!raw || typeof raw !== "object") return false;
        const record = raw as Record<string, unknown>;
        return (
          String(record.key || "").toLowerCase() === "us" ||
          String(record.countryCode || "").toUpperCase() === "US"
        );
      })
    : null;

  const record =
    savedUs && typeof savedUs === "object"
      ? (savedUs as Record<string, unknown>)
      : {};

  return [
    {
      ...UNITED_STATES_MARKET,
      paymentFeePercent: numberWithin(
        record.paymentFeePercent,
        UNITED_STATES_MARKET.paymentFeePercent,
        0,
        25,
      ),
      // A smaller reserve keeps low-ticket products competitive while retaining a cushion.
      riskReserveLocal: UNITED_STATES_MARKET.riskReserveLocal,
      maximumSellingPriceLocal: numberWithin(
        record.maximumSellingPriceLocal,
        UNITED_STATES_MARKET.maximumSellingPriceLocal,
        1,
        1000000000,
      ),
      roundingIncrementLocal: numberWithin(
        record.roundingIncrementLocal,
        UNITED_STATES_MARKET.roundingIncrementLocal,
        0.01,
        1000000,
      ),
    },
  ];
}

export function sanitizeAutomationConfig(
  value: unknown,
): CatalogAutomationConfig {
  const input =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const markets = sanitizeMarkets(input.markets);
  const primaryMarket = markets[0];

  return {
    enabled: input.enabled !== false,
    autoPublish: input.autoPublish !== false,
    productsPerRun: Math.floor(
      numberWithin(input.productsPerRun, DEFAULT_AUTOMATION_CONFIG.productsPerRun, 1, 8),
    ),
    categoriesPerRun: Math.floor(
      numberWithin(input.categoriesPerRun, DEFAULT_AUTOMATION_CONFIG.categoriesPerRun, 1, 12),
    ),
    searchResultsPerCategory: Math.floor(
      numberWithin(
        input.searchResultsPerCategory,
        DEFAULT_AUTOMATION_CONFIG.searchResultsPerCategory,
        5,
        30,
      ),
    ),
    maximumActivePerCategory: Math.floor(
      numberWithin(
        input.maximumActivePerCategory,
        DEFAULT_AUTOMATION_CONFIG.maximumActivePerCategory,
        3,
        150,
      ),
    ),
    minimumInventory: Math.floor(
      numberWithin(input.minimumInventory, DEFAULT_AUTOMATION_CONFIG.minimumInventory, 0, 100000),
    ),
    minimumSupplierPriceUsd: numberWithin(
      input.minimumSupplierPriceUsd,
      DEFAULT_AUTOMATION_CONFIG.minimumSupplierPriceUsd,
      0,
      10000,
    ),
    maximumSupplierPriceUsd: numberWithin(
      input.maximumSupplierPriceUsd,
      DEFAULT_AUTOMATION_CONFIG.maximumSupplierPriceUsd,
      0.01,
      10000,
    ),
    defaultMarkupPercent: COMPETITIVE_GROSS_MARGIN_PERCENT,
    minimumMarketsAvailable: 1,
    maximumExactFreightMarkets: 1,
    estimatedFreightMultiplier: numberWithin(
      input.estimatedFreightMultiplier,
      DEFAULT_AUTOMATION_CONFIG.estimatedFreightMultiplier,
      1,
      3,
    ),
    fxRefreshHours: Math.floor(
      numberWithin(input.fxRefreshHours, DEFAULT_AUTOMATION_CONFIG.fxRefreshHours, 6, 168),
    ),
    blockedKeywords: stringList(
      input.blockedKeywords,
      DEFAULT_AUTOMATION_CONFIG.blockedKeywords,
      100,
    ),
    categoryRules: sanitizeRules(input.categoryRules),
    markets,

    maximumSellingPriceTzs: numberWithin(
      input.maximumSellingPriceTzs,
      DEFAULT_AUTOMATION_CONFIG.maximumSellingPriceTzs,
      1000,
      100000000,
    ),
    usdToTzsRate: numberWithin(
      input.usdToTzsRate,
      DEFAULT_AUTOMATION_CONFIG.usdToTzsRate,
      1,
      100000,
    ),
    paymentFeePercent: numberWithin(
      input.paymentFeePercent,
      primaryMarket.paymentFeePercent,
      0,
      25,
    ),
    riskReserveTzs: numberWithin(
      input.riskReserveTzs,
      DEFAULT_AUTOMATION_CONFIG.riskReserveTzs,
      0,
      10000000,
    ),
    minimumProfitTzs: 0,
    roundingIncrementTzs: Math.floor(
      numberWithin(
        input.roundingIncrementTzs,
        DEFAULT_AUTOMATION_CONFIG.roundingIncrementTzs,
        1,
        1000000,
      ),
    ),
  };
}

export function roundPrice(value: number, increment: number) {
  const safeIncrement = Math.max(0.01, Number(increment || 1));
  return Math.ceil(Math.max(0, value) / safeIncrement) * safeIncrement;
}

// Kept as an export for compatibility with older imports and admin diagnostics.
export const FIXED_GROSS_MARGIN_PERCENT = COMPETITIVE_GROSS_MARGIN_PERCENT;

export function calculateMarketSellingPrice(input: {
  supplierCostUsd: number;
  freightUsd: number;
  fxRate: number;
  reserveLocal: number;
  markupPercent: number;
  minimumProfitLocal: number;
  paymentFeePercent: number;
  roundingIncrementLocal: number;
}) {
  const supplierCostLocal = Math.max(0, input.supplierCostUsd * input.fxRate);
  const shippingLocal = Math.max(0, input.freightUsd * input.fxRate);
  const landedCostLocal =
    supplierCostLocal + shippingLocal + Math.max(0, input.reserveLocal);

  const requestedMargin = Number(input.markupPercent);
  const targetMarginRate = Math.min(
    0.3,
    Math.max(
      0.05,
      (Number.isFinite(requestedMargin)
        ? requestedMargin
        : FIXED_GROSS_MARGIN_PERCENT) / 100,
    ),
  );
  const feeRate = Math.min(0.25, Math.max(0, input.paymentFeePercent / 100));
  const denominator = Math.max(0.05, 1 - targetMarginRate - feeRate);
  const beforeRounding = landedCostLocal / denominator;
  const sellingPriceLocal = roundPrice(
    beforeRounding,
    input.roundingIncrementLocal,
  );
  const paymentFeeLocal = sellingPriceLocal * feeRate;
  const estimatedProfitLocal = Math.max(
    0,
    sellingPriceLocal - landedCostLocal - paymentFeeLocal,
  );

  return {
    supplierCostLocal,
    shippingLocal,
    landedCostLocal,
    sellingPriceLocal,
    paymentFeeLocal,
    estimatedProfitLocal,
    grossMarginPercent:
      sellingPriceLocal > 0
        ? (estimatedProfitLocal / sellingPriceLocal) * 100
        : 0,
  };
}

export function calculateAutomatedSellingPrice(input: {
  supplierCostTzs: number;
  shippingTzs: number;
  reserveTzs: number;
  markupPercent: number;
  minimumProfitTzs: number;
  paymentFeePercent: number;
  roundingIncrementTzs: number;
}) {
  const result = calculateMarketSellingPrice({
    supplierCostUsd: input.supplierCostTzs,
    freightUsd: input.shippingTzs,
    fxRate: 1,
    reserveLocal: input.reserveTzs,
    markupPercent: input.markupPercent,
    minimumProfitLocal: input.minimumProfitTzs,
    paymentFeePercent: input.paymentFeePercent,
    roundingIncrementLocal: input.roundingIncrementTzs,
  });

  return {
    landedCostTzs: result.landedCostLocal,
    targetProfitTzs: result.estimatedProfitLocal,
    sellingPriceTzs: result.sellingPriceLocal,
  };
}

export function blockedProductReason(
  text: string,
  config: CatalogAutomationConfig,
) {
  const haystack = text.toLowerCase();
  const match = config.blockedKeywords.find((keyword) =>
    haystack.includes(keyword.toLowerCase()),
  );
  return match ? `Blocked keyword: ${match}` : null;
}

export function classifyAutomationProduct(
  name: string,
  sourceCategory: string,
  fallbackRule: AutomationCategoryRule,
  config: CatalogAutomationConfig,
) {
  const haystack = `${name} ${sourceCategory}`.toLowerCase();

  const ranked = config.categoryRules
    .filter((rule) => rule.enabled)
    .map((rule) => ({
      rule,
      matches: rule.matchKeywords.reduce(
        (count, keyword) => count + (haystack.includes(keyword) ? 1 : 0),
        0,
      ),
    }))
    .sort((left, right) => right.matches - left.matches);

  return ranked[0]?.matches > 0 ? ranked[0].rule : fallbackRule;
}
