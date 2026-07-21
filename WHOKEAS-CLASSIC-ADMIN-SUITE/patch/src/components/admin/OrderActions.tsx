"use client";

import { useState } from "react";

type Props = {
  orderNumber: string;
};

const actions = [
  { value: "mark_paid", label: "Mark paid", tone: "gold" },
  { value: "mark_processing", label: "Processing", tone: "neutral" },
  { value: "mark_shipped", label: "Shipped", tone: "neutral" },
  { value: "mark_delivered", label: "Delivered", tone: "success" },
  { value: "cancel", label: "Cancel", tone: "danger" },
] as const;

export default function OrderActions({ orderNumber }: Props) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function run(action: string) {
    setBusy(action);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderNumber)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Update failed.");
      }

      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Update failed.");
      setBusy("");
    }
  }

  return (
    <div>
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#8e7650]">
        Update order stage
      </p>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const tone =
            action.tone === "danger"
              ? "border-red-200 text-red-700 hover:bg-red-50"
              : action.tone === "success"
                ? "border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                : action.tone === "gold"
                  ? "border-[#b9944d] bg-[#b9944d] text-[#171410] hover:bg-[#c7a35d]"
                  : "border-[#cfc5b5] text-[#403a32] hover:border-[#8f826f] hover:bg-[#f7f3eb]";

          return (
            <button
              key={action.value}
              type="button"
              disabled={Boolean(busy)}
              onClick={() => run(action.value)}
              className={`border px-3 py-2 text-[10px] font-black uppercase tracking-[0.11em] transition disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
            >
              {busy === action.value ? "Updating..." : action.label}
            </button>
          );
        })}
      </div>

      {error && <p className="mt-3 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
