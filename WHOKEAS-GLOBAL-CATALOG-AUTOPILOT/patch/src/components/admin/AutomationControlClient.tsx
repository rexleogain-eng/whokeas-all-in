"use client";

import { useMemo, useState } from "react";

import type {
  AutomationCategoryRule,
  AutomationMarketRule,
  CatalogAutomationConfig,
} from "@/lib/automation-config";
import type { AutomationDashboardData } from "@/lib/catalog-automation";

type Props = {
  initialData: AutomationDashboardData;
};

const fieldClass =
  "w-full border border-[#cfc5b5] bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[#9a7534] focus:ring-2 focus:ring-[#b9944d]/15";

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-TZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(new Date(value));
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function AutomationControlClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [config, setConfig] = useState(initialData.config);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [syncingFx, setSyncingFx] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const enabledRules = useMemo(
    () => config.categoryRules.filter((rule) => rule.enabled).length,
    [config.categoryRules],
  );
  const enabledMarkets = useMemo(
    () => config.markets.filter((market) => market.enabled).length,
    [config.markets],
  );

  function updateConfig<K extends keyof CatalogAutomationConfig>(
    key: K,
    value: CatalogAutomationConfig[K],
  ) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function updateRule(index: number, patch: Partial<AutomationCategoryRule>) {
    setConfig((current) => ({
      ...current,
      categoryRules: current.categoryRules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, ...patch } : rule,
      ),
    }));
  }

  function updateMarket(index: number, patch: Partial<AutomationMarketRule>) {
    setConfig((current) => ({
      ...current,
      markets: current.markets.map((market, marketIndex) => {
        if (marketIndex === index) return { ...market, ...patch };
        if (patch.primary === true) return { ...market, primary: false };
        return market;
      }),
    }));
  }

  async function refreshDashboard() {
    const response = await fetch("/api/admin/automation", {
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Could not refresh automation data.");
    }
    const next: AutomationDashboardData = {
      config: result.config,
      state: result.state,
      stats: result.stats,
      runs: result.runs,
    };
    setData(next);
    setConfig(next.config);
  }

  async function saveSettings() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Could not save automation settings.");
      }
      setConfig(result.config);
      setMessage("Global automation rules saved successfully.");
      await refreshDashboard();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save automation settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function syncFxNow() {
    setSyncingFx(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/automation/fx", {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Currency synchronization failed.");
      }
      setMessage("Global currency rates refreshed successfully.");
      await refreshDashboard();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Currency synchronization failed.",
      );
    } finally {
      setSyncingFx(false);
    }
  }

  async function runNow() {
    setRunning(true);
    setError("");
    setMessage("");

    try {
      const saveResponse = await fetch("/api/admin/automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const saved = await saveResponse.json();
      if (!saveResponse.ok || !saved.ok) {
        throw new Error(saved.error || "Could not save settings before run.");
      }

      const response = await fetch("/api/admin/automation/run", {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(
          result.report?.message || result.error || "Automation run failed.",
        );
      }

      setMessage(result.report.message);
      await refreshDashboard();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Automation run failed.",
      );
    } finally {
      setRunning(false);
    }
  }

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
        {[
          ["CJ catalogue", data.stats.cjProducts, "Products sourced from CJ"],
          ["Published", data.stats.cjActive, "Visible on the customer store"],
          ["Global offers", data.stats.globalOffers, "Available market-price records"],
          ["Markets", data.stats.markets || enabledMarkets, "International selling regions"],
        ].map(([label, value, note], index) => (
          <article
            key={String(label)}
            className="border border-[#d9d0c1] bg-[#fffdf9] p-5 shadow-[0_12px_40px_rgba(54,45,32,0.05)]"
          >
            <div className="flex items-start justify-between gap-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8e7650]">
                {label}
              </p>
              <span className="font-serif text-lg text-[#b9944d]">0{index + 1}</span>
            </div>
            <p className="mt-5 font-serif text-4xl font-semibold leading-none">
              {String(value)}
            </p>
            <p className="mt-3 text-xs leading-5 text-[#746d63]">{note}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="border border-[#d9d0c1] bg-[#fffdf9]">
          <div className="flex flex-col gap-4 border-b border-[#e4ddd2] bg-[#faf7f1] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
                Master control
              </p>
              <h2 className="mt-1 font-serif text-3xl font-semibold">
                Global catalogue autopilot
              </h2>
            </div>
            <span
              className={`w-fit border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] ${
                config.enabled
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-[#d8cfbf] bg-[#f7f3eb] text-[#675f55]"
              }`}
            >
              {config.enabled ? "Automation enabled" : "Automation paused"}
            </span>
          </div>

          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2">
            <label className="flex items-start gap-3 border border-[#ded6c9] bg-[#faf8f3] p-4">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(event) => updateConfig("enabled", event.target.checked)}
                className="mt-1 h-4 w-4 accent-[#9a7534]"
              />
              <span>
                <span className="block text-sm font-black">Run automatically every day</span>
                <span className="mt-1 block text-xs leading-5 text-[#746d63]">
                  Daily Vercel jobs refresh FX, synchronize CJ and source new products.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 border border-[#ded6c9] bg-[#faf8f3] p-4">
              <input
                type="checkbox"
                checked={config.autoPublish}
                onChange={(event) => updateConfig("autoPublish", event.target.checked)}
                className="mt-1 h-4 w-4 accent-[#9a7534]"
              />
              <span>
                <span className="block text-sm font-black">Guarded automatic publishing</span>
                <span className="mt-1 block text-xs leading-5 text-[#746d63]">
                  Only products passing stock, image, primary-market and international availability gates go live.
                </span>
              </span>
            </label>

            {[
              ["Products per run", "productsPerRun", config.productsPerRun, 1],
              ["Categories per run", "categoriesPerRun", config.categoriesPerRun, 1],
              ["Search results/category", "searchResultsPerCategory", config.searchResultsPerCategory, 5],
              ["Minimum supplier inventory", "minimumInventory", config.minimumInventory, 0],
              ["Maximum active/category", "maximumActivePerCategory", config.maximumActivePerCategory, 3],
              ["Minimum available markets", "minimumMarketsAvailable", config.minimumMarketsAvailable, 1],
              ["Exact freight markets/product", "maximumExactFreightMarkets", config.maximumExactFreightMarkets, 1],
              ["FX refresh hours", "fxRefreshHours", config.fxRefreshHours, 6],
            ].map(([label, key, value, minimum]) => (
              <label key={String(key)}>
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.15em] text-[#776b5c]">
                  {label}
                </span>
                <input
                  type="number"
                  min={Number(minimum)}
                  value={Number(value)}
                  onChange={(event) =>
                    updateConfig(
                      key as keyof CatalogAutomationConfig,
                      Number(event.target.value) as never,
                    )
                  }
                  className={fieldClass}
                />
              </label>
            ))}
          </div>
        </article>

        <aside className="border border-[#29241d] bg-[#1a1712] p-5 text-white shadow-[0_15px_50px_rgba(20,16,10,0.12)] sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#d4b56f]">
            Run control
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold">
            Source global products
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/55">
            The engine rotates {enabledRules} categories, scores products, prevents duplicates and generates prices for {enabledMarkets} markets.
          </p>

          <div className="mt-5 border border-white/10 bg-white/[0.04] p-4 text-xs">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <p className="text-white/45">Last run</p>
              <p className="text-right font-semibold">{formatDate(data.state.lastRunAt)}</p>
              <p className="text-white/45">Last status</p>
              <p className="text-right font-semibold">{data.state.lastRunStatus || "Not run"}</p>
              <p className="text-white/45">FX provider</p>
              <p className="text-right font-semibold">{data.state.fxProvider || "Fallback"}</p>
              <p className="text-white/45">FX updated</p>
              <p className="text-right font-semibold">{formatDate(data.state.fxFetchedAt)}</p>
              <p className="text-white/45">Cron security</p>
              <p className="text-right font-semibold">{data.state.cronSecretConfigured ? "Ready" : "Missing"}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={runNow}
            disabled={running || saving || syncingFx}
            className="mt-5 w-full border border-[#d4b56f] bg-[#d4b56f] px-5 py-3.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#171410] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? "Global sourcing in progress..." : "Save and run global sourcing"}
          </button>
          <button
            type="button"
            onClick={syncFxNow}
            disabled={running || saving || syncingFx}
            className="mt-3 w-full border border-white/20 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncingFx ? "Refreshing currencies..." : "Refresh currency rates"}
          </button>
        </aside>
      </section>

      <section className="border border-[#d9d0c1] bg-[#fffdf9]">
        <div className="border-b border-[#e4ddd2] bg-[#faf7f1] px-5 py-5 sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
            International distribution
          </p>
          <h2 className="mt-1 font-serif text-3xl font-semibold">
            Market pricing and freight policy
          </h2>
          <p className="mt-2 max-w-4xl text-xs leading-5 text-[#746d63]">
            Exact freight calls are used for priority markets. Other regions receive conservative estimated freight and are recalculated before international checkout.
          </p>
        </div>

        <div className="divide-y divide-[#e9e2d8]">
          {config.markets.map((market, index) => (
            <div key={market.key} className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm font-black">
                    <input
                      type="checkbox"
                      checked={market.enabled}
                      onChange={(event) => updateMarket(index, { enabled: event.target.checked })}
                      className="h-4 w-4 accent-[#9a7534]"
                    />
                    {market.name}
                  </label>
                  <span className="border border-[#d7cdbd] bg-[#faf8f3] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-[#776b5c]">
                    {market.countryCode} · {market.currency}
                  </span>
                  {market.primary && (
                    <span className="border border-[#b9944d] bg-[#f3e7c8] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-[#72531d]">
                      Primary store price
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="primary-market"
                      checked={market.primary}
                      disabled={!market.enabled}
                      onChange={() => updateMarket(index, { primary: true })}
                      className="accent-[#9a7534]"
                    />
                    Primary
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={market.exactFreight}
                      disabled={!market.enabled}
                      onChange={(event) => updateMarket(index, { exactFreight: event.target.checked })}
                      className="accent-[#9a7534]"
                    />
                    Exact CJ freight
                  </label>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {[
                  ["Markup %", "markupPercent", market.markupPercent],
                  ["Payment fee %", "paymentFeePercent", market.paymentFeePercent],
                  ["Risk reserve", "riskReserveLocal", market.riskReserveLocal],
                  ["Minimum profit", "minimumProfitLocal", market.minimumProfitLocal],
                  ["Maximum price", "maximumSellingPriceLocal", market.maximumSellingPriceLocal],
                  ["Rounding", "roundingIncrementLocal", market.roundingIncrementLocal],
                ].map(([label, key, value]) => (
                  <label key={String(key)}>
                    <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.14em] text-[#8a8073]">
                      {label} {String(key).includes("Percent") ? "" : market.currency}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={String(key).includes("Percent") ? "0.1" : "0.01"}
                      value={Number(value)}
                      onChange={(event) =>
                        updateMarket(index, {
                          [key]: Number(event.target.value),
                        } as Partial<AutomationMarketRule>)
                      }
                      className={fieldClass}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-5 border-t border-[#e4ddd2] bg-[#faf8f3] p-5 sm:grid-cols-3 sm:p-6">
          <label>
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.15em] text-[#776b5c]">
              Minimum supplier USD
            </span>
            <input
              type="number"
              min={0}
              step="0.1"
              value={config.minimumSupplierPriceUsd}
              onChange={(event) => updateConfig("minimumSupplierPriceUsd", Number(event.target.value))}
              className={fieldClass}
            />
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.15em] text-[#776b5c]">
              Maximum supplier USD
            </span>
            <input
              type="number"
              min={0}
              step="0.1"
              value={config.maximumSupplierPriceUsd}
              onChange={(event) => updateConfig("maximumSupplierPriceUsd", Number(event.target.value))}
              className={fieldClass}
            />
          </label>
          <label>
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.15em] text-[#776b5c]">
              Estimated freight safety multiplier
            </span>
            <input
              type="number"
              min={1}
              max={3}
              step="0.01"
              value={config.estimatedFreightMultiplier}
              onChange={(event) => updateConfig("estimatedFreightMultiplier", Number(event.target.value))}
              className={fieldClass}
            />
          </label>
        </div>
      </section>

      <section className="border border-[#d9d0c1] bg-[#fffdf9]">
        <div className="flex flex-col gap-3 border-b border-[#e4ddd2] bg-[#faf7f1] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
              Classification matrix
            </p>
            <h2 className="mt-1 font-serif text-3xl font-semibold">
              Categories, searches and margins
            </h2>
          </div>
          <p className="max-w-md text-xs leading-5 text-[#746d63]">
            The system rotates selected categories each day to reduce CJ API usage while keeping the catalogue balanced.
          </p>
        </div>

        <div className="divide-y divide-[#e9e2d8]">
          {config.categoryRules.map((rule, index) => (
            <div
              key={rule.key}
              className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[180px_1fr_130px_120px] lg:items-start"
            >
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(event) => updateRule(index, { enabled: event.target.checked })}
                  className="h-4 w-4 accent-[#9a7534]"
                />
                <span className="font-serif text-xl font-semibold">{rule.category}</span>
              </label>

              <label>
                <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.14em] text-[#8a8073]">
                  Rotating CJ searches
                </span>
                <input
                  value={rule.searchTerms.join(", ")}
                  onChange={(event) =>
                    updateRule(index, {
                      searchTerms: event.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                  className={fieldClass}
                />
              </label>

              <label>
                <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.14em] text-[#8a8073]">
                  Category markup %
                </span>
                <input
                  type="number"
                  min={0}
                  value={rule.markupPercent}
                  onChange={(event) => updateRule(index, { markupPercent: Number(event.target.value) })}
                  className={fieldClass}
                />
              </label>

              <label>
                <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.14em] text-[#8a8073]">
                  Max/run
                </span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={rule.maxImportsPerRun}
                  onChange={(event) => updateRule(index, { maxImportsPerRun: Number(event.target.value) })}
                  className={fieldClass}
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <article className="border border-[#d9d0c1] bg-[#fffdf9] p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
            Safety filter
          </p>
          <h2 className="mt-1 font-serif text-3xl font-semibold">
            Blocked product terms
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#746d63]">
            Restricted, unsafe, counterfeit or unsuitable supplier products are rejected before expensive detail and freight calls.
          </p>
          <textarea
            rows={9}
            value={config.blockedKeywords.join(", ")}
            onChange={(event) =>
              updateConfig(
                "blockedKeywords",
                event.target.value
                  .split(",")
                  .map((item) => item.trim().toLowerCase())
                  .filter(Boolean),
              )
            }
            className={`${fieldClass} mt-5 resize-y leading-6`}
          />
          <button
            type="button"
            onClick={saveSettings}
            disabled={saving || running || syncingFx}
            className="mt-4 w-full border border-[#1b1814] bg-[#1b1814] px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving rules..." : "Save all global automation rules"}
          </button>
        </article>

        <article className="border border-[#d9d0c1] bg-[#fffdf9]">
          <div className="border-b border-[#e4ddd2] bg-[#faf7f1] px-5 py-5 sm:px-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
              Operational history
            </p>
            <h2 className="mt-1 font-serif text-3xl font-semibold">
              Recent automation runs
            </h2>
          </div>

          {data.runs.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#746d63]">
              No automation run has been recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-[#e9e2d8]">
              {data.runs.map((run) => {
                const report = run.report || {};
                return (
                  <div
                    key={run.id}
                    className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] ${
                            run.status === "success"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : run.status === "failed"
                                ? "border-red-200 bg-red-50 text-red-800"
                                : "border-amber-200 bg-amber-50 text-amber-800"
                          }`}
                        >
                          {run.status}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8a8073]">
                          {run.trigger}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold">
                        {String(report.message || run.error || "Automation run")}
                      </p>
                      <p className="mt-1 text-xs text-[#80786e]">
                        {formatDate(run.startedAt)}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      {[
                        ["Imported", asNumber(report.imported)],
                        ["Live", asNumber(report.published)],
                        ["Draft", asNumber(report.drafts)],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="border border-[#ded6c9] bg-[#faf8f3] px-3 py-2">
                          <p className="font-serif text-lg font-semibold">{String(value)}</p>
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#8a8073]">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>

      <p className="text-center text-[10px] text-[#8a8073]">
        Currency rates use the configured FX provider and are cached daily. Open-access rates require attribution when customer-facing local currency display is enabled.
      </p>
    </div>
  );
}
