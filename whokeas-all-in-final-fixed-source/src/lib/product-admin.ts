import { randomUUID } from "node:crypto";

import {
  catalogSql,
  ensureCatalogSchema,
} from "@/lib/catalog-schema";

export type ProductPayload = {
  name?: string;
  slug?: string;
  categoryName?: string;
  shortDescription?: string;
  description?: string;
  status?: string;
  price?: string;
  baseCost?: string;
  shippingCost?: string;
  featured?: boolean;
  imageUrls?: string;
  supplierName?: string;
  supplierContact?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierWebsite?: string;
  supplierCountry?: string;
  supplierUrl?: string;
  deliveryDays?: string;
  supplierNotes?: string;
  fulfillmentNotes?: string;
  variantsText?: string;
};

type ParsedVariant = {
  name: string;
  sku: string;
  price: number;
  stock: number;
};

function clean(value: unknown, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function slugify(value: unknown) {
  return clean(value, 180)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseImages(value: unknown) {
  return clean(value, 30000)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => /^https?:\/\//i.test(item))
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 8);
}

function parseVariants(value: unknown, defaultPrice: number) {
  const seenSkus = new Set<string>();

  return clean(value, 30000)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index): ParsedVariant | null => {
      const [rawName, rawSku, rawPrice, rawStock] = line
        .split("|")
        .map((item) => item.trim());

      const name = clean(rawName || `Option ${index + 1}`, 220);
      const sku = clean(rawSku, 170)
        .replace(/[^A-Za-z0-9_-]+/g, "-")
        .toUpperCase();

      if (!name || !sku || seenSkus.has(sku)) {
        return null;
      }

      seenSkus.add(sku);

      return {
        name,
        sku,
        price: numberValue(rawPrice) ?? defaultPrice,
        stock: Math.max(0, Math.floor(Number(rawStock || 0))),
      };
    })
    .filter((item): item is ParsedVariant => Boolean(item));
}

function manualSupplier(payload: ProductPayload) {
  return {
    name: clean(payload.supplierName, 180) || null,
    contact: clean(payload.supplierContact, 180) || null,
    phone: clean(payload.supplierPhone, 40) || null,
    email: clean(payload.supplierEmail, 220) || null,
    website: clean(payload.supplierWebsite, 1000) || null,
    country: clean(payload.supplierCountry, 100) || null,
    sourceUrl: clean(payload.supplierUrl, 2000) || null,
    notes: clean(payload.supplierNotes, 3000) || null,
  };
}

export function getSql() {
  return catalogSql();
}

export async function listProducts() {
  await ensureCatalogSchema();
  const sql = catalogSql();

  return sql`
    SELECT
      p.id,
      p.name,
      p.slug,
      p.short_description AS "shortDescription",
      p.description,
      p.status::text AS status,
      p.price::text AS price,
      COALESCE(p.base_cost, 0)::text AS "baseCost",
      COALESCE(p.estimated_shipping_cost, 0)::text AS "shippingCost",
      p.is_featured AS featured,
      p.supplier_product_url AS "supplierUrl",
      p.estimated_delivery_days AS "deliveryDays",
      p.fulfillment_notes AS "fulfillmentNotes",
      p.supplier_platform AS "supplierPlatform",
      p.supplier_external_product_id AS "supplierExternalProductId",
      p.supplier_sync_error AS "supplierSyncError",
      c.name AS "categoryName",
      p.supplier_raw_data -> 'manualSupplier' ->> 'name' AS "supplierName",
      p.supplier_raw_data -> 'manualSupplier' ->> 'contact' AS "supplierContact",
      p.supplier_raw_data -> 'manualSupplier' ->> 'phone' AS "supplierPhone",
      p.supplier_raw_data -> 'manualSupplier' ->> 'email' AS "supplierEmail",
      p.supplier_raw_data -> 'manualSupplier' ->> 'website' AS "supplierWebsite",
      p.supplier_raw_data -> 'manualSupplier' ->> 'country' AS "supplierCountry",
      p.supplier_raw_data -> 'manualSupplier' ->> 'notes' AS "supplierNotes",
      COALESCE(
        (
          SELECT string_agg(pi.image_url, E'\n' ORDER BY pi.sort_order)
          FROM product_images pi
          WHERE pi.product_id = p.id
        ),
        ''
      ) AS "imageUrls",
      COALESCE(
        (
          SELECT string_agg(
            CONCAT(v.name, '|', v.sku, '|', v.price::text, '|', v.stock_quantity),
            E'\n'
            ORDER BY v.name
          )
          FROM product_variants v
          WHERE v.product_id = p.id
            AND v.is_active = true
        ),
        ''
      ) AS "variantsText"
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ORDER BY p.created_at DESC
  `;
}

