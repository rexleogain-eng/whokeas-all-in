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
  return `TZS ${Math.round(value || 0).toLocaleString("en-US")}`;
}

function formatUsd(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

const fieldClass =
  "w-full border border-[#cfc5b5] bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-[#aaa095] focus:border-[#9a7534] focus:ring-2 focus:ring-[#b9944d]/15";

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
          caught instanceof Error ? caught.message : "CJ connection failed.",
        );
      }
    })();
  }, []);

  const pricingExample = useMemo(() => {
    const supplier = 10 * usdToTzsRate;
    const shipping = 5 * usdToTzsRate;
    const selling =
      Math.ceil(
        ((supplier + shipping + reserveTzs) * (1 + marginPercent / 100)) / 500,
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
          ? `${result.products.length} CJ products loaded for review.`
          : "No matching CJ products were found.",
      );
    } catch (caught) {
      setProducts([]);
      setError(caught instanceof Error ? caught.message : "Search failed.");
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
      setMessage(`${result.product.name} was imported into the private draft queue.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
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
        caught instanceof Error ? caught.message : "Synchronization failed.",
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="border border-[#d9d0c1] bg-[#fffdf9] shadow-[0_15px_50px_rgba(54,45,32,0.05)]">
          <div className="flex flex-col gap-4 border-b border-[#e4ddd2] bg-[#faf7f1] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
                Supplier connection
              </p>
              <h2 className="mt-1 font-serif text-3xl font-semibold">CJdropshipping API</h2>
            </div>

            <span
              className={`inline-flex w-fit items-center gap-2 border px-3 py-2 text-[10px] font-black uppercase tracking-[0.13em] ${
                connected === true
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : connected === false
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-[#d8cfbf] bg-[#f7f3eb] text-[#675f55]"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  connected === true
                    ? "bg-emerald-500"
                    : connected === false
                      ? "bg-red-500"
                      : "bg-amber-500"
                }`}
              />
              {connected === true
                ? "Connected"
                : connected === false
                  ? "Connection failed"
                  : "Checking connection"}
            </span>
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-sm leading-6 text-[#746d63]">
              Search CJ&apos;s supplier catalogue, then import only products that meet your brand, margin and fulfilment standards.
            </p>

            <form onSubmit={search} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                required
                minLength={2}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products, for example: wireless earbuds"
                className={fieldClass}
              />
              <button
                type="submit"
                disabled={searching || connected !== true}
                className="border border-[#1b1814] bg-[#1b1814] px-6 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-[#2a251e] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searching ? "Searching..." : "Search CJ"}
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                "portable fan",
                "wireless earbuds",
                "study lamp",
                "phone accessories",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setQuery(suggestion)}
                  className="border border-[#d9d0c1] bg-[#faf7f1] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#675f55] hover:border-[#b9944d]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </article>

        <aside className="border border-[#29241d] bg-[#1a1712] p-5 text-white shadow-[0_15px_50px_rgba(20,16,10,0.12)] sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#d4b56f]">
            Landed-cost model
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold">Pricing discipline</h2>
          <p className="mt-3 text-sm leading-6 text-white/55">
            These values are applied when calculating the draft selling price.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <label>
              <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.15em] text-white/45">TZS per USD</span>
              <input
                type="number"
                min={1}
                value={usdToTzsRate}
                onChange={(event) => setUsdToTzsRate(Number(event.target.value))}
                className="w-full border border-white/15 bg-white/[0.06] px-3 py-3 text-sm text-white outline-none focus:border-[#b9944d]"
              />
            </label>
            <label>
              <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.15em] text-white/45">Markup %</span>
              <input
                type="number"
                min={0}
                value={marginPercent}
                onChange={(event) => setMarginPercent(Number(event.target.value))}
                className="w-full border border-white/15 bg-white/[0.06] px-3 py-3 text-sm text-white outline-none focus:border-[#b9944d]"
              />
            </label>
            <label>
              <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.15em] text-white/45">Reserve TZS</span>
              <input
                type="number"
                min={0}
                value={reserveTzs}
                onChange={(event) => setReserveTzs(Number(event.target.value))}
                className="w-full border border-white/15 bg-white/[0.06] px-3 py-3 text-sm text-white outline-none focus:border-[#b9944d]"
              />
            </label>
          </div>

          <div className="mt-5 border border-white/10 bg-white/[0.04] p-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <p className="text-white/45">Example supplier</p>
              <p className="text-right font-semibold">{formatTzs(pricingExample.supplier)}</p>
              <p className="text-white/45">Example shipping</p>
              <p className="text-right font-semibold">{formatTzs(pricingExample.shipping)}</p>
              <p className="text-white/45">Suggested selling</p>
              <p className="text-right font-semibold">{formatTzs(pricingExample.selling)}</p>
              <p className="text-[#d4b56f]">Estimated profit</p>
              <p className="text-right font-semibold text-[#d4b56f]">{formatTzs(pricingExample.profit)}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={syncProducts}
            disabled={syncing || connected !== true}
            className="mt-5 w-full border border-[#b9944d] px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-[#e0c486] transition hover:bg-[#b9944d] hover:text-[#171410] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing ? "Synchronizing catalogue..." : "Synchronize imported products"}
          </button>
        </aside>
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

      {importResult && (
        <section className="mt-6 border border-emerald-200 bg-[#f4fbf6] p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">Draft imported successfully</p>
              <h3 className="mt-2 font-serif text-3xl font-semibold text-emerald-950">{importResult.name}</h3>
              <p className="mt-2 text-sm text-emerald-800/70">
                The product remains private until you review and activate it.
              </p>
            </div>
            <span className="w-fit border border-emerald-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.13em] text-emerald-800">
              {importResult.variants} variants
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Supplier cost", formatTzs(importResult.supplierCostTzs)],
              ["Shipping estimate", formatTzs(importResult.shippingTzs)],
              ["Selling price", formatTzs(importResult.sellingPriceTzs)],
              ["Estimated profit", formatTzs(importResult.estimatedProfitTzs)],
            ].map(([label, value]) => (
              <div key={label} className="border border-emerald-200 bg-white p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-700/70">{label}</p>
                <p className="mt-2 font-serif text-xl font-semibold text-emerald-950">{value}</p>
              </div>
            ))}
          </div>

          {importResult.warning && (
            <p className="mt-4 border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              {importResult.warning}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href="/admin/products"
              className="border border-[#1b1814] bg-[#1b1814] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-white"
            >
              Review in Product Control
            </a>
            <a
              href={`/products/${importResult.slug}`}
              target="_blank"
              rel="noreferrer"
              className="border border-[#cfc5b5] bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#4e473e]"
            >
              Preview route
            </a>
          </div>
        </section>
      )}

      <section className="mt-7">
        <div className="flex flex-col gap-3 border-b border-[#cfc5b5] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">Supplier catalogue</p>
            <h2 className="mt-1 font-serif text-3xl font-semibold">Search results</h2>
          </div>
          <p className="text-sm text-[#746d63]">{products.length} products available for review</p>
        </div>

        {products.length === 0 ? (
          <div className="mt-4 border border-dashed border-[#cabfae] bg-[#fffdf9] p-12 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">No supplier results loaded</p>
            <h3 className="mt-3 font-serif text-3xl font-semibold">Begin with a focused product search</h3>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#746d63]">
              Search for one practical product category, compare the supplier cost and import only the strongest option.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {products.map((product) => {
              const approximateTzs = product.priceUsd * usdToTzsRate;

              return (
                <article
                  key={product.pid}
                  className="overflow-hidden border border-[#d9d0c1] bg-[#fffdf9] shadow-[0_10px_35px_rgba(54,45,32,0.04)]"
                >
                  <div className="aspect-square bg-[#eee8dd]">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center font-serif text-5xl text-[#9e9486]">CJ</div>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9a7534]">
                        {product.category || "General"}
                      </p>
                      <span className="border border-[#d8cfbf] bg-[#f7f3eb] px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#675f55]">
                        {product.inventory.toLocaleString("en-US")} in stock
                      </span>
                    </div>
                    <h3 className="mt-3 line-clamp-2 font-serif text-2xl font-semibold leading-tight">{product.name}</h3>
                    <p className="mt-2 truncate text-xs text-[#827a70]">SKU: {product.sku || "Not supplied"}</p>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="border border-[#e1d9cd] bg-[#faf7f1] p-3">
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#8c8377]">CJ price</p>
                        <p className="mt-2 font-serif text-xl font-semibold">{formatUsd(product.priceUsd)}</p>
                      </div>
                      <div className="border border-[#e1d9cd] bg-[#faf7f1] p-3">
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#8c8377]">Approx. TZS</p>
                        <p className="mt-2 font-serif text-xl font-semibold">{formatTzs(approximateTzs)}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-1 text-xs text-[#746d63]">
                      <p>Supplier: {product.supplierName || "CJdropshipping"}</p>
                      {product.deliveryCycle && <p>CJ handling: {product.deliveryCycle} days</p>}
                    </div>

                    <button
                      type="button"
                      onClick={() => importProduct(product)}
                      disabled={Boolean(importingPid)}
                      className="mt-5 w-full border border-[#b9944d] bg-[#b9944d] px-5 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-[#171410] transition hover:bg-[#c8a75f] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {importingPid === product.pid
                        ? "Reviewing freight and importing..."
                        : "Import to private draft queue"}
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
