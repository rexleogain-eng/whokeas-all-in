import {
  DEFAULT_AUTOMATION_CONFIG,
  calculateMarketSellingPrice,
  sanitizeAutomationConfig,
  type CatalogAutomationConfig,
} from "@/lib/automation-config";
import {
  catalogSql,
  ensureCatalogSchema,
} from "@/lib/catalog-schema";
import {
  buildMarketOffers,
  persistProductMarketOffers,
  primaryMarket,
  type MarketOffer,
} from "@/lib/global-markets";
import {
  cjNumber,
  cjRequest,
  slugify,
  stripHtml,
} from "@/lib/cj";
import { saveProduct } from "@/lib/product-admin";

export class CJProductAlreadyImportedError extends Error {
  existingProductId?: string;
  existingSlug?: string;

  constructor(input: { id?: unknown; slug?: unknown }) {
    super("This CJ product is already imported.");
    this.name = "CJProductAlreadyImportedError";
    this.existingProductId = input.id ? String(input.id) : undefined;
    this.existingSlug = input.slug ? String(input.slug) : undefined;
  }
}

type CJInventory = {
  countryCode?: string;
  totalInventory?: number;
  totalInventoryNum?: number;
  storageNum?: number;
  cjInventory?: number;
  factoryInventory?: number;
};

type CJVariant = {
  vid?: string;
  variantNameEn?: string;
  variantName?: string;
  variantKey?: string;
  variantSku?: string;
  variantSellPrice?: number | string;
  inventories?: CJInventory[];
};

type CJProductDetail = {
  pid?: string;
  productNameEn?: string;
  productSku?: string;
  bigImage?: string;
  productImage?: string;
  productImageSet?: string[] | string;
  categoryName?: string;
  description?: string;
  sellPrice?: number | string;
  supplierName?: string;
  supplierId?: string;
  status?: string | number;
  productProEnSet?: string[];
  variants?: CJVariant[];
};

export type ImportCJProductInput = {
  pid: string;
  inventoryHint?: number;
  categoryName?: string;
  source?: "manual" | "autopilot";
  runId?: string;
  candidateScore?: number;
  sourceSearchTerm?: string;
  autoPublish?: boolean;
  minimumInventory?: number;
  maximumSellingPriceTzs?: number;
  automationConfig?: CatalogAutomationConfig;
  markupPercent?: number;
  usdToTzsRate?: number;
  marginPercent?: number;
  reserveTzs?: number;
};

export type ImportedCJProduct = {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "active";
  published: boolean;
  categoryName: string;
  supplierCostTzs: number;
  shippingTzs: number;
  sellingPriceTzs: number;
  estimatedProfitTzs: number;
  primaryCurrency: string;
  primaryPrice: number;
  availableMarkets: number;
  verifiedMarkets: number;
  variants: number;
  stock: number;
  freightMethod: string | null;
  freightAging: string | null;
  warning: string | null;
};

function embeddedInventory(variant: CJVariant) {
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
              inventory.totalInventoryNum ??
              inventory.storageNum ??
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

function imagesFrom(detail: CJProductDetail) {
  const imageSet = Array.isArray(detail.productImageSet)
    ? detail.productImageSet
    : typeof detail.productImageSet === "string"
      ? detail.productImageSet
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

  return [
    ...imageSet,
    detail.bigImage || "",
    detail.productImage || "",
  ]
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 8);
}

function normalizeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function marketWarning(offers: MarketOffer[]) {
  const unavailable = offers.filter((offer) => !offer.available);
  if (unavailable.length === 0) return null;
  return `${unavailable.length} market${unavailable.length === 1 ? "" : "s"} need review: ${unavailable
    .slice(0, 4)
    .map((offer) => offer.marketName)
    .join(", ")}${unavailable.length > 4 ? "…" : ""}.`;
}

function effectiveConfig(input: ImportCJProductInput) {
  const base = input.automationConfig || DEFAULT_AUTOMATION_CONFIG;
  const markupOverride = normalizeNumber(
    input.marginPercent ?? input.markupPercent,
    base.defaultMarkupPercent,
  );

  return sanitizeAutomationConfig({
    ...base,
    markets: base.markets.map((market) =>
      market.primary
        ? {
            ...market,
            markupPercent: markupOverride,
            riskReserveLocal:
              market.currency === "TZS" && input.reserveTzs !== undefined
                ? normalizeNumber(input.reserveTzs, market.riskReserveLocal)
                : market.riskReserveLocal,
          }
        : market,
    ),
  });
}

