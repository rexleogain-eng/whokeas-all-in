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

const fieldClass =
  "w-full border border-[#cfc5b5] bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-[#aaa095] focus:border-[#9a7534] focus:ring-2 focus:ring-[#b9944d]/15";
const labelClass =
  "mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-[#625a50]";

const FIXED_GROSS_MARGIN_RATE = 0.3;
const PAYMENT_FEE_RATE = 0.03;
const PRICE_ROUNDING_TZS = 500;

function automaticSellingPrice(baseCost: string, shippingCost: string) {
  const landedCost =
    Math.max(0, Number(baseCost || 0)) +
    Math.max(0, Number(shippingCost || 0));

  if (landedCost <= 0) return "";

  const raw =
    landedCost / (1 - FIXED_GROSS_MARGIN_RATE - PAYMENT_FEE_RATE);

  return String(
    Math.ceil(raw / PRICE_ROUNDING_TZS) * PRICE_ROUNDING_TZS,
  );
}

function statusTone(status: string) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "archived") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export default function ProductControlClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const profit = useMemo(() => {
    const sellingPrice = Number(form.price || 0);
    const landedCost =
      Number(form.baseCost || 0) + Number(form.shippingCost || 0);
    const paymentFee = sellingPrice * PAYMENT_FEE_RATE;

    return sellingPrice - landedCost - paymentFee;
  }, [form.price, form.baseCost, form.shippingCost]);

  const actualMargin = useMemo(() => {
    const sellingPrice = Number(form.price || 0);
    return sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
  }, [form.price, profit]);

  const stats = useMemo(
    () => ({
      total: products.length,
      active: products.filter((product) => product.status === "active").length,
      drafts: products.filter((product) => product.status === "draft").length,
      archived: products.filter((product) => product.status === "archived").length,
    }),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchesStatus =
        statusFilter === "all" || product.status === statusFilter;
      const matchesSearch =
        !normalized ||
        product.name.toLowerCase().includes(normalized) ||
        product.slug.toLowerCase().includes(normalized) ||
        (product.categoryName || "").toLowerCase().includes(normalized) ||
        (product.supplierName || "").toLowerCase().includes(normalized);
      return matchesStatus && matchesSearch;
    });
  }, [products, searchQuery, statusFilter]);

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

      setMessage(form.id ? "Product updated successfully." : "Product created successfully.");
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
          : "Product deleted successfully.",
      );
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not remove product.",
      );
    }
  }

  function editProduct(product: Product) {
    setForm(fromProduct(product));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["All products", stats.total],
          ["Active", stats.active],
          ["Draft review", stats.drafts],
          ["Archived", stats.archived],
        ].map(([label, value], index) => (
          <article key={String(label)} className="border border-[#d9d0c1] bg-[#fffdf9] p-5">
            <div className="flex items-start justify-between gap-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8e7650]">{label}</p>
              <span className="font-serif text-lg text-[#b9944d]">0{index + 1}</span>
            </div>
            <p className="mt-5 font-serif text-3xl font-semibold">{value}</p>
          </article>
        ))}
      </section>

      {(message || error) && (
        <div
          className={`mt-6 border p-4 text-sm font-semibold ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="mt-7 grid gap-7 2xl:grid-cols-[540px_1fr]">
        <form
          onSubmit={submit}
          className="h-fit border border-[#d9d0c1] bg-[#fffdf9] shadow-[0_15px_50px_rgba(54,45,32,0.05)] 2xl:sticky 2xl:top-6"
        >
          <div className="flex items-start justify-between gap-4 border-b border-[#e4ddd2] bg-[#faf7f1] px-5 py-5 sm:px-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">Product editor</p>
              <h2 className="mt-1 font-serif text-3xl font-semibold">
                {form.id ? "Edit selected product" : "Create a new product"}
              </h2>
              <p className="mt-2 text-xs leading-5 text-[#756d62]">
                Fields marked with an asterisk are required.
              </p>
            </div>

            {form.id && (
              <button
                type="button"
                onClick={() => setForm(emptyForm())}
                className="border border-[#cfc5b5] bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.13em] text-[#4e473e]"
              >
                New entry
              </button>
            )}
          </div>

          <div className="space-y-7 p-5 sm:p-6">
            <fieldset>
              <legend className="mb-4 font-serif text-xl font-semibold">Identity and presentation</legend>
              <div className="grid gap-4">
                <label>
                  <span className={labelClass}>Product name *</span>
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
                    className={fieldClass}
                    placeholder="Product display name"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className={labelClass}>URL slug *</span>
                    <input
                      required
                      value={form.slug}
                      onChange={(event) => update("slug", slugify(event.target.value))}
                      className={fieldClass}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Category *</span>
                    <input
                      required
                      value={form.categoryName}
                      onChange={(event) => update("categoryName", event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                </div>

                <label>
                  <span className={labelClass}>Short description *</span>
                  <textarea
                    required
                    rows={3}
                    value={form.shortDescription}
                    onChange={(event) => update("shortDescription", event.target.value)}
                    className={fieldClass}
                    placeholder="A concise customer-facing product summary"
                  />
                </label>

                <label>
                  <span className={labelClass}>Full description</span>
                  <textarea
                    rows={5}
                    value={form.description}
                    onChange={(event) => update("description", event.target.value)}
                    className={fieldClass}
                    placeholder="Detailed benefits, specifications and usage notes"
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="border-t border-[#e4ddd2] pt-6">
              <legend className="mb-4 font-serif text-xl font-semibold">Commercial settings</legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <label>
                  <span className={labelClass}>Selling price — automatic 30% margin *</span>
                  <input
                    required
                    readOnly
                    inputMode="decimal"
                    value={form.price}
                    className={`${fieldClass} cursor-not-allowed bg-[#f3efe7]`}
                  />
                </label>
                <label>
                  <span className={labelClass}>Supplier cost *</span>
                  <input
                    required
                    inputMode="decimal"
                    value={form.baseCost}
                    onChange={(event) => {
                      const baseCost = event.target.value;
                      setForm((current) => ({
                        ...current,
                        baseCost,
                        price: automaticSellingPrice(
                          baseCost,
                          current.shippingCost,
                        ),
                      }));
                    }}
                    className={fieldClass}
                  />
                </label>
                <label>
                  <span className={labelClass}>Shipping estimate</span>
                  <input
                    inputMode="decimal"
                    value={form.shippingCost}
                    onChange={(event) => {
                      const shippingCost = event.target.value;
                      setForm((current) => ({
                        ...current,
                        shippingCost,
                        price: automaticSellingPrice(
                          current.baseCost,
                          shippingCost,
                        ),
                      }));
                    }}
                    className={fieldClass}
                  />
                </label>
              </div>

              <div className={`mt-4 border p-4 ${profit >= 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      Estimated gross profit
                    </p>
                    <p className={`mt-2 font-serif text-3xl font-semibold ${profit >= 0 ? "text-emerald-900" : "text-red-900"}`}>
                      {price(profit)}
                    </p>
                    <p className="mt-1 text-xs font-bold text-[#6f685e]">
                      Gross margin: {actualMargin.toFixed(1)}% · Target: 30%
                    </p>
                  </div>
                  <p className="max-w-[180px] text-right text-xs leading-5 text-[#6f685e]">
                    After supplier cost, shipping and an estimated 3% payment fee.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className={labelClass}>Publishing status</span>
                  <select
                    value={form.status}
                    onChange={(event) => update("status", event.target.value as FormState["status"])}
                    className={fieldClass}
                  >
                    <option value="draft">Draft — private review</option>
                    <option value="active">Active — visible to customers</option>
                    <option value="archived">Archived — retained privately</option>
                  </select>
                </label>

                <label className="flex min-h-[74px] items-center gap-3 border border-[#cfc5b5] bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(event) => update("featured", event.target.checked)}
                    className="h-4 w-4 accent-[#9a7534]"
                  />
                  <span>
                    <span className="block text-sm font-semibold">Feature this product</span>
                    <span className="mt-1 block text-xs text-[#7b7368]">Prioritize it in curated store sections.</span>
                  </span>
                </label>
              </div>
            </fieldset>

            <fieldset className="border-t border-[#e4ddd2] pt-6">
              <legend className="mb-4 font-serif text-xl font-semibold">Images and inventory</legend>
              <label>
                <span className={labelClass}>Product image URLs</span>
                <textarea
                  rows={4}
                  value={form.imageUrls}
                  onChange={(event) => update("imageUrls", event.target.value)}
                  placeholder="One image URL per line, maximum four"
                  className={fieldClass}
                />
              </label>

              <label className="mt-4 block">
                <span className={labelClass}>Variants and stock</span>
                <textarea
                  rows={6}
                  value={form.variantsText}
                  onChange={(event) => update("variantsText", event.target.value)}
                  placeholder={"Black|WAI-001-BLK|45000|20\nWhite|WAI-001-WHT|45000|15"}
                  className={`${fieldClass} font-mono text-xs`}
                />
                <span className="mt-2 block text-xs text-[#80786e]">
                  Format: Option | SKU | Price | Stock — one variant per line.
                </span>
              </label>
            </fieldset>

            <fieldset className="border-t border-[#e4ddd2] pt-6">
              <legend className="mb-4 font-serif text-xl font-semibold">Supplier and fulfilment</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["supplierName", "Supplier or company"],
                  ["supplierContact", "Contact person"],
                  ["supplierPhone", "Phone"],
                  ["supplierEmail", "Email"],
                  ["supplierWebsite", "Website"],
                  ["supplierCountry", "Country"],
                  ["supplierUrl", "Private source URL"],
                  ["deliveryDays", "Estimated delivery days"],
                ].map(([key, placeholder]) => (
                  <label key={key} className={key === "supplierUrl" ? "sm:col-span-2" : ""}>
                    <span className={labelClass}>{placeholder}</span>
                    <input
                      value={String(form[key as keyof FormState] ?? "")}
                      onChange={(event) => update(key as keyof FormState, event.target.value as never)}
                      className={fieldClass}
                    />
                  </label>
                ))}
                <label className="sm:col-span-2">
                  <span className={labelClass}>Private supplier notes</span>
                  <textarea
                    rows={3}
                    value={form.supplierNotes}
                    onChange={(event) => update("supplierNotes", event.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className={labelClass}>Private fulfilment instructions</span>
                  <textarea
                    rows={3}
                    value={form.fulfillmentNotes}
                    onChange={(event) => update("fulfillmentNotes", event.target.value)}
                    className={fieldClass}
                  />
                </label>
              </div>
            </fieldset>
          </div>

          <div className="border-t border-[#e4ddd2] bg-[#faf7f1] p-5 sm:p-6">
            <button
              type="submit"
              disabled={saving}
              className="w-full border border-[#1b1814] bg-[#1b1814] px-5 py-3.5 text-xs font-black uppercase tracking-[0.17em] text-white transition hover:bg-[#2a251e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving product..." : form.id ? "Save product changes" : "Create draft product"}
            </button>
          </div>
        </form>

        <section>
          <div className="border border-[#d9d0c1] bg-[#fffdf9] p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">Catalogue library</p>
                <h2 className="mt-1 font-serif text-3xl font-semibold">Product records</h2>
                <p className="mt-2 text-sm text-[#746d63]">
                  Showing {filteredProducts.length} of {products.length} products.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void load()}
                  className="border border-[#cfc5b5] bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.13em] text-[#4e473e]"
                >
                  Refresh
                </button>
                <a
                  href="/admin/cj"
                  className="border border-[#b9944d] bg-[#b9944d] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.13em] text-[#171410]"
                >
                  Source from CJ
                </a>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_190px]">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search name, category, slug or supplier"
                className={fieldClass}
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={fieldClass}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="mt-4 border border-[#d9d0c1] bg-[#fffdf9] p-10 text-center text-sm text-[#746d63]">
              Loading catalogue records...
            </div>
          ) : products.length === 0 ? (
            <div className="mt-4 border border-dashed border-[#cabfae] bg-[#fffdf9] p-12 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">Empty catalogue</p>
              <h3 className="mt-3 font-serif text-3xl font-semibold">No products saved yet</h3>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#746d63]">
                Import one carefully selected CJ product as a draft or create a product in the editor.
              </p>
              <a
                href="/admin/cj"
                className="mt-6 inline-flex border border-[#1b1814] bg-[#1b1814] px-5 py-3 text-xs font-black uppercase tracking-[0.15em] text-white"
              >
                Open sourcing centre
              </a>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="mt-4 border border-[#d9d0c1] bg-[#fffdf9] p-10 text-center text-sm text-[#746d63]">
              No product matches the current search and status filter.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {filteredProducts.map((product) => {
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
                    className="grid overflow-hidden border border-[#d9d0c1] bg-[#fffdf9] shadow-[0_10px_35px_rgba(54,45,32,0.035)] md:grid-cols-[190px_1fr]"
                  >
                    <div className="aspect-[4/3] bg-[#eee8dd] md:aspect-auto md:min-h-[220px]">
                      {firstImage ? (
                        <img
                          src={firstImage}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full min-h-[180px] items-center justify-center font-serif text-5xl text-[#9e9486]">
                          WAI
                        </div>
                      )}
                    </div>

                    <div className="p-5 sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7534]">
                            {product.categoryName ?? "General"}
                          </p>
                          <h3 className="mt-2 font-serif text-2xl font-semibold">{product.name}</h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#746d63]">
                            {product.shortDescription || "No short description supplied."}
                          </p>
                        </div>
                        <span className={`w-fit border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${statusTone(product.status)}`}>
                          {product.status}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="border border-[#e1d9cd] bg-[#faf7f1] p-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#8c8377]">Selling</p>
                          <p className="mt-2 font-serif text-lg font-semibold">{price(product.price)}</p>
                        </div>
                        <div className="border border-[#e1d9cd] bg-[#faf7f1] p-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#8c8377]">Landed cost</p>
                          <p className="mt-2 font-serif text-lg font-semibold">
                            {price(Number(product.baseCost) + Number(product.shippingCost))}
                          </p>
                        </div>
                        <div className={`border p-3 ${estimatedProfit >= 0 ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>
                          <p className="text-[9px] font-black uppercase tracking-[0.15em]">Profit</p>
                          <p className="mt-2 font-serif text-lg font-semibold">{price(estimatedProfit)}</p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col gap-4 border-t border-[#e4ddd2] pt-5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-[#6c645a]">
                          Supplier: <strong className="text-[#2e2923]">{product.supplierName || "Not assigned"}</strong>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => editProduct(product)}
                            className="border border-[#1b1814] bg-[#1b1814] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.13em] text-white"
                          >
                            Edit record
                          </button>
                          <a
                            href={`/products/${product.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="border border-[#cfc5b5] bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.13em] text-[#4e473e]"
                          >
                            Preview
                          </a>
                          <button
                            type="button"
                            onClick={() => remove(product)}
                            className="border border-red-200 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.13em] text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
