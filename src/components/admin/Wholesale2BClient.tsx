"use client";

import { useState } from "react";
import type { Wholesale2BStatus } from "@/lib/wholesale2b";

type Props = { initialStatus: Wholesale2BStatus };

type ImportResponse = {
  ok: boolean;
  error?: string;
  report?: {
    message: string;
    imported: number;
    published: number;
    drafts: number;
    duplicates: number;
    skipped: number;
    failed: number;
  };
};

export default function Wholesale2BClient({ initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const response = await fetch("/api/admin/wholesale2b/status", { cache: "no-store" });
    const result = await response.json();
    if (response.ok && result.ok) setStatus(result.status);
  }

  async function importBatch() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/wholesale2b/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const result = (await response.json()) as ImportResponse;
      if (!response.ok || !result.ok) throw new Error(result.error || "Wholesale2B import failed.");
      setMessage(result.report?.message || "Wholesale2B import completed.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Wholesale2B import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {(message || error) && (
        <div className={`border px-5 py-4 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {error || message}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="border border-[#d9d0c1] bg-[#fffdf9] p-5"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8e7650]">Connection</p><p className="mt-4 font-serif text-3xl font-semibold">{status.configured ? "Ready" : "Not configured"}</p></article>
        <article className="border border-[#d9d0c1] bg-[#fffdf9] p-5"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8e7650]">Imported</p><p className="mt-4 font-serif text-3xl font-semibold">{status.importedProducts}</p></article>
        <article className="border border-[#d9d0c1] bg-[#fffdf9] p-5"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8e7650]">Live</p><p className="mt-4 font-serif text-3xl font-semibold">{status.activeProducts}</p></article>
        <article className="border border-[#d9d0c1] bg-[#fffdf9] p-5"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8e7650]">Drafts</p><p className="mt-4 font-serif text-3xl font-semibold">{status.drafts}</p></article>
      </section>

      <section className="border border-[#d9d0c1] bg-[#fffdf9] p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">Wholesale2B source</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold">U.S. supplier catalogue</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#746d63]">
          WHOKEAS accepts a private Wholesale2B CSV feed through WHOLESALE2B_FEED_URL. Products are deduplicated, priced with the existing U.S. margin rules, checked for stock and Merchant Center image quality, and kept separate from CJ records.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.12em]">
          <span className="border border-[#d8cfbf] px-3 py-2">Feed: {status.feedConfigured ? "configured" : "missing"}</span>
          <span className="border border-[#d8cfbf] px-3 py-2">API: {status.apiConfigured ? "configured" : "pending plan credentials"}</span>
        </div>
        <button
          type="button"
          disabled={!status.feedConfigured || busy}
          onClick={importBatch}
          className="mt-6 border border-[#1b1814] bg-[#1b1814] px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Importing…" : "Import 10 safe products"}
        </button>
        {!status.feedConfigured && (
          <p className="mt-4 text-sm text-[#8a5d2b]">Add the private feed URL to Vercel as WHOLESALE2B_FEED_URL after activating the Wholesale2B Data/API plan. Do not paste the private URL or API key into chat.</p>
        )}
      </section>
    </div>
  );
}