export async function saveProduct(
  payload: ProductPayload,
  productId?: string,
) {
  await ensureCatalogSchema();
  const sql = catalogSql();

  const name = clean(payload.name, 180);
  const productSlug = slugify(payload.slug || payload.name);
  const categoryName = clean(payload.categoryName, 120);
  const categorySlug = slugify(categoryName);
  const shortDescription = clean(payload.shortDescription, 1200);
  const description = clean(payload.description, 10000);
  const requestedStatus = clean(payload.status, 30);
  const status = ["active", "draft", "archived"].includes(requestedStatus)
    ? requestedStatus
    : "draft";
  const price = numberValue(payload.price);
  const baseCost = numberValue(payload.baseCost);
  const shippingCost = numberValue(payload.shippingCost) ?? 0;

  if (
    !name ||
    !productSlug ||
    !categoryName ||
    !categorySlug ||
    !shortDescription ||
    price === null ||
    baseCost === null
  ) {
    throw new Error("Complete all required product fields.");
  }

  const duplicate = productId
    ? await sql`
        SELECT id
        FROM products
        WHERE slug = ${productSlug}
          AND id <> ${productId}
        LIMIT 1
      `
    : await sql`
        SELECT id
        FROM products
        WHERE slug = ${productSlug}
        LIMIT 1
      `;

  if (duplicate.length > 0) {
    throw new Error("That product slug already exists.");
  }

  await sql`
    INSERT INTO categories (name, slug, is_active, created_at)
    VALUES (${categoryName}, ${categorySlug}, true, NOW())
    ON CONFLICT (slug)
    DO UPDATE SET
      name = EXCLUDED.name,
      is_active = true
  `;

  const [category] = await sql`
    SELECT id
    FROM categories
    WHERE slug = ${categorySlug}
    LIMIT 1
  `;

  if (!category?.id) {
    throw new Error("Could not create or locate the product category.");
  }

  const id = productId || randomUUID();
  const images = parseImages(payload.imageUrls);
  const variants = parseVariants(payload.variantsText, price);
  const supplierJson = JSON.stringify(manualSupplier(payload));
  const deliveryDays = payload.deliveryDays
    ? Math.max(1, Math.floor(Number(payload.deliveryDays)))
    : null;

  if (productId) {
    const updated = await sql`
      UPDATE products
      SET
        category_id = ${category.id},
        name = ${name},
        slug = ${productSlug},
        short_description = ${shortDescription},
        description = ${description || null},
        status = ${status},
        base_cost = ${baseCost},
        price = ${price},
        estimated_shipping_cost = ${shippingCost},
        is_featured = ${Boolean(payload.featured)},
        supplier_product_url = ${clean(payload.supplierUrl, 2000) || null},
        estimated_delivery_days = ${deliveryDays},
        fulfillment_notes = ${clean(payload.fulfillmentNotes, 3000) || null},
        supplier_raw_data = COALESCE(supplier_raw_data, '{}'::jsonb)
          || jsonb_build_object('manualSupplier', ${supplierJson}::jsonb),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `;

    if (updated.length === 0) {
      throw new Error("Product not found.");
    }
  } else {
    await sql`
      INSERT INTO products (
        id,
        category_id,
        name,
        slug,
        short_description,
        description,
        brand,
        status,
        base_cost,
        price,
        estimated_shipping_cost,
        currency,
        is_featured,
        supplier_product_url,
        estimated_delivery_days,
        fulfillment_notes,
        supplier_raw_data,
        created_at,
        updated_at
      )
      VALUES (
        ${id},
        ${category.id},
        ${name},
        ${productSlug},
        ${shortDescription},
        ${description || null},
        'WHOKEAS ALL IN',
        ${status},
        ${baseCost},
        ${price},
        ${shippingCost},
        'TZS',
        ${Boolean(payload.featured)},
        ${clean(payload.supplierUrl, 2000) || null},
        ${deliveryDays},
        ${clean(payload.fulfillmentNotes, 3000) || null},
        ${JSON.stringify({ manualSupplier: manualSupplier(payload) })}::jsonb,
        NOW(),
        NOW()
      )
    `;
  }

  const childQueries = [
    sql`DELETE FROM product_images WHERE product_id = ${id}`,
    sql`DELETE FROM product_variants WHERE product_id = ${id}`,
    ...images.map(
      (imageUrl, index) => sql`
        INSERT INTO product_images (
          id,
          product_id,
          image_url,
          alt_text,
          sort_order,
          created_at
        )
        VALUES (
          ${randomUUID()},
          ${id},
          ${imageUrl},
          ${name},
          ${index},
          NOW()
        )
      `,
    ),
    ...variants.map(
      (variant) => sql`
        INSERT INTO product_variants (
          id,
          product_id,
          name,
          sku,
          options,
          cost,
          price,
          stock_quantity,
          is_active,
          created_at
        )
        VALUES (
          ${randomUUID()},
          ${id},
          ${variant.name},
          ${variant.sku},
          '{}'::jsonb,
          ${baseCost},
          ${variant.price},
          ${variant.stock},
          true,
          NOW()
        )
      `,
    ),
  ];

  try {
    await sql.transaction(childQueries);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.toLowerCase().includes("sku")) {
      throw new Error("One of the variant SKUs is already used by another product.");
    }

    throw error;
  }

  return id;
}
