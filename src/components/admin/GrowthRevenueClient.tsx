"use client";

import { FormEvent, useState } from "react";

import {
  formatStorePrice,
  tzsToStoreUsd,
} from "@/lib/store-currency";

type GrowthDashboard = {
  siteUrl: string;
  profit: {
    revenue: number;
    supplierCost: number;
    paymentFees: number;
    affiliateCommissions: number;
    referralRewards: number;
    discounts: number;
    storeCreditUsed: number;
    orders: number;
    netProfit: number;
  };
  recentProfits: Array<Record<string, unknown>>;
  coupons: Array<Record<string, unknown>>;
  affiliates: Array<Record<string, unknown>>;
  commissions: Array<Record<string, unknown>>;
  referrals: Record<string, unknown>;
  abandoned: Array<Record<string, unknown>>;
};

type Props = {
  initialData: GrowthDashboard;
};

function formatTzsAsUsd(value: unknown) {
  return formatStorePrice(
    tzsToStoreUsd(Number(value || 0)),
  );
}

function formatCurrencyValue(
  value: unknown,
  currency: unknown,
) {
  const code = String(currency || "USD")
    .trim()
    .toUpperCase();
  const numeric = Number(value || 0);

  if (code === "TZS") {
    return formatTzsAsUsd(numeric);
  }

  if (code === "USD") {
    return formatStorePrice(numeric);
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(
      Number.isFinite(numeric) ? numeric : 0,
    );
  }
  catch {
    return `${code} ${
      Number.isFinite(numeric)
        ? numeric.toFixed(2)
        : "0.00"
    }`;
  }
}

function formatDate(value: unknown) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-TZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(new Date(String(value)));
}

function cartSummary(value: unknown) {
  if (!Array.isArray(value)) return "Saved customer cart";

  return value
    .slice(0, 4)
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const record = item as Record<string, unknown>;
      return `${String(record.name || "Product")} × ${Number(
        record.quantity || 1,
      )}`;
    })
    .filter(Boolean)
    .join(", ");
}

function whatsappPhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.startsWith("0")) {
    return `255${digits.slice(1)}`;
  }

  return digits;
}

