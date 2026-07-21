$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json")) {
  throw "Run this inside C:\Users\Hp\Desktop\whokeas-all-in"
}

$utf8 = [System.Text.UTF8Encoding]::new($false)

$dirs = @(
  ".\src\db",
  ".\src\lib",
  ".\src\components\admin",
  ".\src\app\admin\products",
  ".\src\app\api\admin\products",
  ".\src\app\api\admin\products\[id]",
  ".\src\app\products"
)

foreach ($dir in $dirs) {
  New-Item -ItemType Directory -Force $dir | Out-Null
}

$migration = @'
import { config } from "dotenv";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from .env.local");
}

const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS suppliers (
    id uuid PRIMARY KEY,
    name varchar(180) NOT NULL,
    contact_name varchar(180),
    phone varchar(40),
    email varchar(220),
    website text,
    country varchar(100),
    notes text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
  )
`;

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS suppliers_name_lower_unique
  ON suppliers (LOWER(name))
`;

await sql`
  CREATE TABLE IF NOT EXISTS product_media (
    id uuid PRIMARY KEY,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    source text NOT NULL,
    alt_text varchar(240),
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT NOW()
  )
`;

await sql`
  ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL
`;

await sql`
  ALTER TABLE products
  ADD COLUMN IF NOT EXISTS estimated_shipping_cost numeric(14,2) NOT NULL DEFAULT 0
`;

await sql`
  ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_product_url text
`;

await sql`
  ALTER TABLE products
  ADD COLUMN IF NOT EXISTS estimated_delivery_days integer
`;

await sql`
  ALTER TABLE products
  ADD COLUMN IF NOT EXISTS fulfillment_notes text
`;

await sql`
  DO $$
  DECLARE enum_name text;
  BEGIN
    SELECT t.typname INTO enum_name
    FROM pg_type t
    JOIN pg_attribute a ON a.atttypid = t.oid
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'products'
      AND a.attname = 'status'
      AND t.typtype = 'e'
    LIMIT 1;

    IF enum_name IS NOT NULL THEN
      EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', enum_name, 'draft');
      EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', enum_name, 'archived');
    END IF;
  END
  $$;
`;

console.log("Product control database migration completed.");
'@

$helpers = @'
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

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

function clean(value: unknown, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function slugify(value: unknown) {
  return clean(value, 160)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseImages(value: unknown) {
  return clean(value, 12000)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function parseVariants(value: unknown, defaultPrice: number) {
  return clean(value, 12000)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, sku, price, stock] = line.split("|").map((item) => item.trim());

      return {
        name,
        sku: (sku ?? "").toUpperCase(),
        price: numberValue(price) ?? defaultPrice,
        stock: Math.max(0, Math.floor(Number(stock ?? 0))),
      };
    })
    .filter((item) => item.name && item.sku);
}

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing");
  }

  return neon(process.env.DATABASE_URL);
}

export async function listProducts() {
  const sql = getSql();

  return sql`
    SELECT
      p.id,
      p.name,
      p.slug,
      p.short_description AS "shortDescription",
      p.description,
      p.status::text AS status,
      p.price::text AS price,
      p.base_cost::text AS "baseCost",
      p.estimated_shipping_cost::text AS "shippingCost",
      p.is_featured AS featured,
      p.supplier_product_url AS "supplierUrl",
      p.estimated_delivery_days AS "deliveryDays",
      p.fulfillment_notes AS "fulfillmentNotes",
      c.name AS "categoryName",
      s.name AS "supplierName",
      s.contact_name AS "supplierContact",
      s.phone AS "supplierPhone",
      s.email AS "supplierEmail",
      s.website AS "supplierWebsite",
      s.country AS "supplierCountry",
      s.notes AS "supplierNotes",
      COALESCE(
        (
          SELECT string_agg(pm.source, E'\n' ORDER BY pm.sort_order)
          FROM product_media pm
          WHERE pm.product_id = p.id
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
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    ORDER BY p.created_at DESC
  `;
}

