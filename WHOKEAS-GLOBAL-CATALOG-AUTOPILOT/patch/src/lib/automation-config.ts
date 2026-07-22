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

  // Legacy Tanzania settings are retained so existing installations and
  // previously-saved JSON remain compatible with the original engine.
  maximumSellingPriceTzs: number;
  usdToTzsRate: number;
  paymentFeePercent: number;
  riskReserveTzs: number;
  minimumProfitTzs: number;
  roundingIncrementTzs: number;
};

const DEFAULT_MARKETS: AutomationMarketRule[] = [
  {
    key: "tz",
    name: "Tanzania",
    countryCode: "TZ",
    currency: "TZS",
    locale: "en-TZ",
    enabled: true,
    primary: true,
    exactFreight: true,
    markupPercent: 35,
    paymentFeePercent: 3,
    riskReserveLocal: 3000,
    minimumProfitLocal: 10000,
    maximumSellingPriceLocal: 250000,
    roundingIncrementLocal: 500,
  },
  {
    key: "us",
    name: "United States",
    countryCode: "US",
    currency: "USD",
    locale: "en-US",
    enabled: true,
    primary: false,
    exactFreight: true,
    markupPercent: 32,
    paymentFeePercent: 3.5,
    riskReserveLocal: 2,
    minimumProfitLocal: 8,
    maximumSellingPriceLocal: 140,
    roundingIncrementLocal: 1,
  },
  {
    key: "uk",
    name: "United Kingdom",
    countryCode: "GB",
    currency: "GBP",
    locale: "en-GB",
    enabled: true,
    primary: false,
    exactFreight: true,
    markupPercent: 34,
    paymentFeePercent: 3.5,
    riskReserveLocal: 2,
    minimumProfitLocal: 7,
    maximumSellingPriceLocal: 120,
    roundingIncrementLocal: 1,
  },
  {
    key: "eu",
    name: "European Union",
    countryCode: "DE",
    currency: "EUR",
    locale: "en-DE",
    enabled: true,
    primary: false,
    exactFreight: true,
    markupPercent: 34,
    paymentFeePercent: 3.5,
    riskReserveLocal: 2,
    minimumProfitLocal: 8,
    maximumSellingPriceLocal: 130,
    roundingIncrementLocal: 1,
  },
  {
    key: "ca",
    name: "Canada",
    countryCode: "CA",
    currency: "CAD",
    locale: "en-CA",
    enabled: true,
    primary: false,
    exactFreight: false,
    markupPercent: 35,
    paymentFeePercent: 3.5,
    riskReserveLocal: 3,
    minimumProfitLocal: 10,
    maximumSellingPriceLocal: 180,
    roundingIncrementLocal: 1,
  },
  {
    key: "au",
    name: "Australia",
    countryCode: "AU",
    currency: "AUD",
    locale: "en-AU",
    enabled: true,
    primary: false,
    exactFreight: false,
    markupPercent: 36,
    paymentFeePercent: 3.5,
    riskReserveLocal: 3,
    minimumProfitLocal: 11,
    maximumSellingPriceLocal: 200,
    roundingIncrementLocal: 1,
  },
  {
    key: "ae",
    name: "United Arab Emirates",
    countryCode: "AE",
    currency: "AED",
    locale: "en-AE",
    enabled: true,
    primary: false,
    exactFreight: false,
    markupPercent: 36,
    paymentFeePercent: 3.5,
    riskReserveLocal: 8,
    minimumProfitLocal: 30,
    maximumSellingPriceLocal: 550,
    roundingIncrementLocal: 5,
  },
  {
    key: "ke",
    name: "Kenya",
    countryCode: "KE",
    currency: "KES",
    locale: "en-KE",
    enabled: true,
    primary: false,
    exactFreight: false,
    markupPercent: 38,
    paymentFeePercent: 3.5,
    riskReserveLocal: 250,
    minimumProfitLocal: 900,
    maximumSellingPriceLocal: 22000,
    roundingIncrementLocal: 50,
  },
  {
    key: "za",
    name: "South Africa",
    countryCode: "ZA",
    currency: "ZAR",
    locale: "en-ZA",
    enabled: true,
    primary: false,
    exactFreight: false,
    markupPercent: 38,
    paymentFeePercent: 3.5,
    riskReserveLocal: 35,
    minimumProfitLocal: 130,
    maximumSellingPriceLocal: 2500,
    roundingIncrementLocal: 10,
  },
];

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
  defaultMarkupPercent: 35,
  minimumMarketsAvailable: 3,
  maximumExactFreightMarkets: 4,
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
      markupPercent: 32,
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
      markupPercent: 34,
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
      markupPercent: 38,
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
      markupPercent: 45,
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
      markupPercent: 48,
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
      markupPercent: 40,
      maxImportsPerRun: 1,
    },
  ],
  maximumSellingPriceTzs: 250000,
  usdToTzsRate: 2700,
  paymentFeePercent: 3,
  riskReserveTzs: 3000,
  minimumProfitTzs: 10000,
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
        markupPercent: numberWithin(
          record.markupPercent,
          fallback?.markupPercent || 35,
          0,
          150,
        ),
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

