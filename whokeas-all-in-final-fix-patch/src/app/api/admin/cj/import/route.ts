import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import {
  catalogSql,
  ensureCatalogSchema,
} from "@/lib/catalog-schema";
import {
  calculateSellingPrice,
  cjNumber,
  cjRequest,
  pricingDefaults,
  roundUp,
  slugify,
  stripHtml,
} from "@/lib/cj";
import { saveProduct } from "@/lib/product-admin";

export const dynamic = "force-dynamic";

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

type CJFreightOption = {
  logisticAging?: string;
  logisticPrice?: number | string;
  totalPostageFee?: number | string;
  logisticName?: string;
};

type ImportInput = {
  pid?: string;
  usdToTzsRate?: number;
  marginPercent?: number;
  reserveTzs?: number;
  inventoryHint?: number;
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

function finalDeliveryDays(value: string) {
  const matches = value.match(/\d+/g);
  if (!matches?.length) return null;
  return Math.max(1, Number(matches.at(-1)) || 21);
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  let stage = "initialization";

  try {
    stage = "catalogue schema repair";
    await ensureCatalogSchema();

    stage = "request validation";
    const body = (await request.json()) as ImportInput;
    const requestedPid = String(body.pid || "").trim();

    if (!requestedPid) {
      return NextResponse.json(
        { ok: false, error: "CJ product ID is missing." },
        { status: 400 },
      );
    }

    const sql = catalogSql();

    stage = "duplicate check";
    const duplicate = await sql`
      SELECT id, slug
      FROM products
      WHERE supplier_platform = 'cj'
        AND supplier_external_product_id = ${requestedPid}
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
    const inventoryHint = Math.max(0, Math.floor(cjNumber(body.inventoryHint)));

    stage = "CJ product details";
    const detail = await cjRequest<CJProductDetail>(
      `/v1/product/query?pid=${encodeURIComponent(requestedPid)}`,
    );

    const pid = String(detail.pid || requestedPid).trim();
    const name = String(detail.productNameEn || "").trim().slice(0, 180);

    if (!pid || !name) {
      throw new Error("CJ returned incomplete product details.");
    }

    stage = "CJ variants";
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

    stage = "Tanzania freight estimate";
    let freightUsd = 0;
    let freightName = "";
    let freightAging = "";
    let freightWarning = "";

    const trialVariant = variants[0];

    if (trialVariant?.vid) {
      const origin =
        trialVariant.inventories?.find((item) => item.countryCode)
          ?.countryCode || "CN";

      try {
        const freight = await cjRequest<CJFreightOption[]>(
          "/v1/logistic/freightCalculate",
          {
            method: "POST",
            body: JSON.stringify({
              startCountryCode: origin,
              endCountryCode: "TZ",
              products: [{ quantity: 1, vid: trialVariant.vid }],
            }),
          },
        );

        const available = (Array.isArray(freight) ? freight : [])
          .map((option) => ({
            ...option,
            amount: cjNumber(
              option.totalPostageFee ?? option.logisticPrice,
            ),
          }))
          .filter((option) => option.amount > 0)
          .sort((left, right) => left.amount - right.amount);

        if (available[0]) {
          freightUsd = available[0].amount;
          freightName = available[0].logisticName || "";
          freightAging = available[0].logisticAging || "";
        } else {
          freightWarning =
            "CJ returned no shipping option to Tanzania. Set shipping manually before activation.";
        }
      } catch (error) {
        freightWarning = `Freight could not be calculated automatically: ${
          error instanceof Error ? error.message : "unknown CJ error"
        }. Set shipping manually before activation.`;
      }
    } else {
      freightWarning =
        "CJ returned no variant for freight calculation. Set shipping manually before activation.";
    }

    const shippingTzs = Math.ceil(freightUsd * usdToTzsRate);
    const fallbackStock =
      variants.length > 0 && inventoryHint > 0
        ? Math.max(1, Math.floor(inventoryHint / variants.length))
        : inventoryHint;

    stage = "price and variant normalization";
    const normalizedVariants = variants.map((variant, index) => {
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
        supplierCostTzs,
        sellingPrice,
        name: variantName,
        sku,
        stock: embeddedInventory(variant) || fallbackStock,
      };
    });

    if (normalizedVariants.length === 0) {
      const supplierPriceUsd = cjNumber(detail.sellPrice);
      const supplierCostTzs = Math.ceil(
        supplierPriceUsd * usdToTzsRate,
      );

      normalizedVariants.push({
        externalVariantId: "",
        supplierPriceUsd,
        supplierCostTzs,
        sellingPrice: calculateSellingPrice(
          supplierCostTzs,
          shippingTzs,
          reserveTzs,
          marginPercent,
        ),
        name: "Standard",
        sku: `CJ-${pid.slice(0, 16)}`.toUpperCase(),
        stock: inventoryHint,
      });
    }

    const productSupplierPriceUsd = Math.min(
      ...normalizedVariants.map((variant) => variant.supplierPriceUsd),
    );
    const productCostTzs = Math.min(
      ...normalizedVariants.map((variant) => variant.supplierCostTzs),
    );
    const productSellingPrice = roundUp(
      Math.min(
        ...normalizedVariants.map((variant) => variant.sellingPrice),
      ),
    );
    const productSlug = `${slugify(name)}-${pid.slice(0, 6).toLowerCase()}`;
    const description = stripHtml(detail.description, 10000);
    const imageUrls = imagesFrom(detail);
    const variantsText = normalizedVariants
      .map(
        (variant) =>
          `${variant.name}|${variant.sku}|${variant.sellingPrice}|${variant.stock}`,
      )
      .join("\n");

    const fulfillmentNotes = [
      `CJ Product ID: ${pid}`,
      freightName ? `Estimated logistics: ${freightName}` : "",
      freightAging ? `Estimated transit: ${freightAging} days` : "",
      freightWarning,
      `Pricing: ${usdToTzsRate} TZS/USD, ${marginPercent}% margin, ${reserveTzs} TZS reserve.`,
    ]
      .filter(Boolean)
      .join("\n");

    stage = "local draft save";
    const productId = await saveProduct({
      name,
      slug: productSlug,
      categoryName: categoryLeaf(detail.categoryName),
      shortDescription:
        description.slice(0, 900) ||
        `${name} supplied through CJdropshipping.`,
      description,
      status: "draft",
      price: String(productSellingPrice),
      baseCost: String(productCostTzs),
      shippingCost: String(shippingTzs),
      featured: false,
      imageUrls: imageUrls.join("\n"),
      supplierName: "CJdropshipping",
      supplierContact: detail.supplierName || "",
      supplierWebsite: "https://cjdropshipping.com",
      supplierCountry: "China",
      supplierUrl: "",
      deliveryDays: freightAging
        ? String(finalDeliveryDays(freightAging) || "")
        : "",
      supplierNotes: `CJ Supplier ID: ${detail.supplierId || "Not supplied"}`,
      fulfillmentNotes,
      variantsText,
    });

    stage = "CJ metadata save";
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
        supplier_sync_error = ${freightWarning || null},
        supplier_raw_data = COALESCE(supplier_raw_data, '{}'::jsonb)
          || jsonb_build_object(
            'cj',
            ${JSON.stringify({
              pid,
              productSku: detail.productSku || null,
              supplierId: detail.supplierId || null,
              supplierName: detail.supplierName || null,
              freight: {
                usd: freightUsd,
                method: freightName || null,
                aging: freightAging || null,
                warning: freightWarning || null,
              },
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
          supplier_price_usd = ${variant.supplierPriceUsd}
        WHERE product_id = ${productId}
          AND sku = ${variant.sku}
      `;
    }

    stage = "database verification";
    const verification = await sql`
      SELECT id, name, slug, status::text AS status
      FROM products
      WHERE id = ${productId}
      LIMIT 1
    `;

    if (verification.length === 0) {
      throw new Error("The product was not retained by Neon.");
    }

    return NextResponse.json({
      ok: true,
      product: {
        id: productId,
        slug: productSlug,
        name,
        status: "draft",
        supplierCostTzs: productCostTzs,
        shippingTzs,
        sellingPriceTzs: productSellingPrice,
        estimatedProfitTzs:
          productSellingPrice - productCostTzs - shippingTzs,
        variants: normalizedVariants.length,
        freightMethod: freightName || null,
        freightAging: freightAging || null,
        warning: freightWarning || null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("CJ import failed", { stage, message, error });

    return NextResponse.json(
      {
        ok: false,
        error: `CJ import failed during ${stage}: ${message}`,
        stage,
      },
      { status: 500 },
    );
  }
}
