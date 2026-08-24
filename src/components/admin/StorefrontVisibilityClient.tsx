"use client";

import { useState } from "react";

import type {
  StorefrontCatalogHealth,
  StorefrontRepairReport,
} from "@/lib/storefront-catalog-health";

type Props = {
  initialHealth: StorefrontCatalogHealth;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  health?: StorefrontCatalogHealth;
  report?: StorefrontRepairReport;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pct(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

export default function StorefrontVisibilityClient({ initialHealth }: Props) {
  const [health, setHealth] = useState(initialHealth);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function readResponse(response: Response) {
    const data = (await response.json()) as ApiResponse;
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "The storefront catalogue request failed.");
    }
    return data;
  }

  async function refresh() {
    const response = await fetch("/api/admin/catalogue-visibility", {
      cache: "no-store",
    });
    const data = await readResponse(response);
    if (data.health) setHealth(data.health);
  }

  async function repairSession() {
    setBusy(true);
    setMessage("");
    setError("");

    let attempted = 0;
    let repaired = 0;
    let hidden = 0;
    let drafted = 0;
    let failed = 0;

    try {
      for (let cycle = 1; cycle <= 4; cycle += 1) {
        if (cycle > 1) await sleep(3500);

        const response = await fetch("/api/admin/catalogue-visibility", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 5 }),
        });
        const data = await readResponse(response);
        const report = data.report;
        if (data.health) setHealth(data.health);
        if (!report) break;

        attempted += report.attempted;
        repaired += report.repaired;
        hidden += report.stillHidden;
        drafted += report.drafted;
        failed += report.failed;

        setMessage(
          `Repair cycle ${cycle}/4: ${repaired} products restored to the storefront from ${attempted} checked.`,
        );

        if (report.attempted === 0 || report.attempted < 5 || failed > 0) {
          break;
        }
      }

      await refresh();
      setMessage(
        `Storefront repair finished: ${repaired} restored, ${hidden} still safely hidden, ${drafted} moved to draft, ${failed} failed checks.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Storefront repair failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  const visiblePercent = pct(
    health.supplierEligible,
    health.activeSupplierProducts,
  );
  const reasons = [
    ["Missing U.S. offer", health.missingUsOffer],
    ["U.S. shipping unavailable", health.unavailableUsOffer],
    ["Invalid USD selling price", health.invalidUsdPrice],
    [`Delivery over 25 days`, health.slowUsDelivery],
  ] as const;

  return (
    <div className="space-y-7">
      {(message || error) && (
        <div
          className={`border px-5 py-4 text-sm font-semibold ${
            error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {error || message}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="border border-[#d9d0c1] bg-[#fffdf9] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8e7650]">
            Customer-visible
          </p>
          <p className="mt-5 font-serif text-4xl font-semibold">
            {health.storefrontEligible}
          </p>
          <p className="mt-3 text-xs leading-5 text-[#746d63]">
            Products that currently pass the exact storefront rules.
          </p>
        </article>

        <article className="border border-[#d9d0c1] bg-[#fffdf9] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8e7650]">
            Active supplier products
          </p>
          <p className="mt-5 font-serif text-4xl font-semibold">
            {health.activeSupplierProducts}
          </p>
          <p className="mt-3 text-xs leading-5 text-[#746d63]">
            {health.supplierEligible} visible · {visiblePercent}% storefront coverage
          </p>
        </article>

        <article className="border border-[#d9d0c1] bg-[#fffdf9] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8e7650]">
            Hidden active
          </p>
          <p className="mt-5 font-serif text-4xl font-semibold">
            {health.hiddenActiveSupplierProducts}
          </p>
          <p className="mt-3 text-xs leading-5 text-[#746d63]">
            Active supplier records that are intentionally blocked from customers.
          </p>
        </article>

        <article className="border border-[#2b271f] bg-[#1a1712] p-5 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d4b56f]">
            Repairable now
          </p>
          <p className="mt-5 font-serif text-4xl font-semibold">
            {health.repairable}
          </p>
          <p className="mt-3 text-xs leading-5 text-white/65">
            Hidden CJ products with enough supplier identity to run a fresh U.S. check.
          </p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="border border-[#d9d0c1] bg-[#fffdf9] p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
            Visibility blockers
          </p>
          <h2 className="mt-1 font-serif text-3xl font-semibold">
            Why published products stay off the customer page
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {reasons.map(([label, value]) => (
              <div key={label} className="border border-[#e0d8cc] bg-[#faf7f1] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#7c7266]">
                  {label}
                </p>
                <p className="mt-3 font-serif text-3xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs leading-5 text-[#746d63]">
            These reasons are mutually exclusive, so the four figures describe the hidden active supplier backlog without double-counting.
          </p>
        </article>

        <aside className="border border-[#d6c49a] bg-[#f4ead3] p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#76581f]">
            Safe U.S. repair
          </p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-[#241d12]">
            Re-check up to 20 hidden products
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#665532]">
            Each product is refreshed from CJ, gets a fresh exact U.S. freight check and remains hidden if price, availability or delivery still fails the store rules.
          </p>

          <button
            type="button"
            onClick={repairSession}
            disabled={busy || health.repairable === 0}
            className="mt-6 w-full border border-[#1b1814] bg-[#1b1814] px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? "Repairing safely…" : "Repair hidden products"}
          </button>

          <button
            type="button"
            onClick={() => refresh().catch((caught) => setError(caught instanceof Error ? caught.message : "Refresh failed."))}
            disabled={busy}
            className="mt-3 w-full border border-[#8a6a31] bg-transparent px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-[#4a3515] disabled:opacity-45"
          >
            Refresh audit
          </button>

          <div className="mt-6 border-t border-[#d6c49a] pt-4 text-xs leading-5 text-[#665532]">
            <p>{health.eligibleWithExactFreight} visible products use exact freight data.</p>
            <p>{health.eligibleWithEstimatedFreight} visible products currently use an estimated freight record.</p>
          </div>
        </aside>
      </section>
    </div>
  );
}
