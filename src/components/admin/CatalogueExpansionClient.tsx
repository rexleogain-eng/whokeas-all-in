"use client";

import { readApiResponse } from "@/lib/read-api-response";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

import type {
  CatalogueExpansionConfig,
  CatalogueExpansionDashboard,
} from "@/lib/catalogue-expansion";

type Props = {
  initialData: CatalogueExpansionDashboard;
};

const fieldClass =
  "w-full border border-[#cfc5b5] bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[#9a7534] focus:ring-2 focus:ring-[#b9944d]/15";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-TZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "published") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "draft") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "processing") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "queued") return "border-[#d8cfbf] bg-[#f7f3eb] text-[#675f55]";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function CatalogueExpansionClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [config, setConfig] = useState(initialData.config);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const stopRequested = useRef(false);

  async function requestJson(url: string, init?: RequestInit) {
    const response = await fetch(url, {
      cache: "no-store",
      ...init,
    });
    const result = await readApiResponse(response);
    if (!response.ok || !result.ok) {
      throw new Error(
        result.report?.message || result.error || "The operation failed.",
      );
    }
    return result;
  }

  async function refresh() {
    const result = await requestJson("/api/admin/catalogue-expansion");
    const next: CatalogueExpansionDashboard = {
      config: result.config,
      stats: result.stats,
      categoryProgress: result.categoryProgress,
      queue: result.queue,
      runs: result.runs,
    };
    setData(next);
    setConfig(next.config);
    return next;
  }

  async function saveSettings(silent = false) {
    if (!silent) setBusy("save");
    setError("");
    if (!silent) setMessage("");

    try {
      const result = await requestJson("/api/admin/catalogue-expansion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      setConfig(result.config);
      if (!silent) setMessage("Catalogue expansion settings saved.");
      await refresh();
    } finally {
      if (!silent) setBusy(null);
    }
  }

  async function runAction(
    key: string,
    url: string,
    successMessage: (result: any) => string,
    body?: unknown,
  ) {
    setBusy(key);
    setMessage("");
    setError("");

    try {
      const result = await requestJson(url, {
        method: "POST",
        ...(body !== undefined
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
      });
      setMessage(successMessage(result));
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Operation failed.");
    } finally {
      setBusy(null);
    }
  }

  async function runSafeFill() {
    setBusy("fill");
    setMessage("");
    setError("");
    stopRequested.current = false;

    try {
      await saveSettings(true);
      let current = await refresh();
      let imported = 0;
      let cycles = 0;

      if (current.stats.trialCandidates > 0) {
        const cleanup = await requestJson(
          "/api/admin/catalogue-expansion/cleanup",
          { method: "POST" },
        );
        setMessage(
          `Cleaned ${cleanup.report.deleted} trial products; preparing the real catalogue.`,
        );
        current = await refresh();
      }

      while (
        !stopRequested.current &&
        current.stats.realSupplierProducts < current.stats.targetTotal &&
        cycles < 6
      ) {
        if (current.stats.queued < Math.max(2, config.processBatchSize)) {
          const discovery = await requestJson(
            "/api/admin/catalogue-expansion/discover",
            { method: "POST" },
          );
          setMessage(
            `Discovery cycle ${cycles + 1}: ${discovery.report.queued} candidates queued.`,
          );
          await sleep(3500);
          current = await refresh();
        }

        if (current.stats.queued === 0) break;

        const process = await requestJson(
          "/api/admin/catalogue-expansion/process",
          { method: "POST" },
        );
        imported += Number(process.report.processed || 0);
        cycles += 1;
        setMessage(
          `Safe cycle ${cycles}/6: ${imported} products imported in this session. Waiting before the next CJ request group…`,
        );
        await sleep(5000);
        current = await refresh();
      }

      setMessage(
        stopRequested.current
          ? `Safe fill stopped after importing ${imported} products.`
          : `Safe fill completed: ${imported} products imported this session. The scheduled queue will continue automatically.`,
      );
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Safe catalogue fill failed.",
      );
    } finally {
      setBusy(null);
      stopRequested.current = false;
    }
  }

  function updateConfig<K extends keyof CatalogueExpansionConfig>(
    key: K,
    value: CatalogueExpansionConfig[K],
  ) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function updateTarget(index: number, patch: Record<string, unknown>) {
    setConfig((current) => ({
      ...current,
      targets: current.targets.map((target, targetIndex) =>
        targetIndex === index ? { ...target, ...patch } : target,
      ),
    }));
  }

  const cards = [
    {
      label: "Real supplier products",
      value: data.stats.realSupplierProducts,
      note: `${data.stats.completionPercent}% of ${data.stats.targetTotal} target`,
    },
    {
      label: "Safe queue",
      value: data.stats.queued,
      note: `${data.stats.processing} currently processing`,
    },
    {
      label: "Imported today",
      value: data.stats.importedToday,
      note: `${data.stats.published} published by this engine`,
    },
    {
      label: "Needs attention",
      value: data.stats.failed + data.stats.retainedDrafts,
      note: `${data.stats.retainedDrafts} drafts · ${data.stats.failed} failed`,
    },
  ];

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
        {cards.map((card, index) => (
          <article
            key={card.label}
            className="border border-[#d9d0c1] bg-[#fffdf9] p-5 shadow-[0_12px_40px_rgba(54,45,32,0.05)]"
          >
            <div className="flex items-start justify-between gap-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8e7650]">
                {card.label}
              </p>
              <span className="font-serif text-lg text-[#b9944d]">
                0{index + 1}
              </span>
            </div>
            <p className="mt-5 font-serif text-4xl font-semibold leading-none">
              {card.value}
            </p>
            <p className="mt-3 text-xs leading-5 text-[#746d63]">
              {card.note}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="border border-[#d9d0c1] bg-[#fffdf9] p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
            Safe catalogue fill
          </p>
          <h2 className="mt-1 font-serif text-3xl font-semibold">
            Build a real catalogue in controlled batches
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#746d63]">
            Requests are serialized, throttling is retried with backoff, exact
            freight checks are limited, duplicates are rejected and each
            browser session stops after six short import cycles.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={runSafeFill}
              disabled={Boolean(busy) || config.paused}
              className="border border-[#1b1814] bg-[#1b1814] px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "fill" ? "Filling safely…" : "Fill store safely"}
            </button>
            <button
              type="button"
              onClick={() =>
                runAction(
                  "discover",
                  "/api/admin/catalogue-expansion/discover",
                  (result) => result.report.message,
                )
              }
              disabled={Boolean(busy) || config.paused}
              className="border border-[#b9944d] bg-[#b9944d] px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-[#171410] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "discover" ? "Discovering…" : "Discover candidates"}
            </button>
            <button
              type="button"
              onClick={() =>
                runAction(
                  "process",
                  "/api/admin/catalogue-expansion/process",
                  (result) => result.report.message,
                )
              }
              disabled={Boolean(busy) || config.paused}
              className="border border-[#2a261f] bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-[#2a261f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "process" ? "Importing…" : "Process next batch"}
            </button>
            {busy === "fill" ? (
              <button
                type="button"
                onClick={() => {
                  stopRequested.current = true;
                  setMessage("Stopping after the current product finishes…");
                }}
                className="border border-red-300 bg-red-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-red-800"
              >
                Stop safely
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  runAction(
                    "pause",
                    "/api/admin/catalogue-expansion/pause",
                    () =>
                      config.paused
                        ? "Catalogue expansion resumed."
                        : "Catalogue expansion paused.",
                    { paused: !config.paused },
                  )
                }
                disabled={Boolean(busy)}
                className="border border-[#cfc5b5] bg-[#f7f3eb] px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-[#4e473e] disabled:opacity-50"
              >
                {config.paused ? "Resume automation" : "Pause automation"}
              </button>
            )}
          </div>
        </article>

        <aside className="border border-[#2b271f] bg-[#1a1712] p-6 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#d4b56f]">
            Trial catalogue cleaner
          </p>
          <p className="mt-4 font-serif text-5xl font-semibold">
            {data.stats.trialCandidates}
          </p>
          <p className="mt-3 text-sm leading-6 text-white/65">
            Original design products still eligible for removal. Products used
            by an order are archived instead of deleted.
          </p>
          <button
            type="button"
            onClick={() => {
              if (
                !window.confirm(
                  "Remove the six original WHOKEAS design-trial products? Real supplier products will not be touched.",
                )
              ) {
                return;
              }
              runAction(
                "cleanup",
                "/api/admin/catalogue-expansion/cleanup",
                (result) =>
                  `${result.report.deleted} trial products deleted and ${result.report.archived} archived.`,
              );
            }}
            disabled={Boolean(busy) || data.stats.trialCandidates === 0}
            className="mt-6 w-full border border-[#d4b56f] px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-[#f1d99f] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "cleanup" ? "Cleaning…" : "Clean trial products"}
          </button>
        </aside>
      </section>

      <section className="border border-[#d9d0c1] bg-[#fffdf9]">
        <div className="border-b border-[#e4ddd2] bg-[#faf7f1] px-5 py-5 sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
            Category targets
          </p>
          <h2 className="mt-1 font-serif text-3xl font-semibold">
            Balanced international catalogue
          </h2>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3 sm:p-6">
          {data.categoryProgress.map((item) => {
            const percent = Math.min(
              100,
              Math.round((item.current / Math.max(1, item.target)) * 100),
            );
            return (
              <article key={item.key} className="border border-[#e0d8cc] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-serif text-xl font-semibold">
                      {item.category}
                    </p>
                    <p className="mt-1 text-xs text-[#7a7166]">
                      {item.active} live · {item.drafts} drafts · {item.queued} queued
                    </p>
                  </div>
                  <span className="text-sm font-black text-[#8a6a31]">
                    {item.current}/{item.target}
                  </span>
                </div>
                <div className="mt-4 h-2 bg-[#eee8dd]">
                  <div
                    className="h-full bg-[#b9944d]"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#857b6e]">
                  {item.remaining} remaining
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border border-[#d9d0c1] bg-[#fffdf9]">
        <div className="border-b border-[#e4ddd2] bg-[#faf7f1] px-5 py-5 sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
            Guardrails
          </p>
          <h2 className="mt-1 font-serif text-3xl font-semibold">
            Expansion settings
          </h2>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
          <label>
            <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.14em] text-[#8a8073]">
              Total real-product target
            </span>
            <input
              type="number"
              min={20}
              max={3000}
              value={config.targetTotal}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateConfig("targetTotal", Number(event.target.value))
              }
              className={fieldClass}
            />
          </label>
          <label>
            <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.14em] text-[#8a8073]">
              Products per safe API job
            </span>
            <input
              type="number"
              min={1}
              max={3}
              value={config.processBatchSize}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateConfig("processBatchSize", Number(event.target.value))
              }
              className={fieldClass}
            />
          </label>
          <label>
            <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.14em] text-[#8a8073]">
              Minimum stock
            </span>
            <input
              type="number"
              min={0}
              value={config.minimumInventory}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateConfig("minimumInventory", Number(event.target.value))
              }
              className={fieldClass}
            />
          </label>
          <label>
            <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.14em] text-[#8a8073]">
              Minimum quality score
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={config.minimumScore}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateConfig("minimumScore", Number(event.target.value))
              }
              className={fieldClass}
            />
          </label>
          <label>
            <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.14em] text-[#8a8073]">
              Required images
            </span>
            <input
              type="number"
              min={1}
              max={10}
              value={config.minimumImages}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateConfig("minimumImages", Number(event.target.value))
              }
              className={fieldClass}
            />
          </label>
          <label>
            <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.14em] text-[#8a8073]">
              Exact freight markets/import
            </span>
            <input
              type="number"
              min={1}
              max={4}
              value={config.exactFreightMarketsPerImport}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateConfig(
                  "exactFreightMarketsPerImport",
                  Number(event.target.value),
                )
              }
              className={fieldClass}
            />
          </label>
          <label>
            <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.14em] text-[#8a8073]">
              Delay between products (ms)
            </span>
            <input
              type="number"
              min={1000}
              max={15000}
              step={100}
              value={config.delayBetweenProductsMs}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateConfig(
                  "delayBetweenProductsMs",
                  Number(event.target.value),
                )
              }
              className={fieldClass}
            />
          </label>
          <label className="flex items-center gap-3 border border-[#ded6ca] bg-[#faf7f1] px-4 py-3">
            <input
              type="checkbox"
              checked={config.autoPublish}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateConfig("autoPublish", event.target.checked)
              }
              className="h-4 w-4 accent-[#9a7534]"
            />
            <span>
              <span className="block text-xs font-black uppercase tracking-[0.12em]">
                Auto-publish qualified products
              </span>
              <span className="mt-1 block text-xs text-[#766e63]">
                Products failing a gate remain drafts.
              </span>
            </span>
          </label>
        </div>

        <div className="border-t border-[#e4ddd2] p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {config.targets.map((target, index) => (
              <div
                key={target.key}
                className="grid grid-cols-[auto_1fr_90px] items-center gap-3 border border-[#e0d8cc] p-3"
              >
                <input
                  type="checkbox"
                  checked={target.enabled}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateTarget(index, { enabled: event.target.checked })
                  }
                  className="h-4 w-4 accent-[#9a7534]"
                />
                <span className="font-semibold">{target.category}</span>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={target.target}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    updateTarget(index, { target: Number(event.target.value) })
                  }
                  className={fieldClass}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              saveSettings().catch((caught) => {
                setError(
                  caught instanceof Error
                    ? caught.message
                    : "Could not save settings.",
                );
                setBusy(null);
              })
            }
            disabled={Boolean(busy)}
            className="mt-5 border border-[#1b1814] bg-[#1b1814] px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white disabled:opacity-50"
          >
            {busy === "save" ? "Saving…" : "Save expansion settings"}
          </button>
        </div>
      </section>

      <section className="border border-[#d9d0c1] bg-[#fffdf9]">
        <div className="flex flex-col gap-3 border-b border-[#e4ddd2] bg-[#faf7f1] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
              Import queue
            </p>
            <h2 className="mt-1 font-serif text-3xl font-semibold">
              Products moving into the store
            </h2>
          </div>
          <button
            type="button"
            onClick={() =>
              runAction(
                "retry",
                "/api/admin/catalogue-expansion/retry-failed",
                (result) => `${result.report.reset} failed items returned to the queue.`,
              )
            }
            disabled={Boolean(busy) || data.stats.failed === 0}
            className="border border-[#cfc5b5] bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#4e473e] disabled:opacity-40"
          >
            Retry eligible failures
          </button>
        </div>

        {data.queue.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[#746d63]">
            The queue is empty. Start discovery to find real CJ products.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full text-left text-sm">
              <thead className="border-b border-[#e4ddd2] bg-[#faf8f3] text-[9px] font-black uppercase tracking-[0.14em] text-[#7c7266]">
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece5da]">
                {data.queue.map((item) => (
                  <tr key={item.id}>
                    <td className="max-w-[390px] px-5 py-4">
                      <p className="font-semibold leading-5">{item.name}</p>
                      <p className="mt-1 truncate text-[10px] text-[#8a8175]">
                        CJ {item.pid}
                      </p>
                      {item.reason && (
                        <p className="mt-2 text-xs leading-5 text-red-700">
                          {item.reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">{item.category}</td>
                    <td className="px-4 py-4 font-semibold">{item.score}</td>
                    <td className="px-4 py-4">{item.inventory}</td>
                    <td className="px-4 py-4">${item.priceUsd.toFixed(2)}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${statusClass(item.status)}`}
                      >
                        {item.status}
                      </span>
                      {item.attempts > 0 && (
                        <p className="mt-1 text-[10px] text-[#837a6f]">
                          Attempt {item.attempts}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-[#756d62]">
                      {formatDate(item.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