function sanitizeMarkets(value: unknown) {
  if (!Array.isArray(value)) return DEFAULT_MARKETS;

  const markets = value
    .map((raw, index): AutomationMarketRule | null => {
      if (!raw || typeof raw !== "object") return null;
      const record = raw as Record<string, unknown>;
      const fallback =
        DEFAULT_MARKETS.find(
          (item) => item.key === String(record.key || "").toLowerCase(),
        ) || DEFAULT_MARKETS[index];
      const key = String(record.key || fallback?.key || `market-${index + 1}`)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .slice(0, 40);
      const name = String(record.name || fallback?.name || key)
        .trim()
        .slice(0, 120);
      const countryCode = String(
        record.countryCode || fallback?.countryCode || "US",
      )
        .trim()
        .toUpperCase()
        .slice(0, 2);
      const currency = String(record.currency || fallback?.currency || "USD")
        .trim()
        .toUpperCase()
        .slice(0, 3);

      if (!key || !name || countryCode.length !== 2 || currency.length !== 3) {
        return null;
      }

      return {
        key,
        name,
        countryCode,
        currency,
        locale: String(record.locale || fallback?.locale || "en-US")
          .trim()
          .slice(0, 20),
        enabled: record.enabled !== false,
        primary: record.primary === true,
        exactFreight: record.exactFreight === true,
        markupPercent: numberWithin(
          record.markupPercent,
          fallback?.markupPercent || 35,
          0,
          150,
        ),
        paymentFeePercent: numberWithin(
          record.paymentFeePercent,
          fallback?.paymentFeePercent || 3.5,
          0,
          25,
        ),
        riskReserveLocal: numberWithin(
          record.riskReserveLocal,
          fallback?.riskReserveLocal || 0,
          0,
          100000000,
        ),
        minimumProfitLocal: numberWithin(
          record.minimumProfitLocal,
          fallback?.minimumProfitLocal || 0,
          0,
          100000000,
        ),
        maximumSellingPriceLocal: numberWithin(
          record.maximumSellingPriceLocal,
          fallback?.maximumSellingPriceLocal || 100000000,
          1,
          1000000000,
        ),
        roundingIncrementLocal: numberWithin(
          record.roundingIncrementLocal,
          fallback?.roundingIncrementLocal || 1,
          0.01,
          1000000,
        ),
      };
    })
    .filter((item): item is AutomationMarketRule => Boolean(item));

  const unique = markets.filter(
    (market, index, list) =>
      list.findIndex((candidate) => candidate.key === market.key) === index,
  );
  const enabled = unique.filter((market) => market.enabled);

  if (enabled.length === 0) return DEFAULT_MARKETS;

  let primaryAssigned = false;
  return unique.slice(0, 20).map((market) => {
    const primary = market.enabled && market.primary && !primaryAssigned;
    if (primary) primaryAssigned = true;
    return { ...market, primary };
  }).map((market, index, list) => {
    if (list.some((item) => item.primary)) return market;
    const firstEnabled = list.findIndex((item) => item.enabled);
    return index === firstEnabled ? { ...market, primary: true } : market;
  });
}

export function sanitizeAutomationConfig(
  value: unknown,
): CatalogAutomationConfig {
  const input =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const markets = sanitizeMarkets(input.markets);
  const primaryMarket = markets.find((market) => market.primary && market.enabled) || markets[0];

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
    defaultMarkupPercent: numberWithin(
      input.defaultMarkupPercent,
      DEFAULT_AUTOMATION_CONFIG.defaultMarkupPercent,
      0,
      150,
    ),
    minimumMarketsAvailable: Math.floor(
      numberWithin(
        input.minimumMarketsAvailable,
        DEFAULT_AUTOMATION_CONFIG.minimumMarketsAvailable,
        1,
        Math.max(1, markets.filter((market) => market.enabled).length),
      ),
    ),
    maximumExactFreightMarkets: Math.floor(
      numberWithin(
        input.maximumExactFreightMarkets,
        DEFAULT_AUTOMATION_CONFIG.maximumExactFreightMarkets,
        1,
        10,
      ),
    ),
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
      primaryMarket?.currency === "TZS"
        ? primaryMarket.maximumSellingPriceLocal
        : DEFAULT_AUTOMATION_CONFIG.maximumSellingPriceTzs,
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
      primaryMarket?.paymentFeePercent || DEFAULT_AUTOMATION_CONFIG.paymentFeePercent,
      0,
      25,
    ),
    riskReserveTzs: numberWithin(
      input.riskReserveTzs,
      primaryMarket?.currency === "TZS"
        ? primaryMarket.riskReserveLocal
        : DEFAULT_AUTOMATION_CONFIG.riskReserveTzs,
      0,
      10000000,
    ),
    minimumProfitTzs: numberWithin(
      input.minimumProfitTzs,
      primaryMarket?.currency === "TZS"
        ? primaryMarket.minimumProfitLocal
        : DEFAULT_AUTOMATION_CONFIG.minimumProfitTzs,
      0,
      10000000,
    ),
    roundingIncrementTzs: Math.floor(
      numberWithin(
        input.roundingIncrementTzs,
        primaryMarket?.currency === "TZS"
          ? primaryMarket.roundingIncrementLocal
          : DEFAULT_AUTOMATION_CONFIG.roundingIncrementTzs,
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
  const landedCostLocal = supplierCostLocal + shippingLocal + Math.max(0, input.reserveLocal);
  const targetProfitLocal = Math.max(
    Math.max(0, input.minimumProfitLocal),
    landedCostLocal * (Math.max(0, input.markupPercent) / 100),
  );
  const feeRate = Math.min(0.25, Math.max(0, input.paymentFeePercent / 100));
  const beforeRounding =
    feeRate < 1
      ? (landedCostLocal + targetProfitLocal) / (1 - feeRate)
      : landedCostLocal + targetProfitLocal;
  const sellingPriceLocal = roundPrice(
    beforeRounding,
    input.roundingIncrementLocal,
  );

  return {
    supplierCostLocal,
    shippingLocal,
    landedCostLocal,
    sellingPriceLocal,
    estimatedProfitLocal: Math.max(
      0,
      sellingPriceLocal - landedCostLocal - sellingPriceLocal * feeRate,
    ),
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
