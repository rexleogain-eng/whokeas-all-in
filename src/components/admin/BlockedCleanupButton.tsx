"use client";

import { useState } from "react";

type CleanupResponse = {
  ok: boolean;
  error?: string;
  cleanup?: {
    considered: number;
    removed: number;
    archived: number;
    failed: number;
  };
};

export default function BlockedCleanupButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function cleanup() {
    if (
      !window.confirm(
        "Remove CJ products whose current U.S. offer is unavailable or exceeds the 25-day delivery limit? Products used in previous orders will be archived instead of deleted.",
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/catalogue-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanup", limit: 100 }),
      });
      const data = (await response.json()) as CleanupResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Blocked-product cleanup failed.");
      }

      const report = data.cleanup;
      setMessage(
        report
          ? `${report.removed} blocked products removed, ${report.archived} archived for order-history safety, ${report.failed} failed.`
          : "Blocked-product cleanup finished.",
      );

      window.setTimeout(() => window.location.reload(), 1200);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Blocked-product cleanup failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-7 border border-red-200 bg-red-50 p-5 sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-700">
        Catalogue hygiene
      </p>
      <h2 className="mt-1 font-serif text-3xl font-semibold text-[#241d12]">
        Remove definitively blocked CJ products
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-red-950/70">
        This removes active CJ products whose existing U.S. offer is unavailable or whose delivery estimate exceeds 25 days. Missing-offer and pricing-data problems are not deleted because they may still be repairable. Products referenced by an order are archived instead of deleted.
      </p>

      {(message || error) && (
        <div
          className={`mt-4 border px-4 py-3 text-sm font-semibold ${
            error
              ? "border-red-300 bg-white text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {error || message}
        </div>
      )}

      <button
        type="button"
        onClick={cleanup}
        disabled={busy}
        className="mt-5 border border-red-800 bg-red-800 px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Cleaning blocked products…" : "Remove blocked products"}
      </button>
    </section>
  );
}
