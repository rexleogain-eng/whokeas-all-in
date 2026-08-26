"use client";

import { useEffect, useMemo, useState } from "react";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  currentPriceUsd: number;
  landedCostUsd: number;
  sourceCount: number;
  benchmarkMedianUsd: number | null;
  benchmarkLowUsd: number | null;
  benchmarkHighUsd: number | null;
  baselinePriceUsd: number;
  safeFloorPriceUsd: number;
  recommendedPriceUsd: number;
  decision: "baseline" | "beat-market" | "margin-floor";
};

type Dashboard = {
  policy: {
    baselineMarginPercent: number;
    minimumSafeMarginPercent: number;
    targetDiscountPercent: number;
    benchmarkFreshnessDays: number;
    rule: string;
  };
  products: ProductRow[];
  lastRun: null | {
    trigger: string;
    productsChecked: number;
    productsRepriced: number;
    productsAtFloor: number;
    totalPriceReductionUsd: number;
    createdAt: string;
  };
};

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(2)}`;
}

function statusLabel(decision: ProductRow["decision"]) {
  if (decision === "beat-market") return "Market matched";
  if (decision === "margin-floor") return "Margin floor";
  return "15% baseline";
}

export default function CompetitivePricingClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    productId: "",
    sourceName: "",
    sourceUrl: "",
    priceUsd: "",
    shippingUsd: "0",
  });

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/competitive-pricing", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Could not load pricing data.");
      }
      setDashboard(data.dashboard as Dashboard);
      setForm((current) => ({
        ...current,
        productId: current.productId || data.dashboard.products?.[0]?.id || "",
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load pricing data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    const products = dashboard?.products || [];
    return {
      tracked: products.filter((product) => product.sourceCount > 0).length,
      marketAdjusted: products.filter((product) => product.decision === "beat-market").length,
      floor: products.filter((product) => product.decision === "margin-floor").length,
    };
  }, [dashboard]);

  async function runReprice() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/competitive-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reprice" }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Repricing failed.");
      }
      setMessage(
        `Checked ${data.report.checked} products and repriced ${data.report.repriced}. Total reduction this run: $${Number(data.report.totalReductionUsd || 0).toFixed(2)}.`,
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Repricing failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addBenchmark(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/competitive-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record",
          productId: form.productId,
          sourceName: form.sourceName,
          sourceUrl: form.sourceUrl,
          priceUsd: Number(form.priceUsd),
          shippingUsd: Number(form.shippingUsd || 0),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Could not save competitor benchmark.");
      }
      setMessage("Competitor benchmark saved and that product was repriced immediately.");
      setForm((current) => ({
        ...current,
        sourceName: "",
        sourceUrl: "",
        priceUsd: "",
        shippingUsd: "0",
      }));
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save competitor benchmark.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="border border-[#d9d0c1] bg-[#fffdf9] p-8 text-sm text-[#746d63]">
        Loading competitive pricing engine…
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {message && (
        <div className="border border-[#cbb78e] bg-[#fff8e8] px-4 py-3 text-sm text-[#5d4b28]">
          {message}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Benchmarked products", String(summary.tracked), "Fresh competitor references"],
          ["Market-priced", String(summary.marketAdjusted), "Priced below competitor median"],
          ["Protected floor", String(summary.floor), "Would otherwise cut margin too far"],
        ].map(([label, value, note]) => (
          <article key={label} className="border border-[#d9d0c1] bg-[#fffdf9] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8e7650]">
              {label}
            </p>
            <p className="mt-4 font-serif text-3xl font-semibold">{value}</p>
            <p className="mt-2 text-xs text-[#746d63]">{note}</p>
          </article>
        ))}
      </section>

      {dashboard && (
        <section className="border border-[#2a261f] bg-[#191713] p-6 text-white">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d4b56f]">
                Pricing guardrails
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold">
                Competitive without racing to zero.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
                {dashboard.policy.rule}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void runReprice()}
              disabled={busy}
              className="border border-[#d4b56f] bg-[#d4b56f] px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#191713] disabled:opacity-50"
            >
              {busy ? "Working…" : "Reprice all now"}
            </button>
          </div>
          <div className="mt-6 grid gap-3 text-xs sm:grid-cols-4">
            <div className="border border-white/10 p-3">Baseline margin · {dashboard.policy.baselineMarginPercent}%</div>
            <div className="border border-white/10 p-3">Safe floor · {dashboard.policy.minimumSafeMarginPercent}%</div>
            <div className="border border-white/10 p-3">Target · {dashboard.policy.targetDiscountPercent}% below median</div>
            <div className="border border-white/10 p-3">Freshness · {dashboard.policy.benchmarkFreshnessDays} days</div>
          </div>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.45fr_.75fr]">
        <div className="overflow-hidden border border-[#d9d0c1] bg-[#fffdf9]">
          <div className="border-b border-[#e4ddd2] px-5 py-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
              Product price map
            </p>
            <h2 className="mt-1 font-serif text-2xl font-semibold">Current market position</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[940px] w-full text-left text-sm">
              <thead className="bg-[#f4efe7] text-[10px] uppercase tracking-[0.15em] text-[#756a5b]">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Current</th>
                  <th className="px-4 py-3">15% base</th>
                  <th className="px-4 py-3">Competitor median</th>
                  <th className="px-4 py-3">Safe floor</th>
                  <th className="px-4 py-3">Recommended</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece5da]">
                {(dashboard?.products || []).map((product) => (
                  <tr key={product.id}>
                    <td className="max-w-[310px] px-4 py-4">
                      <p className="font-semibold leading-5">{product.name}</p>
                      <p className="mt-1 text-xs text-[#8a8176]">{product.sourceCount} tracked source{product.sourceCount === 1 ? "" : "s"}</p>
                    </td>
                    <td className="px-4 py-4 font-semibold">{money(product.currentPriceUsd)}</td>
                    <td className="px-4 py-4">{money(product.baselinePriceUsd)}</td>
                    <td className="px-4 py-4">{money(product.benchmarkMedianUsd)}</td>
                    <td className="px-4 py-4">{money(product.safeFloorPriceUsd)}</td>
                    <td className="px-4 py-4 font-semibold text-[#6d552b]">{money(product.recommendedPriceUsd)}</td>
                    <td className="px-4 py-4">
                      <span className="whitespace-nowrap border border-[#d5c7ad] bg-[#f8f2e6] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#6d552b]">
                        {statusLabel(product.decision)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <form onSubmit={addBenchmark} className="h-fit border border-[#d9d0c1] bg-[#fffdf9] p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
            Add market evidence
          </p>
          <h2 className="mt-2 font-serif text-2xl font-semibold">Track a competitor price</h2>
          <p className="mt-2 text-xs leading-6 text-[#746d63]">
            Add a matching U.S. retail listing. The product is repriced immediately using the safe pricing guardrails.
          </p>

          <label className="mt-5 block text-xs font-bold uppercase tracking-[0.1em] text-[#665d52]">
            Product
          </label>
          <select
            value={form.productId}
            onChange={(event) => setForm({ ...form, productId: event.target.value })}
            required
            className="mt-2 w-full border border-[#cfc5b5] bg-white px-3 py-3 text-sm"
          >
            {(dashboard?.products || []).map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>

          <label className="mt-4 block text-xs font-bold uppercase tracking-[0.1em] text-[#665d52]">Retailer</label>
          <input
            value={form.sourceName}
            onChange={(event) => setForm({ ...form, sourceName: event.target.value })}
            required
            placeholder="Walmart, Target, eBay…"
            className="mt-2 w-full border border-[#cfc5b5] bg-white px-3 py-3 text-sm"
          />

          <label className="mt-4 block text-xs font-bold uppercase tracking-[0.1em] text-[#665d52]">Listing URL</label>
          <input
            type="url"
            value={form.sourceUrl}
            onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })}
            required
            placeholder="https://…"
            className="mt-2 w-full border border-[#cfc5b5] bg-white px-3 py-3 text-sm"
          />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.1em] text-[#665d52]">Price USD</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.priceUsd}
                onChange={(event) => setForm({ ...form, priceUsd: event.target.value })}
                required
                className="mt-2 w-full border border-[#cfc5b5] bg-white px-3 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.1em] text-[#665d52]">Shipping</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.shippingUsd}
                onChange={(event) => setForm({ ...form, shippingUsd: event.target.value })}
                className="mt-2 w-full border border-[#cfc5b5] bg-white px-3 py-3 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full border border-[#2a261f] bg-[#2a261f] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save benchmark & reprice"}
          </button>
        </form>
      </section>
    </div>
  );
}