export default function GrowthRevenueClient({
  initialData,
}: Props) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [coupon, setCoupon] = useState({
    code: "",
    name: "",
    discountType: "percent",
    discountValue: "10",
    maximumDiscount: "",
    minimumOrder: "0",
    currency: "USD",
    usageLimit: "",
    perCustomerLimit: "1",
    startsAt: "",
    expiresAt: "",
  });

  const [affiliate, setAffiliate] = useState({
    name: "",
    code: "",
    email: "",
    phone: "",
    commissionRate: "5",
    notes: "",
  });

  async function action(
    key: string,
    payload: Record<string, unknown>,
  ) {
    setBusy(key);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.error ||
            "Growth & Revenue action failed.",
        );
      }

      setMessage(
        result.code
          ? `Partner created. Code: ${result.code}`
          : "Saved successfully.",
      );

      window.setTimeout(() => {
        window.location.reload();
      }, 600);
    }
    catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Growth & Revenue action failed.",
      );
      setBusy("");
    }
  }

  async function createCoupon(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    await action("create_coupon", {
      action: "create_coupon",
      ...coupon,
    });
  }

  async function createAffiliate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    await action("create_affiliate", {
      action: "create_affiliate",
      ...affiliate,
    });
  }

  const p = initialData.profit;

  return (
    <div className="space-y-8">
      {(message || error) && (
        <div
          className={`border px-4 py-3 text-sm font-semibold ${
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
          ["Recorded revenue", formatTzsAsUsd(p.revenue), `${p.orders} paid or active orders · USD equivalent`],
          ["Supplier cost", formatTzsAsUsd(p.supplierCost), "Recorded fulfilment cost · USD equivalent"],
          ["Growth costs", formatTzsAsUsd(
            p.paymentFees +
              p.affiliateCommissions,
          ), "Payment fees and partner commissions · USD equivalent"],
          ["Estimated cash profit", formatTzsAsUsd(p.netProfit), "USD equivalent; historical order records remain unchanged"],
        ].map(([label, value, note], index) => (
          <article
            key={String(label)}
            className={`border p-5 ${
              index === 3
                ? "border-[#b9944d] bg-[#171410] text-white"
                : "border-[#d9d0c1] bg-[#fffdf9]"
            }`}
          >
            <p
              className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                index === 3
                  ? "text-[#d6bd7b]"
                  : "text-[#8e7650]"
              }`}
            >
              {label}
            </p>
            <p className="mt-5 font-serif text-3xl font-semibold">
              {value}
            </p>
            <p
              className={`mt-3 text-xs ${
                index === 3
                  ? "text-white/60"
                  : "text-[#746d63]"
              }`}
            >
              {note}
            </p>
          </article>
        ))}
      </section>

      <p className="border border-[#d9d0c1] bg-[#fffdf9] px-4 py-3 text-xs leading-5 text-[#746d63]">
        Dashboard totals are displayed in USD. Existing orders and supplier records
        remain stored in their original currency to protect accounting accuracy.
      </p>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form
          onSubmit={createCoupon}
          className="border border-[#d9d0c1] bg-[#fffdf9] p-6"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
            Promotions
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold">
            Create a controlled coupon
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#746d63]">
            Limits are enforced on the server. Cancelled orders release reserved usage.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-2 block text-xs font-bold">Code *</span>
              <input
                required
                value={coupon.code}
                onChange={(event) =>
                  setCoupon((current) => ({
                    ...current,
                    code: event.target.value.toUpperCase(),
                  }))
                }
                placeholder="WELCOME10"
                className="w-full border border-[#cfc5b5] bg-white px-3 py-3"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-bold">Campaign name *</span>
              <input
                required
                value={coupon.name}
                onChange={(event) =>
                  setCoupon((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="New customer launch"
                className="w-full border border-[#cfc5b5] bg-white px-3 py-3"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-bold">Discount type</span>
              <select
                value={coupon.discountType}
                onChange={(event) =>
                  setCoupon((current) => ({
                    ...current,
                    discountType: event.target.value,
                  }))
                }
                className="w-full border border-[#cfc5b5] bg-white px-3 py-3"
              >
                <option value="percent">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </label>

            <label>
              <span className="mb-2 block text-xs font-bold">Discount value *</span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={coupon.discountValue}
                onChange={(event) =>
                  setCoupon((current) => ({
                    ...current,
                    discountValue: event.target.value,
                  }))
                }
                className="w-full border border-[#cfc5b5] bg-white px-3 py-3"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-bold">Minimum order (USD)</span>
              <input
                type="number"
                min="0"
                value={coupon.minimumOrder}
                onChange={(event) =>
                  setCoupon((current) => ({
                    ...current,
                    minimumOrder: event.target.value,
                  }))
                }
                className="w-full border border-[#cfc5b5] bg-white px-3 py-3"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-bold">Maximum discount (USD)</span>
              <input
                type="number"
                min="0"
                value={coupon.maximumDiscount}
                onChange={(event) =>
                  setCoupon((current) => ({
                    ...current,
                    maximumDiscount: event.target.value,
                  }))
                }
                placeholder="Optional"
                className="w-full border border-[#cfc5b5] bg-white px-3 py-3"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-bold">Total usage limit</span>
              <input
                type="number"
                min="1"
                value={coupon.usageLimit}
                onChange={(event) =>
                  setCoupon((current) => ({
                    ...current,
                    usageLimit: event.target.value,
                  }))
                }
                placeholder="Unlimited"
                className="w-full border border-[#cfc5b5] bg-white px-3 py-3"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-bold">Uses per customer</span>
              <input
                type="number"
                min="1"
                value={coupon.perCustomerLimit}
                onChange={(event) =>
                  setCoupon((current) => ({
                    ...current,
                    perCustomerLimit: event.target.value,
                  }))
                }
                className="w-full border border-[#cfc5b5] bg-white px-3 py-3"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-bold">Starts</span>
              <input
                type="datetime-local"
                value={coupon.startsAt}
                onChange={(event) =>
                  setCoupon((current) => ({
                    ...current,
                    startsAt: event.target.value,
                  }))
                }
                className="w-full border border-[#cfc5b5] bg-white px-3 py-3"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-bold">Expires</span>
              <input
                type="datetime-local"
                value={coupon.expiresAt}
                onChange={(event) =>
                  setCoupon((current) => ({
                    ...current,
                    expiresAt: event.target.value,
                  }))
                }
                className="w-full border border-[#cfc5b5] bg-white px-3 py-3"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={Boolean(busy)}
            className="mt-6 border border-[#171410] bg-[#171410] px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-white disabled:opacity-50"
          >
            {busy === "create_coupon"
              ? "Creating…"
              : "Create coupon"}
          </button>
        </form>

        <div className="border border-[#d9d0c1] bg-[#fffdf9]">
          <div className="border-b border-[#e4ddd2] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
              Active campaigns
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold">
              Coupon control
            </h2>
          </div>

          <div className="divide-y divide-[#e4ddd2]">
            {initialData.coupons.length === 0 ? (
              <p className="p-6 text-sm text-[#746d63]">
                No coupons created yet.
              </p>
            ) : (
              initialData.coupons.map((couponRecord) => (
                <div
                  key={String(couponRecord.id)}
                  className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono font-bold text-[#9a7534]">
                        {String(couponRecord.code)}
                      </p>
                      <span
                        className={`border px-2 py-1 text-[9px] font-black uppercase ${
                          couponRecord.active
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-[#d8cfbf] bg-[#f7f3eb] text-[#746d63]"
                        }`}
                      >
                        {couponRecord.active ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p className="mt-2 font-semibold">
                      {String(couponRecord.name)}
                    </p>
                    <p className="mt-1 text-xs text-[#746d63]">
                      {String(couponRecord.discountType) === "percent"
                        ? `${Number(couponRecord.discountValue)}% off`
                        : `${formatCurrencyValue(
                            couponRecord.discountValue,
                            couponRecord.currency,
                          )} off`}
                      {" · "}
                      {Number(couponRecord.redemptions || 0)} redeemed
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      action(`coupon-${couponRecord.id}`, {
                        action: "toggle_coupon",
                        couponId: couponRecord.id,
                      })
                    }
                    className="border border-[#cfc5b5] px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em]"
                  >
                    {couponRecord.active ? "Pause" : "Activate"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form
          onSubmit={createAffiliate}
          className="border border-[#d9d0c1] bg-[#171410] p-6 text-white"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d6bd7b]">
            Performance partners
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold">
            Create an affiliate account
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Partners earn only from tracked, non-cancelled orders. Commission becomes payable after delivery.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              ["name", "Partner name *", "text"],
              ["code", "Code (optional)", "text"],
              ["email", "Email", "email"],
              ["phone", "Phone", "text"],
              ["commissionRate", "Commission %", "number"],
            ].map(([field, label, type]) => (
              <label key={field}>
                <span className="mb-2 block text-xs font-bold">{label}</span>
                <input
                  required={field === "name"}
                  type={type}
                  min={field === "commissionRate" ? "0" : undefined}
                  max={field === "commissionRate" ? "40" : undefined}
                  step={field === "commissionRate" ? "0.1" : undefined}
                  value={String(
                    affiliate[field as keyof typeof affiliate],
                  )}
                  onChange={(event) =>
                    setAffiliate((current) => ({
                      ...current,
                      [field]: field === "code"
                        ? event.target.value.toUpperCase()
                        : event.target.value,
                    }))
                  }
                  className="w-full border border-white/20 bg-white/[0.05] px-3 py-3 text-white outline-none"
                />
              </label>
            ))}

            <label className="sm:col-span-2">
              <span className="mb-2 block text-xs font-bold">Notes</span>
              <textarea
                rows={3}
                value={affiliate.notes}
                onChange={(event) =>
                  setAffiliate((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                className="w-full border border-white/20 bg-white/[0.05] px-3 py-3 text-white outline-none"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={Boolean(busy)}
            className="mt-6 border border-[#d6bd7b] bg-[#d6bd7b] px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#171410] disabled:opacity-50"
          >
            {busy === "create_affiliate"
              ? "Creating…"
              : "Create affiliate"}
          </button>
        </form>

        <div className="border border-[#d9d0c1] bg-[#fffdf9]">
          <div className="border-b border-[#e4ddd2] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
              Partner performance
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold">
              Affiliate links and earnings
            </h2>
          </div>

          <div className="divide-y divide-[#e4ddd2]">
            {initialData.affiliates.length === 0 ? (
              <p className="p-6 text-sm text-[#746d63]">
                No affiliates created yet.
              </p>
            ) : (
              initialData.affiliates.map((record) => {
                const link = `${initialData.siteUrl}/?ref=${encodeURIComponent(
                  String(record.code),
                )}`;

                return (
                  <div
                    key={String(record.id)}
                    className="p-5"
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">
                            {String(record.name)}
                          </p>
                          <span className="border border-[#d8cfbf] px-2 py-1 text-[9px] font-black uppercase">
                            {String(record.status)}
                          </span>
                        </div>
                        <p className="mt-2 break-all font-mono text-xs text-[#9a7534]">
                          {link}
                        </p>
                        <p className="mt-2 text-xs text-[#746d63]">
                          {Number(record.clicks || 0)} clicks ·{" "}
                          {Number(record.orders || 0)} orders ·{" "}
                          {Number(record.commissionRate || 0)}% commission
                        </p>
                        <p className="mt-2 font-serif text-xl">
                          {formatTzsAsUsd(record.commissionTotal)}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            navigator.clipboard.writeText(link)
                          }
                          className="border border-[#b9944d] px-3 py-2 text-[9px] font-black uppercase text-[#7b591d]"
                        >
                          Copy link
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            action(`affiliate-${record.id}`, {
                              action: "toggle_affiliate",
                              affiliateId: record.id,
                            })
                          }
                          className="border border-[#cfc5b5] px-3 py-2 text-[9px] font-black uppercase"
                        >
                          {record.status === "active" ? "Pause" : "Activate"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="border border-[#d9d0c1] bg-[#fffdf9]">
          <div className="border-b border-[#e4ddd2] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
              Commission desk
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold">
              Affiliate payouts
            </h2>
          </div>

          <div className="max-h-[560px] divide-y divide-[#e4ddd2] overflow-y-auto">
            {initialData.commissions.length === 0 ? (
              <p className="p-6 text-sm text-[#746d63]">
                No commissions recorded yet.
              </p>
            ) : (
              initialData.commissions.map((record) => (
                <div
                  key={String(record.id)}
                  className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <p className="font-semibold">
                      {String(record.affiliateName)}
                    </p>
                    <p className="mt-1 text-xs text-[#746d63]">
                      {String(record.orderNumber)} ·{" "}
                      {Number(record.rate)}%
                    </p>
                    <p className="mt-2 font-serif text-xl">
                      {formatCurrencyValue(
                        record.amount,
                        record.currency,
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="border border-[#d8cfbf] px-2 py-1 text-[9px] font-black uppercase">
                      {String(record.status)}
                    </span>
                    {record.status === "approved" && (
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          action(`commission-${record.id}`, {
                            action: "pay_commission",
                            commissionId: record.id,
                          })
                        }
                        className="mt-3 block border border-[#b9944d] bg-[#b9944d] px-3 py-2 text-[9px] font-black uppercase text-[#171410]"
                      >
                        Mark paid
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border border-[#d9d0c1] bg-[#fffdf9]">
          <div className="border-b border-[#e4ddd2] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
              Customer referrals
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold">
              Referral and store-credit health
            </h2>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2">
            {[
              [
                "Rewarded referrals",
                Number(
                  initialData.referrals.rewarded || 0,
                ),
              ],
              [
                "Pending referrals",
                Number(
                  initialData.referrals.pending || 0,
                ),
              ],
              ["Referral rewards issued", formatTzsAsUsd(initialData.referrals.rewardedTzs)],
              ["Posted store credit", formatTzsAsUsd(initialData.referrals.postedCreditTzs)],
            ].map(([label, value]) => (
              <article
                key={String(label)}
                className="border border-[#ded5c6] bg-[#f7f3eb] p-4"
              >
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#746d63]">
                  {label}
                </p>
                <p className="mt-3 font-serif text-2xl">
                  {value}
                </p>
              </article>
            ))}
          </div>

          <p className="border-t border-[#e4ddd2] p-6 text-sm leading-6 text-[#746d63]">
            Eligible first-order referrals currently receive approximately{" "}
            {formatTzsAsUsd(2000)} in value. Referrers receive the same USD-equivalent
            store credit only after successful delivery. Store credit can cover up to
            50% of a later eligible checkout.
          </p>
        </div>
      </section>

      <section className="border border-[#d9d0c1] bg-[#fffdf9]">
        <div className="border-b border-[#e4ddd2] p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
            Checkout recovery
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold">
            Abandoned checkouts
          </h2>
          <p className="mt-3 text-sm text-[#746d63]">
            Contact only customers who voluntarily entered a phone number or email during checkout.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full border-collapse text-left text-sm">
            <thead className="bg-[#171410] text-white">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Cart</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Last activity</th>
                <th className="px-4 py-3">Recovery</th>
              </tr>
            </thead>
            <tbody>
              {initialData.abandoned.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-[#746d63]"
                  >
                    No recoverable checkouts yet.
                  </td>
                </tr>
              ) : (
                initialData.abandoned.map((record) => {
                  const phone = whatsappPhone(record.customerPhone);
                  const summary = cartSummary(record.cart);
                  const message = encodeURIComponent(
                    `Hello ${String(record.customerName || "")}, you left items in your WHOKEAS ALL IN checkout: ${summary}. You can continue here: ${initialData.siteUrl}/checkout`,
                  );

                  return (
                    <tr
                      key={String(record.id)}
                      className="border-t border-[#e4ddd2] align-top"
                    >
                      <td className="px-4 py-4">
                        <p className="font-semibold">
                          {String(record.customerName || "Customer")}
                        </p>
                        <p className="mt-1 text-xs text-[#746d63]">
                          {String(record.customerPhone || record.customerEmail || "Contact not supplied")}
                        </p>
                        <span className="mt-2 inline-flex border border-[#d8cfbf] px-2 py-1 text-[9px] font-black uppercase">
                          {String(record.status)}
                        </span>
                      </td>
                      <td className="max-w-sm px-4 py-4 text-xs leading-5 text-[#625b52]">
                        {summary}
                      </td>
                      <td className="px-4 py-4 font-serif text-lg">
                        {formatCurrencyValue(
                          record.estimatedTotal,
                          record.currency,
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-[#746d63]">
                        {formatDate(record.lastSeenAt)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {phone && (
                            <a
                              href={`https://wa.me/${phone}?text=${message}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() =>
                                void action(`contact-${record.id}`, {
                                  action: "abandoned_status",
                                  checkoutId: record.id,
                                  status: "contacted",
                                })
                              }
                              className="border border-emerald-300 bg-emerald-50 px-3 py-2 text-[9px] font-black uppercase text-emerald-800"
                            >
                              WhatsApp
                            </a>
                          )}
                          <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() =>
                              action(`close-${record.id}`, {
                                action: "abandoned_status",
                                checkoutId: record.id,
                                status: "closed",
                              })
                            }
                            className="border border-[#cfc5b5] px-3 py-2 text-[9px] font-black uppercase"
                          >
                            Close
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border border-[#d9d0c1] bg-[#fffdf9]">
        <div className="border-b border-[#e4ddd2] p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7534]">
            Order economics
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold">
            Recent estimated profit by order
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[880px] w-full border-collapse text-left text-sm">
            <thead className="bg-[#f7f3eb]">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Revenue</th>
                <th className="px-4 py-3">Supplier cost</th>
                <th className="px-4 py-3">Fees</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3">Profit</th>
              </tr>
            </thead>
            <tbody>
              {initialData.recentProfits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[#746d63]">
                    Profit data will appear after paid orders.
                  </td>
                </tr>
              ) : (
                initialData.recentProfits.map((record) => (
                  <tr
                    key={String(record.orderNumber)}
                    className="border-t border-[#e4ddd2]"
                  >
                    <td className="px-4 py-4">
                      <p className="font-semibold">{String(record.orderNumber)}</p>
                      <p className="text-xs text-[#746d63]">
                        {String(record.customerName)}
                      </p>
                    </td>
                    <td className="px-4 py-4">{formatTzsAsUsd(record.revenue)}</td>
                    <td className="px-4 py-4">{formatTzsAsUsd(record.supplierCost)}</td>
                    <td className="px-4 py-4">{formatTzsAsUsd(record.paymentFee)}</td>
                    <td className="px-4 py-4">{formatTzsAsUsd(record.commission)}</td>
                    <td className="px-4 py-4 font-serif text-lg font-semibold text-emerald-800">
                      {formatTzsAsUsd(record.profit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
