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
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
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

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold"
            >
              Refresh
            </button>
            <a
              href="/admin/cj"
              className="rounded-lg bg-[#ff6a00] px-4 py-2 text-sm font-bold text-white"
            >
              Import from CJ
            </a>
            <a
              href="/products"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold"
            >
              Open storefront
            </a>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            <p className="font-black">Catalogue API error</p>
            <p className="mt-1 break-words">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="mt-5 rounded-xl bg-white p-8 shadow-sm">
            Loading products...
          </div>
        ) : products.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-orange-200 bg-white p-10 text-center shadow-sm">
            <h3 className="text-xl font-black">No products saved yet</h3>
            <p className="mt-2 text-sm text-slate-500">
              Import a CJ product as Draft or create one with the editor.
            </p>
            <a
              href="/admin/cj"
              className="mt-5 inline-block rounded-full bg-[#ff6a00] px-5 py-3 text-sm font-black text-white"
            >
              Open CJ Import Centre
            </a>
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