export async function saveProduct(
  payload: ProductPayload,
  productId?: string,
) {
  const sql = getSql();
  const name = clean(payload.name, 180);
  const productSlug = slugify(payload.slug || payload.name);
  const categoryName = clean(payload.categoryName, 120);
  const categorySlug = slugify(categoryName);
  const shortDescription = clean(payload.shortDescription, 500);
  const description = clean(payload.description, 5000);
  const status = ["active", "draft", "archived"].includes(
    clean(payload.status, 30),
  )
    ? clean(payload.status, 30)
    : "draft";
  const price = numberValue(payload.price);
  const baseCost = numberValue(payload.baseCost);
  const shippingCost = numberValue(payload.shippingCost) ?? 0;

  if (
    !name ||
    !productSlug ||
    !categoryName ||
    !shortDescription ||
    price === null ||
    baseCost === null
  ) {
    throw new Error("Complete all required product fields.");
  }

  const duplicate = productId
    ? await sql`
        SELECT id FROM products
        WHERE slug = ${productSlug} AND id <> ${productId}
        LIMIT 1
      `
    : await sql`
        SELECT id FROM products
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
    DO UPDATE SET name = EXCLUDED.name, is_active = true
  `;

  const [category] = await sql`
    SELECT id FROM categories WHERE slug = ${categorySlug} LIMIT 1
  `;

  let supplierId: string | null = null;
  const supplierName = clean(payload.supplierName, 180);

  if (supplierName) {
    const existing = await sql`
      SELECT id FROM suppliers
      WHERE LOWER(name) = LOWER(${supplierName})
      LIMIT 1
    `;

    supplierId = existing[0]?.id ? String(existing[0].id) : randomUUID();

    if (existing.length > 0) {
      await sql`
        UPDATE suppliers
        SET
          contact_name = ${clean(payload.supplierContact, 180) || null},
          phone = ${clean(payload.supplierPhone, 40) || null},
          email = ${clean(payload.supplierEmail, 220) || null},
          website = ${clean(payload.supplierWebsite, 1000) || null},
          country = ${clean(payload.supplierCountry, 100) || null},
          notes = ${clean(payload.supplierNotes, 3000) || null},
          is_active = true,
          updated_at = NOW()
        WHERE id = ${supplierId}
      `;
    } else {
      await sql`
        INSERT INTO suppliers (
          id, name, contact_name, phone, email, website, country, notes,
          is_active, created_at, updated_at
        )
        VALUES (
          ${supplierId},
          ${supplierName},
          ${clean(payload.supplierContact, 180) || null},
          ${clean(payload.supplierPhone, 40) || null},
          ${clean(payload.supplierEmail, 220) || null},
          ${clean(payload.supplierWebsite, 1000) || null},
          ${clean(payload.supplierCountry, 100) || null},
          ${clean(payload.supplierNotes, 3000) || null},
          true,
          NOW(),
          NOW()
        )
      `;
    }
  }

  const id = productId || randomUUID();
  const images = parseImages(payload.imageUrls);
  const variants = parseVariants(payload.variantsText, price);

  if (productId) {
    await sql`
      UPDATE products
      SET
        category_id = ${category.id},
        supplier_id = ${supplierId},
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
        estimated_delivery_days = ${
          payload.deliveryDays
            ? Math.max(1, Math.floor(Number(payload.deliveryDays)))
            : null
        },
        fulfillment_notes = ${clean(payload.fulfillmentNotes, 3000) || null},
        updated_at = NOW()
      WHERE id = ${id}
    `;
  } else {
    await sql`
      INSERT INTO products (
        id, category_id, supplier_id, name, slug, short_description,
        description, brand, status, base_cost, price,
        estimated_shipping_cost, currency, is_featured,
        supplier_product_url, estimated_delivery_days, fulfillment_notes,
        created_at, updated_at
      )
      VALUES (
        ${id}, ${category.id}, ${supplierId}, ${name}, ${productSlug},
        ${shortDescription}, ${description || null}, 'WHOKEAS ALL IN',
        ${status}, ${baseCost}, ${price}, ${shippingCost}, 'TZS',
        ${Boolean(payload.featured)},
        ${clean(payload.supplierUrl, 2000) || null},
        ${
          payload.deliveryDays
            ? Math.max(1, Math.floor(Number(payload.deliveryDays)))
            : null
        },
        ${clean(payload.fulfillmentNotes, 3000) || null},
        NOW(), NOW()
      )
    `;
  }

  const queries = [
    sql`DELETE FROM product_media WHERE product_id = ${id}`,
    sql`
      UPDATE product_variants
      SET is_active = false
      WHERE product_id = ${id}
    `,
    ...images.map(
      (source, index) => sql`
        INSERT INTO product_media (
          id, product_id, source, alt_text, sort_order, created_at
        )
        VALUES (
          ${randomUUID()}, ${id}, ${source}, ${name}, ${index}, NOW()
        )
      `,
    ),
    ...variants.map(
      (variant) => sql`
        INSERT INTO product_variants (
          id, product_id, name, sku, options, cost, price,
          stock_quantity, is_active, created_at
        )
        VALUES (
          ${randomUUID()}, ${id}, ${variant.name}, ${variant.sku},
          '{}'::jsonb, ${baseCost}, ${variant.price},
          ${variant.stock}, true, NOW()
        )
        ON CONFLICT (sku)
        DO UPDATE SET
          product_id = EXCLUDED.product_id,
          name = EXCLUDED.name,
          cost = EXCLUDED.cost,
          price = EXCLUDED.price,
          stock_quantity = EXCLUDED.stock_quantity,
          is_active = true
      `,
    ),
  ];

  await sql.transaction(queries);

  return id;
}
'@

