"use client";

import { useState } from "react";

type Props = {
  orderNumber: string;
};

const actions = [
  { value: "mark_paid", label: "Mark Paid" },
  { value: "mark_processing", label: "Mark Processing" },
  { value: "mark_shipped", label: "Mark Shipped" },
  { value: "mark_delivered", label: "Mark Delivered" },
  { value: "cancel", label: "Cancel Order" },
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
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.value}
            type="button"
            disabled={Boolean(busy)}
            onClick={() => run(action.value)}
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
              action.value === "cancel"
                ? "border-red-200 text-red-700 hover:bg-red-50"
                : "border-slate-300 hover:border-slate-500 hover:bg-slate-50"
            }`}
          >
            {busy === action.value ? "Updating..." : action.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}