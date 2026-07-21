"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type SearchProduct = {
  pid: string;
  name: string;
  sku: string;
  image: string;
  priceUsd: number;
  category: string;
  supplierName: string;
  inventory: number;
  listedNum: number;
  deliveryCycle: string | null;
};

type ImportResult = {
  id: string;
  slug: string;
  name: string;
  status: string;
  supplierCostTzs: number;
  shippingTzs: number;
  sellingPriceTzs: number;
  estimatedProfitTzs: number;
  variants: number;
  freightMethod: string | null;
  freightAging: string | null;
  warning: string | null;
};

function formatTzs(value: number) {
  return `TZS ${Math.round(value).toLocaleString("en-US")}`;
}

function formatUsd(value: number) {
  return `$${Number(value).toFixed(2)}`;
}

export default function CJConnectorClient() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [query, setQuery] = useState("portable rechargeable fan");
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [importingPid, setImportingPid] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [usdToTzsRate, setUsdToTzsRate] = useState(2700);
  const [marginPercent, setMarginPercent] = useState(35);
  const [reserveTzs, setReserveTzs] = useState(3000);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/admin/cj/status", {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.error || "CJ connection failed.");
        }

        setConnected(true);
        setUsdToTzsRate(result.defaults.usdToTzsRate);
        setMarginPercent(result.defaults.marginPercent);
        setReserveTzs(result.defaults.reserveTzs);
      } catch (caught) {
        setConnected(false);
        setError(
          caught instanceof Error
            ? caught.message
            : "CJ connection failed.",
        );
      }
    })();
  }, []);

  const pricingExample = useMemo(() => {
    const supplier = 10 * usdToTzsRate;
    const shipping = 5 * usdToTzsRate;
    const selling = Math.ceil(
      ((supplier + shipping + reserveTzs) *
        (1 + marginPercent / 100)) /
        500,
    ) * 500;

    return {
      supplier,
      shipping,
      selling,
      profit: selling - supplier - shipping,
    };
  }, [usdToTzsRate, marginPercent, reserveTzs]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    setError("");
    setMessage("");
    setImportResult(null);

    try {
      const response = await fetch(
        `/api/admin/cj/search?q=${encodeURIComponent(query)}`,
        { cache: "no-store" },
      );
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Search failed.");
      }

      setProducts(result.products);
      setMessage(
        result.products.length > 0
          ? `${result.products.length} CJ products loaded.`
          : "No matching CJ products were found.",
      );
    } catch (caught) {
      setProducts([]);
      setError(
        caught instanceof Error ? caught.message : "Search failed.",
      );
    } finally {
      setSearching(false);
    }
  }

  async function importProduct(product: SearchProduct) {
    const pid = product.pid;
    setImportingPid(pid);
    setError("");
    setMessage("");
    setImportResult(null);

    try {
      const response = await fetch("/api/admin/cj/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid,
          usdToTzsRate,
          marginPercent,
          reserveTzs,
          inventoryHint: product.inventory,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Import failed.");
      }

      setImportResult(result.product);
      setMessage(
        `${result.product.name} was imported as a draft product.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Import failed.",
      );
    } finally {
      setImportingPid("");
    }
  }

  async function syncProducts() {
    setSyncing(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/cj/sync", {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Synchronization failed.");
      }

      setMessage(
        `CJ synchronization complete: ${result.successful} successful, ${result.failed} failed.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Synchronization failed.",
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b36f00]">
                Connection
              </p>
              <h2 className="mt-1 text-2xl font-black">CJdropshipping API</h2>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-sm font-black ${
                connected === true
                  ? "bg-emerald-100 text-emerald-700"
                  : connected === false
                    ? "bg-red-100 text-red-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {connected === true
                ? "Connected"
                : connected === false
                  ? "Connection failed"
                  : "Checking..."}
            </span>
          </div>

          <form onSubmit={search} className="mt-6 flex gap-3">
            <input
              required
              minLength={2}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products, for example: wireless earbuds"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#e49b00]"
            />
            <button
              type="submit"
              disabled={searching || connected !== true}
              className="rounded-lg bg-[#ffd814] px-5 py-3 font-black hover:bg-[#f7ca00] disabled:opacity-50"
            >
              {searching ? "Searching..." : "Search CJ"}
            </button>
          </form>
        </div>

        <aside className="rounded-xl bg-[#101820] p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffd814]">
            Automatic pricing
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <label>
              <span className="text-xs text-white/70">TZS per USD</span>
              <input
                type="number"
                min={1}
                value={usdToTzsRate}
                onChange={(event) =>
                  setUsdToTzsRate(Number(event.target.value))
                }
                className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-black"
              />
            </label>

            <label>
              <span className="text-xs text-white/70">Markup %</span>
              <input
                type="number"
                min={0}
                value={marginPercent}
                onChange={(event) =>
                  setMarginPercent(Number(event.target.value))
                }
                className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-black"
              />
            </label>

            <label>
              <span className="text-xs text-white/70">Reserve TZS</span>
              <input
                type="number"
                min={0}
                value={reserveTzs}
                onChange={(event) =>
                  setReserveTzs(Number(event.target.value))
                }
                className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-black"
              />
            </label>
          </div>

          <div className="mt-5 rounded-lg bg-white/10 p-4 text-sm">
            <p>
              Example supplier:{" "}
              <strong>{formatTzs(pricingExample.supplier)}</strong>
            </p>
            <p className="mt-1">
              Example shipping:{" "}
              <strong>{formatTzs(pricingExample.shipping)}</strong>
            </p>
            <p className="mt-1">
              Suggested selling:{" "}
              <strong>{formatTzs(pricingExample.selling)}</strong>
            </p>
            <p className="mt-1 text-emerald-300">
              Estimated profit:{" "}
              <strong>{formatTzs(pricingExample.profit)}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={syncProducts}
            disabled={syncing || connected !== true}
            className="mt-5 w-full rounded-lg border border-white/30 px-4 py-3 text-sm font-black hover:border-white disabled:opacity-50"
          >
            {syncing ? "Synchronizing..." : "Sync Imported CJ Products"}
          </button>
        </aside>
      </section>

      {message && (
        <div className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {importResult && (
        <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h3 className="text-xl font-black text-emerald-800">
            Draft imported successfully
          </h3>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Supplier cost</p>
              <p className="font-black">
                {formatTzs(importResult.supplierCostTzs)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Shipping estimate</p>
              <p className="font-black">
                {formatTzs(importResult.shippingTzs)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Selling price</p>
              <p className="font-black">
                {formatTzs(importResult.sellingPriceTzs)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Estimated profit</p>
              <p className="font-black text-emerald-700">
                {formatTzs(importResult.estimatedProfitTzs)}
              </p>
            </div>
          </div>

          {importResult.warning && (
            <p className="mt-4 rounded-lg bg-amber-100 p-3 text-sm font-semibold text-amber-800">
              {importResult.warning}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/admin/products"
              className="rounded-lg bg-[#101820] px-4 py-2 text-sm font-black text-white"
            >
              Review in Product Control
            </a>
            <a
              href={`/products/${importResult.slug}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black"
            >
              Preview product route
            </a>
          </div>
        </section>
      )}

      <section className="mt-7">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b36f00]">
              CJ catalogue
            </p>
            <h2 className="mt-1 text-3xl font-black">Search results</h2>
          </div>
          <p className="text-sm text-slate-500">{products.length} shown</p>
        </div>

        {products.length === 0 ? (
          <div className="mt-5 rounded-xl bg-white p-8 shadow-sm">
            Search CJ to load products.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => {
              const approximateTzs = product.priceUsd * usdToTzsRate;

              return (
                <article
                  key={product.pid}
                  className="overflow-hidden rounded-xl bg-white shadow-sm"
                >
                  <div className="aspect-square bg-slate-100">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl font-black text-slate-400">
                        CJ
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">
                      {product.category}
                    </p>
                    <h3 className="mt-2 line-clamp-2 text-lg font-black">
                      {product.name}
                    </h3>
                    <p className="mt-2 text-xs text-slate-500">
                      SKU: {product.sku || "Not shown"}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">CJ price</p>
                        <p className="font-black">
                          {formatUsd(product.priceUsd)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">
                          Approx. product cost
                        </p>
                        <p className="font-black">
                          {formatTzs(approximateTzs)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 text-sm text-slate-600">
                      CJ inventory: {product.inventory.toLocaleString("en-US")}
                    </p>
                    {product.deliveryCycle && (
                      <p className="mt-1 text-sm text-slate-600">
                        CJ handling: {product.deliveryCycle} days
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => importProduct(product)}
                      disabled={Boolean(importingPid)}
                      className="mt-5 w-full rounded-full bg-[#ffd814] px-5 py-3 text-sm font-black hover:bg-[#f7ca00] disabled:opacity-50"
                    >
                      {importingPid === product.pid
                        ? "Checking freight and importing..."
                        : "Import as Draft"}
                    </button>
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