$client = @'
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  slug: string;
  categoryName: string | null;
  shortDescription: string | null;
  description: string | null;
  status: string;
  price: string;
  baseCost: string;
  shippingCost: string;
  featured: boolean;
  imageUrls: string;
  supplierName: string | null;
  supplierContact: string | null;
  supplierPhone: string | null;
  supplierEmail: string | null;
  supplierWebsite: string | null;
  supplierCountry: string | null;
  supplierUrl: string | null;
  deliveryDays: number | null;
  supplierNotes: string | null;
  fulfillmentNotes: string | null;
  variantsText: string;
};

type FormState = {
  id: string | null;
  name: string;
  slug: string;
  categoryName: string;
  shortDescription: string;
  description: string;
  status: "active" | "draft" | "archived";
  price: string;
  baseCost: string;
  shippingCost: string;
  featured: boolean;
  imageUrls: string;
  supplierName: string;
  supplierContact: string;
  supplierPhone: string;
  supplierEmail: string;
  supplierWebsite: string;
  supplierCountry: string;
  supplierUrl: string;
  deliveryDays: string;
  supplierNotes: string;
  fulfillmentNotes: string;
  variantsText: string;
};

const emptyForm = (): FormState => ({
  id: null,
  name: "",
  slug: "",
  categoryName: "Tech",
  shortDescription: "",
  description: "",
  status: "draft",
  price: "",
  baseCost: "",
  shippingCost: "0",
  featured: false,
  imageUrls: "",
  supplierName: "",
  supplierContact: "",
  supplierPhone: "",
  supplierEmail: "",
  supplierWebsite: "",
  supplierCountry: "Tanzania",
  supplierUrl: "",
  deliveryDays: "",
  supplierNotes: "",
  fulfillmentNotes: "",
  variantsText: "",
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function price(value: string | number) {
  return `TZS ${Number(value || 0).toLocaleString("en-US")}`;
}

function fromProduct(product: Product): FormState {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    categoryName: product.categoryName ?? "General",
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    status: ["active", "draft", "archived"].includes(product.status)
      ? (product.status as FormState["status"])
      : "draft",
    price: product.price,
    baseCost: product.baseCost,
    shippingCost: product.shippingCost,
    featured: product.featured,
    imageUrls: product.imageUrls,
    supplierName: product.supplierName ?? "",
    supplierContact: product.supplierContact ?? "",
    supplierPhone: product.supplierPhone ?? "",
    supplierEmail: product.supplierEmail ?? "",
    supplierWebsite: product.supplierWebsite ?? "",
    supplierCountry: product.supplierCountry ?? "Tanzania",
    supplierUrl: product.supplierUrl ?? "",
    deliveryDays: product.deliveryDays ? String(product.deliveryDays) : "",
    supplierNotes: product.supplierNotes ?? "",
    fulfillmentNotes: product.fulfillmentNotes ?? "",
    variantsText: product.variantsText,
  };
}

export default function ProductControlClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/products", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Could not load products.");
      }

      setProducts(result.products);
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load products.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const profit = useMemo(
    () =>
      Number(form.price || 0) -
      Number(form.baseCost || 0) -
      Number(form.shippingCost || 0),
    [form.price, form.baseCost, form.shippingCost],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        form.id ? `/api/admin/products/${form.id}` : "/api/admin/products",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Could not save product.");
      }

      setMessage(form.id ? "Product updated." : "Product created.");
      setForm(emptyForm());
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save product.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(product: Product) {
    if (!window.confirm(`Delete ${product.name}?`)) return;

    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Could not remove product.");
      }

      setMessage(
        result.mode === "archived"
          ? "Product archived because it has order history."
          : "Product deleted.",
      );
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not remove product.",
      );
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[500px_1fr]">
      <form
        onSubmit={submit}
        className="h-fit rounded-xl bg-white p-5 shadow-sm xl:sticky xl:top-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b36f00]">
              Product editor
            </p>
            <h2 className="mt-1 text-2xl font-black">
              {form.id ? "Edit product" : "Add product"}
            </h2>
          </div>

          {form.id && (
            <button
              type="button"
              onClick={() => setForm(emptyForm())}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
            >
              New
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-4">
          <label>
            <span className="mb-1 block text-sm font-bold">Name *</span>
            <input
              required
              value={form.name}
              onChange={(event) => {
                const name = event.target.value;
                setForm((current) => ({
                  ...current,
                  name,
                  slug: current.id ? current.slug : slugify(name),
                }));
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-sm font-bold">Slug *</span>
              <input
                required
                value={form.slug}
                onChange={(event) => update("slug", slugify(event.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              />
            </label>

            <label>
              <span className="mb-1 block text-sm font-bold">Category *</span>
              <input
                required
                value={form.categoryName}
                onChange={(event) =>
                  update("categoryName", event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              />
            </label>
          </div>

          <label>
            <span className="mb-1 block text-sm font-bold">
              Short description *
            </span>
            <textarea
              required
              rows={2}
              value={form.shortDescription}
              onChange={(event) =>
                update("shortDescription", event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>

          <label>
            <span className="mb-1 block text-sm font-bold">
              Full description
            </span>
            <textarea
              rows={4}
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>

          <div className="grid grid-cols-3 gap-2">
            <label>
              <span className="mb-1 block text-xs font-bold">Selling *</span>
              <input
                required
                inputMode="decimal"
                value={form.price}
                onChange={(event) => update("price", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold">Cost *</span>
              <input
                required
                inputMode="decimal"
                value={form.baseCost}
                onChange={(event) => update("baseCost", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold">Shipping</span>
              <input
                inputMode="decimal"
                value={form.shippingCost}
                onChange={(event) => update("shippingCost", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              />
            </label>
          </div>

          <div
            className={`rounded-lg p-4 ${
              profit >= 0
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            <p className="text-xs font-bold uppercase tracking-[0.12em]">
              Estimated profit
            </p>
            <p className="mt-1 text-2xl font-black">{price(profit)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-sm font-bold">Status</span>
              <select
                value={form.status}
                onChange={(event) =>
                  update("status", event.target.value as FormState["status"])
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </label>

            <label className="flex items-end gap-3 rounded-lg border border-slate-200 p-3">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(event) => update("featured", event.target.checked)}
              />
              <span className="text-sm font-bold">Featured</span>
            </label>
          </div>

          <label>
            <span className="mb-1 block text-sm font-bold">
              Product image URLs
            </span>
            <textarea
              rows={3}
              value={form.imageUrls}
              onChange={(event) => update("imageUrls", event.target.value)}
              placeholder="One image URL per line, maximum four"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-black">Supplier</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                ["supplierName", "Supplier/company"],
                ["supplierContact", "Contact person"],
                ["supplierPhone", "Phone"],
                ["supplierEmail", "Email"],
                ["supplierWebsite", "Website"],
                ["supplierCountry", "Country"],
                ["supplierUrl", "Private product/source URL"],
                ["deliveryDays", "Estimated delivery days"],
              ].map(([key, placeholder]) => (
                <input
                  key={key}
                  value={String(form[key as keyof FormState] ?? "")}
                  onChange={(event) =>
                    update(
                      key as keyof FormState,
                      event.target.value as never,
                    )
                  }
                  placeholder={placeholder}
                  className={`rounded-lg border border-slate-300 px-3 py-2.5 ${
                    key === "supplierUrl" ? "sm:col-span-2" : ""
                  }`}
                />
              ))}
              <textarea
                rows={2}
                value={form.supplierNotes}
                onChange={(event) =>
                  update("supplierNotes", event.target.value)
                }
                placeholder="Private supplier notes"
                className="rounded-lg border border-slate-300 px-3 py-2.5 sm:col-span-2"
              />
              <textarea
                rows={2}
                value={form.fulfillmentNotes}
                onChange={(event) =>
                  update("fulfillmentNotes", event.target.value)
                }
                placeholder="Private fulfilment instructions"
                className="rounded-lg border border-slate-300 px-3 py-2.5 sm:col-span-2"
              />
            </div>
          </div>

          <label>
            <span className="mb-1 block text-sm font-bold">
              Variants and stock
            </span>
            <textarea
              rows={5}
              value={form.variantsText}
              onChange={(event) => update("variantsText", event.target.value)}
              placeholder={"Black|WAI-001-BLK|45000|20\nWhite|WAI-001-WHT|45000|15"}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm"
            />
            <span className="mt-1 block text-xs text-slate-500">
              One per line: Option | SKU | Price | Stock
            </span>
          </label>
        </div>

        {message && (
          <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="mt-5 w-full rounded-full bg-[#ffd814] px-5 py-3 text-sm font-black hover:bg-[#f7ca00] disabled:opacity-50"
        >
          {saving ? "Saving..." : form.id ? "Update Product" : "Create Product"}
        </button>
      </form>

      <section>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b36f00]">
              Catalogue
            </p>
            <h2 className="mt-1 text-3xl font-black">Products</h2>
          </div>

          <a
            href="/products"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold"
          >
            Open storefront
          </a>
        </div>

        {loading ? (
          <div className="mt-5 rounded-xl bg-white p-8 shadow-sm">
            Loading products...
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {products.map((product) => {
              const firstImage = product.imageUrls
                .split(/\r?\n/)
                .map((item) => item.trim())
                .find(Boolean);
              const estimatedProfit =
                Number(product.price) -
                Number(product.baseCost) -
                Number(product.shippingCost);

              return (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-xl bg-white shadow-sm"
                >
                  <div className="aspect-[16/9] bg-slate-100">
                    {firstImage ? (
                      <img
                        src={firstImage}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl font-black text-slate-400">
                        WAI
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase text-slate-500">
                          {product.categoryName ?? "General"}
                        </p>
                        <h3 className="mt-1 text-xl font-black">
                          {product.name}
                        </h3>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">
                        {product.status}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Sell</p>
                        <p className="font-black">{price(product.price)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Cost</p>
                        <p className="font-black">{price(product.baseCost)}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-3 text-emerald-700">
                        <p className="text-xs">Profit</p>
                        <p className="font-black">{price(estimatedProfit)}</p>
                      </div>
                    </div>

                    <p className="mt-4 text-sm text-slate-600">
                      Supplier: {product.supplierName || "Not assigned"}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setForm(fromProduct(product));
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="rounded-lg bg-[#101820] px-4 py-2 text-sm font-bold text-white"
                      >
                        Edit
                      </button>
                      <a
                        href={`/products/${product.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold"
                      >
                        View
                      </a>
                      <button
                        type="button"
                        onClick={() => remove(product)}
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
'@

$adminPage = @'
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import ProductControlClient from "@/components/admin/ProductControlClient";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  return (
    <main className="min-h-screen bg-[#eaeded] text-[#0f1111]">
      <header className="bg-[#101820] text-white shadow-md">
        <div className="mx-auto flex min-h-16 max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-12 w-[72px]">
              <Image
                src="/brand/logo-mark.png"
                alt=""
                fill
                priority
                sizes="72px"
                className="object-contain"
              />
            </div>
            <div>
              <div className="font-black tracking-[0.12em]">WHOKEAS</div>
              <div className="text-[10px] font-black tracking-[0.3em] text-[#f3b61f]">
                PRODUCT CONTROL
              </div>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/admin/orders"
              className="rounded-lg border border-white/25 px-4 py-2 text-sm font-bold"
            >
              Orders
            </Link>
            <Link
              href="/admin/products"
              className="rounded-lg bg-[#ffd814] px-4 py-2 text-sm font-bold text-black"
            >
              Products
            </Link>
            <form action="/api/admin/logout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-white/25 px-4 py-2 text-sm font-bold"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-7 lg:px-6">
        <div className="mb-6">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#b36f00]">
            Product and supplier control centre
          </p>
          <h1 className="mt-2 text-4xl font-black">
            Manage the complete catalogue
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Control prices, suppliers, profit, images, variants and stock
            without editing code.
          </p>
        </div>

        <ProductControlClient />
      </div>
    </main>
  );
}
'@

$apiRoute = @'
import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import {
  listProducts,
  saveProduct,
  type ProductPayload,
} from "@/lib/product-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    return NextResponse.json({
      ok: true,
      products: await listProducts(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not load products.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    const id = await saveProduct((await request.json()) as ProductPayload);

    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create product.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("slug") ? 409 : 400 },
    );
  }
}
'@

$itemRoute = @'
import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import {
  getSql,
  saveProduct,
  type ProductPayload,
} from "@/lib/product-admin";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    await saveProduct((await request.json()) as ProductPayload, id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update product.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("slug") ? 409 : 400 },
    );
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const sql = getSql();

    const history = await sql`
      SELECT COUNT(*)::int AS count
      FROM order_items
      WHERE product_id = ${id}
    `;

    if (Number(history[0]?.count ?? 0) > 0) {
      await sql`
        UPDATE products
        SET status = 'archived', updated_at = NOW()
        WHERE id = ${id}
      `;

      return NextResponse.json({ ok: true, mode: "archived" });
    }

    await sql.transaction([
      sql`DELETE FROM product_media WHERE product_id = ${id}`,
      sql`DELETE FROM product_variants WHERE product_id = ${id}`,
      sql`DELETE FROM products WHERE id = ${id}`,
    ]);

    return NextResponse.json({ ok: true, mode: "deleted" });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not remove product.",
      },
      { status: 500 },
    );
  }
}
'@

$cataloguePage = @'
import { neon } from "@neondatabase/serverless";
import Image from "next/image";
import Link from "next/link";

import CartButton from "@/components/store/CartButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatPrice(value: string | number) {
  return `TZS ${Number(value).toLocaleString("en-US")}`;
}

export default async function ProductsPage() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing");
  }

  const sql = neon(process.env.DATABASE_URL);

  const products = await sql`
    SELECT
      p.id,
      p.name,
      p.slug,
      p.short_description AS "shortDescription",
      p.price::text AS price,
      c.name AS "categoryName",
      (
        SELECT pm.source
        FROM product_media pm
        WHERE pm.product_id = p.id
        ORDER BY pm.sort_order
        LIMIT 1
      ) AS image
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.status::text = 'active'
    ORDER BY p.is_featured DESC, p.created_at DESC
  `;

  return (
    <main className="min-h-screen bg-[#eaeded] text-[#0f1111]">
      <header className="bg-[#101820] text-white shadow-md">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-12 w-[72px]">
              <Image
                src="/brand/logo-mark.png"
                alt=""
                fill
                priority
                sizes="72px"
                className="object-contain"
              />
            </div>
            <div>
              <div className="font-black tracking-[0.12em]">WHOKEAS</div>
              <div className="text-[10px] font-black tracking-[0.3em] text-[#f3b61f]">
                ALL IN
              </div>
            </div>
          </Link>
          <CartButton />
        </div>
      </header>

      <section className="bg-gradient-to-r from-[#0b1b2a] to-[#bb7b00] px-4 py-12 text-white">
        <div className="mx-auto max-w-[1500px]">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#ffd814]">
            WHOKEAS ALL IN catalogue
          </p>
          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            Products selected for Tanzania.
          </h1>
        </div>
      </section>

      <div className="mx-auto max-w-[1500px] px-4 py-8 lg:px-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => (
            <Link
              key={String(product.id)}
              href={`/products/${product.slug}`}
              className="overflow-hidden rounded-xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="aspect-square bg-slate-100">
                {product.image ? (
                  <img
                    src={String(product.image)}
                    alt={String(product.name)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl font-black text-slate-400">
                    WAI
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  {String(product.categoryName ?? "General")}
                </p>
                <h2 className="mt-2 font-bold">{String(product.name)}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {String(product.shortDescription ?? "")}
                </p>
                <p className="mt-4 text-xl font-black">
                  {formatPrice(String(product.price))}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
'@


$productDetailPage = @'
import { neon } from "@neondatabase/serverless";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import AddToCart from "@/components/store/AddToCart";
import CartButton from "@/components/store/CartButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }>;
};

function formatPrice(value: string | number) {
  return `TZS ${Number(value).toLocaleString("en-US")}`;
}

export default async function ProductPage({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).trim().toLowerCase();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing");
  }

  const sql = neon(process.env.DATABASE_URL);

  const rows = await sql`
    SELECT
      p.id,
      p.name,
      p.slug,
      p.short_description AS "shortDescription",
      p.description,
      p.price::text AS price,
      p.brand,
      p.estimated_delivery_days AS "deliveryDays",
      c.name AS "categoryName"
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE LOWER(TRIM(p.slug)) = ${slug}
      AND p.status::text = 'active'
    LIMIT 1
  `;

  const product = rows[0] as
    | {
        id: string;
        name: string;
        slug: string;
        shortDescription: string | null;
        description: string | null;
        price: string;
        brand: string | null;
        deliveryDays: number | null;
        categoryName: string | null;
      }
    | undefined;

  if (!product) {
    notFound();
  }

  const images = await sql`
    SELECT source
    FROM product_media
    WHERE product_id = ${product.id}
    ORDER BY sort_order
    LIMIT 4
  `;

  const variants = (await sql`
    SELECT
      id,
      name,
      price::text AS price,
      stock_quantity AS "stockQuantity"
    FROM product_variants
    WHERE product_id = ${product.id}
      AND is_active = true
    ORDER BY name
  `) as Array<{
    id: string;
    name: string;
    price: string;
    stockQuantity: number;
  }>;

  const mainImage = images[0]?.source ? String(images[0].source) : null;

  return (
    <main className="min-h-screen bg-[#eaeded] text-[#0f1111]">
      <header className="bg-[#101820] text-white shadow-md">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-4 px-4 lg:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-12 w-[72px]">
              <Image
                src="/brand/logo-mark.png"
                alt=""
                fill
                priority
                sizes="72px"
                className="object-contain"
              />
            </div>
            <div className="hidden sm:block">
              <div className="font-black tracking-[0.12em]">WHOKEAS</div>
              <div className="text-[10px] font-black tracking-[0.3em] text-[#f3b61f]">
                ALL IN
              </div>
            </div>
          </Link>

          <div className="flex-1" />
          <Link
            href="/products"
            className="hidden rounded-lg border border-white/25 px-4 py-2 text-sm font-bold sm:block"
          >
            Products
          </Link>
          <CartButton />
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-6 lg:px-6">
        <section className="grid gap-8 bg-white p-5 shadow-sm lg:grid-cols-[minmax(340px,1fr)_minmax(340px,1fr)_330px]">
          <div>
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-50 to-amber-100">
              {mainImage ? (
                <img
                  src={mainImage}
                  alt={product.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="relative h-44 w-72">
                  <Image
                    src="/brand/logo-mark.png"
                    alt=""
                    fill
                    sizes="288px"
                    className="object-contain opacity-80"
                  />
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {images.map((image, index) => (
                  <div
                    key={`${String(image.source).slice(0, 30)}-${index}`}
                    className="aspect-square overflow-hidden rounded-lg border border-slate-200"
                  >
                    <img
                      src={String(image.source)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-sm text-[#007185]">
              {product.brand ?? "WHOKEAS ALL IN"}
            </p>
            <h1 className="mt-2 text-3xl font-medium">{product.name}</h1>
            <p className="mt-4 border-y border-slate-200 py-4 text-3xl text-[#b12704]">
              {formatPrice(product.price)}
            </p>

            <h2 className="mt-6 font-black">About this item</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">
              <li>{product.shortDescription}</li>
              <li>Category: {product.categoryName ?? "General"}</li>
              {product.deliveryDays ? (
                <li>Estimated supplier delivery: {product.deliveryDays} days.</li>
              ) : null}
              <li>Sold through WHOKEAS ALL IN.</li>
            </ul>

            {product.description && (
              <div className="mt-6 border-t border-slate-200 pt-5">
                <h2 className="font-black">Product description</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
                  {product.description}
                </p>
              </div>
            )}
          </div>

          <aside className="h-fit rounded-xl border border-slate-300 p-5 shadow-sm">
            <p className="text-2xl">{formatPrice(product.price)}</p>
            <p className="mt-4 text-emerald-700">Available to order</p>
            <div className="mt-5">
              <AddToCart
                product={{
                  id: product.id,
                  slug: product.slug,
                  name: product.name,
                  price: product.price,
                }}
                variants={variants}
              />
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
'@

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\db\migrate-product-control.ts"),
  $migration,
  $utf8
)

$files = @{
  "src\lib\product-admin.ts" = $helpers
  "src\components\admin\ProductControlClient.tsx" = $client
  "src\app\admin\products\page.tsx" = $adminPage
  "src\app\api\admin\products\route.ts" = $apiRoute
  "src\app\api\admin\products\[id]\route.ts" = $itemRoute
  "src\app\products\page.tsx" = $cataloguePage
  "src\app\products\[slug]\page.tsx" = $productDetailPage
}

foreach ($relativePath in $files.Keys) {
  [System.IO.File]::WriteAllText(
    (Join-Path (Get-Location) $relativePath),
    $files[$relativePath],
    $utf8
  )
}

Write-Host "Migrating Neon product controls..." -ForegroundColor Cyan
npx tsx .\src\db\migrate-product-control.ts

Remove-Item -Recurse -Force ".\.next" -ErrorAction SilentlyContinue

Write-Host "Running production build verification..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "WHOKEAS Product and Supplier Control Centre installed." -ForegroundColor Green
Write-Host "Run: npm run dev" -ForegroundColor Yellow
Write-Host "Open: http://localhost:3000/admin/products" -ForegroundColor Yellow