export async function importCJProduct(
  input: ImportCJProductInput,
): Promise<ImportedCJProduct> {
  await ensureCatalogSchema();
  const sql = catalogSql();
  const config = effectiveConfig(input);

  const requestedPid = String(input.pid || "").trim();
  if (!requestedPid) throw new Error("CJ product ID is missing.");

  const duplicate = await sql`
    SELECT id, slug
    FROM products
    WHERE supplier_platform = 'cj'
      AND supplier_external_product_id = ${requestedPid}
    LIMIT 1
  `;

  if (duplicate.length > 0) {
    throw new CJProductAlreadyImportedError(duplicate[0]);
  }

  const inventoryHint = Math.max(
    0,
    Math.floor(normalizeNumber(input.inventoryHint, 0)),
  );
  const categoryMarkupPercent = Math.max(
    0,
    normalizeNumber(
      input.marginPercent ?? input.markupPercent,
      config.defaultMarkupPercent,
    ),
  );

  const detail = await cjRequest<CJProductDetail>(
    `/v1/product/query?pid=${encodeURIComponent(requestedPid)}`,
  );

  const pid = String(detail.pid || requestedPid).trim();
  const name = String(detail.productNameEn || "").trim().slice(0, 180);
  if (!pid || !name) throw new Error("CJ returned incomplete product details.");

  let variants = Array.isArray(detail.variants)
    ? detail.variants.filter((variant) => variant.vid)
    : [];

  if (variants.length === 0) {
    try {
      variants = await cjRequest<CJVariant[]>(
        `/v1/product/variant/query?pid=${encodeURIComponent(pid)}`,
      );
    } catch {
      variants = [];
    }
  }

  variants = variants.filter((variant) => variant.vid).slice(0, 60);
  const rawSupplierPrices = variants
    .map((variant) => cjNumber(variant.variantSellPrice ?? detail.sellPrice))
    .filter((price) => price > 0);
  const productSupplierPriceUsd =
    rawSupplierPrices.length > 0
      ? Math.min(...rawSupplierPrices)
      : cjNumber(detail.sellPrice);

  if (productSupplierPriceUsd <= 0) {
    throw new Error("CJ returned an invalid supplier price.");
  }

  const trialVariant = variants[0];
  const trialVariantId = String(trialVariant?.vid || "");
  const originCountryCode =
    trialVariant?.inventories?.find((item) => item.countryCode)?.countryCode ||
    "CN";
  const offers = await buildMarketOffers({
    supplierCostUsd: productSupplierPriceUsd,
    trialVariantId,
    originCountryCode,
    categoryMarkupPercent,
    config,
  });
  const primaryRule = primaryMarket(config);
  const primaryOffer =
    offers.find((offer) => offer.marketKey === primaryRule.key) || offers[0];

  if (!primaryOffer) {
    throw new Error("No enabled pricing market is configured.");
  }

  const fallbackStock =
    variants.length > 0 && inventoryHint > 0
      ? Math.max(1, Math.floor(inventoryHint / variants.length))
      : inventoryHint;

  const normalizedVariants = variants.map((variant, index) => {
    const supplierPriceUsd = cjNumber(
      variant.variantSellPrice ?? detail.sellPrice,
    );
    const pricing = calculateMarketSellingPrice({
      supplierCostUsd: supplierPriceUsd,
      freightUsd: primaryOffer.freightUsd,
      fxRate: primaryOffer.fxRate,
      reserveLocal: primaryRule.riskReserveLocal,
      markupPercent: Math.max(categoryMarkupPercent, primaryRule.markupPercent),
      minimumProfitLocal: primaryRule.minimumProfitLocal,
      paymentFeePercent: primaryRule.paymentFeePercent,
      roundingIncrementLocal: primaryRule.roundingIncrementLocal,
    });
    const externalVariantId = String(variant.vid || "");
    const variantName = String(
      variant.variantNameEn ||
        variant.variantName ||
        variant.variantKey ||
        `Option ${index + 1}`,
    )
      .replace(/\|/g, "/")
      .trim()
      .slice(0, 220);
    const sku = `CJ-${pid.slice(0, 8)}-${externalVariantId.slice(-10)}`
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .toUpperCase()
      .slice(0, 170);

    return {
      externalVariantId,
      supplierPriceUsd,
      supplierCostPrimary: pricing.supplierCostLocal,
      sellingPricePrimary: pricing.sellingPriceLocal,
      name: variantName,
      sku,
      stock: embeddedInventory(variant) || fallbackStock,
    };
  });

  if (normalizedVariants.length === 0) {
    const pricing = calculateMarketSellingPrice({
      supplierCostUsd: productSupplierPriceUsd,
      freightUsd: primaryOffer.freightUsd,
      fxRate: primaryOffer.fxRate,
      reserveLocal: primaryRule.riskReserveLocal,
      markupPercent: Math.max(categoryMarkupPercent, primaryRule.markupPercent),
      minimumProfitLocal: primaryRule.minimumProfitLocal,
      paymentFeePercent: primaryRule.paymentFeePercent,
      roundingIncrementLocal: primaryRule.roundingIncrementLocal,
    });

    normalizedVariants.push({
      externalVariantId: "",
      supplierPriceUsd: productSupplierPriceUsd,
      supplierCostPrimary: pricing.supplierCostLocal,
      sellingPricePrimary: pricing.sellingPriceLocal,
      name: "Standard",
      sku: `CJ-${pid.slice(0, 16)}`.toUpperCase(),
      stock: inventoryHint,
    });
  }

  const productCostPrimary = Math.min(
    ...normalizedVariants.map((variant) => variant.supplierCostPrimary),
  );
  const productSellingPricePrimary = Math.min(
    ...normalizedVariants.map((variant) => variant.sellingPricePrimary),
  );
  const productStock = normalizedVariants.reduce(
    (sum, variant) => sum + Math.max(0, variant.stock),
    0,
  );
  const availableMarkets = offers.filter((offer) => offer.available).length;
  const verifiedMarkets = offers.filter(
    (offer) => offer.available && !offer.freightIsEstimate,
  ).length;
  const productSlug = `${slugify(name)}-${pid.slice(0, 6).toLowerCase()}`;
  const description = stripHtml(detail.description, 10000);
  const imageUrls = imagesFrom(detail);
  const categoryName =
    String(input.categoryName || "").trim().slice(0, 120) ||
    categoryLeaf(detail.categoryName);
  const minimumInventory = Math.max(0, input.minimumInventory || 0);
  const supplierActive = String(detail.status ?? "3") === "3";
  const canPublish = Boolean(
    input.autoPublish &&
      supplierActive &&
      primaryOffer.available &&
      availableMarkets >= config.minimumMarketsAvailable &&
      imageUrls.length > 0 &&
      productCostPrimary > 0 &&
      productStock >= minimumInventory &&
      productSellingPricePrimary <= primaryRule.maximumSellingPriceLocal,
  );
  const status: "active" | "draft" = canPublish ? "active" : "draft";
  const variantsText = normalizedVariants
    .map(
      (variant) =>
        `${variant.name}|${variant.sku}|${variant.sellingPricePrimary}|${variant.stock}`,
    )
    .join("\n");

  const publicationReasons = [
    !input.autoPublish ? "Automatic publishing is disabled." : "",
    !supplierActive ? "Supplier product is not currently on sale." : "",
    !primaryOffer.available
      ? `${primaryOffer.marketName} shipping or price was not verified.`
      : "",
    availableMarkets < config.minimumMarketsAvailable
      ? `Available in ${availableMarkets} markets; ${config.minimumMarketsAvailable} are required.`
      : "",
    imageUrls.length === 0 ? "No usable product image was returned." : "",
    productCostPrimary <= 0 ? "Supplier cost was invalid." : "",
    productStock < minimumInventory
      ? `Stock ${productStock} is below the ${minimumInventory} minimum.`
      : "",
    productSellingPricePrimary > primaryRule.maximumSellingPriceLocal
      ? `Primary market price exceeds ${primaryRule.currency} ${primaryRule.maximumSellingPriceLocal}.`
      : "",
  ].filter(Boolean);
  const warning =
    marketWarning(offers) ||
    (status === "draft" && input.source === "autopilot"
      ? publicationReasons.join(" ")
      : null);

  const fulfillmentNotes = [
    `CJ Product ID: ${pid}`,
    `Global pricing: ${availableMarkets}/${offers.length} enabled markets available; ${verifiedMarkets} exact freight checks.`,
    primaryOffer.freightMethod
      ? `Primary logistics: ${primaryOffer.freightMethod}`
      : "",
    primaryOffer.estimatedDeliveryDays
      ? `Primary estimated transit: ${primaryOffer.estimatedDeliveryDays} days`
      : "",
    warning,
    `Primary market: ${primaryOffer.marketName} (${primaryOffer.currency}).`,
    input.source === "autopilot"
      ? `Imported automatically${input.runId ? ` in run ${input.runId}` : ""}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const productId = await saveProduct({
    name,
    slug: productSlug,
    categoryName,
    shortDescription:
      description.slice(0, 900) ||
      `${name} supplied through CJdropshipping.`,
    description,
    status,
    price: String(productSellingPricePrimary),
    baseCost: String(productCostPrimary),
    shippingCost: String(primaryOffer.shippingLocal),
    featured: false,
    imageUrls: imageUrls.join("\n"),
    supplierName: "CJdropshipping",
    supplierContact: detail.supplierName || "",
    supplierWebsite: "https://cjdropshipping.com",
    supplierCountry: "China",
    supplierUrl: "",
    deliveryDays: primaryOffer.estimatedDeliveryDays
      ? String(primaryOffer.estimatedDeliveryDays)
      : "",
    supplierNotes: `CJ Supplier ID: ${detail.supplierId || "Not supplied"}`,
    fulfillmentNotes,
    variantsText,
  });

  await persistProductMarketOffers(productId, offers);

  await sql`
    UPDATE products
    SET
      supplier_type = 'cj',
      supplier_product_id = ${pid.slice(0, 150)},
      supplier_platform = 'cj',
      supplier_external_product_id = ${pid},
      supplier_price_usd = ${productSupplierPriceUsd},
      supplier_sync_enabled = true,
      last_supplier_sync_at = NOW(),
      supplier_sync_error = ${warning || null},
      currency = ${primaryOffer.currency},
      compare_at_price = ${primaryOffer.compareAtPriceLocal},
      supplier_raw_data = COALESCE(supplier_raw_data, '{}'::jsonb)
        || jsonb_build_object(
          'cj',
          ${JSON.stringify({
            pid,
            productSku: detail.productSku || null,
            supplierId: detail.supplierId || null,
            supplierName: detail.supplierName || null,
            originCountryCode,
            primaryMarket: primaryOffer.marketKey,
            marketAvailability: offers.map((offer) => ({
              key: offer.marketKey,
              currency: offer.currency,
              available: offer.available,
              freightIsEstimate: offer.freightIsEstimate,
              price: offer.sellingPriceLocal,
            })),
            automation:
              input.source === "autopilot"
                ? {
                    runId: input.runId || null,
                    score: input.candidateScore || null,
                    searchTerm: input.sourceSearchTerm || null,
                    category: categoryName,
                    autoPublished: canPublish,
                  }
                : null,
            importedAt: new Date().toISOString(),
          })}::jsonb
        ),
      updated_at = NOW()
    WHERE id = ${productId}
  `;

  for (const variant of normalizedVariants) {
    await sql`
      UPDATE product_variants
      SET
        supplier_variant_id = ${variant.externalVariantId.slice(0, 200) || null},
        external_variant_id = ${variant.externalVariantId || null},
        supplier_price_usd = ${variant.supplierPriceUsd},
        cost = ${variant.supplierCostPrimary},
        price = ${variant.sellingPricePrimary},
        stock_quantity = ${variant.stock}
      WHERE product_id = ${productId}
        AND sku = ${variant.sku}
    `;
  }

  const verification = await sql`
    SELECT id, name, slug, status::text AS status
    FROM products
    WHERE id = ${productId}
    LIMIT 1
  `;

  if (verification.length === 0) {
    throw new Error("The product was not retained by Neon.");
  }

  const tzOffer = offers.find((offer) => offer.currency === "TZS");

  return {
    id: productId,
    slug: productSlug,
    name,
    status,
    published: status === "active",
    categoryName,
    supplierCostTzs: tzOffer?.supplierCostLocal || productCostPrimary,
    shippingTzs: tzOffer?.shippingLocal || primaryOffer.shippingLocal,
    sellingPriceTzs: tzOffer?.sellingPriceLocal || productSellingPricePrimary,
    estimatedProfitTzs:
      tzOffer?.estimatedProfitLocal || primaryOffer.estimatedProfitLocal,
    primaryCurrency: primaryOffer.currency,
    primaryPrice: productSellingPricePrimary,
    availableMarkets,
    verifiedMarkets,
    variants: normalizedVariants.length,
    stock: productStock,
    freightMethod: primaryOffer.freightMethod,
    freightAging: primaryOffer.estimatedDeliveryDays
      ? String(primaryOffer.estimatedDeliveryDays)
      : null,
    warning: warning || null,
  };
}
