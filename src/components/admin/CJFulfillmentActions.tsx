"use client";

import { useState } from "react";

type Props = {
  orderNumber: string;
  orderStatus: string;
  cjStatus?: string | null;
  cjStage?: string | null;
  cjOrderId?: string | null;
  cjShipmentOrderId?: string | null;
  cjPayId?: string | null;
  cjPayUrl?: string | null;
  cjLogisticsName?: string | null;
  cjPayableAmountUsd?: string | number | null;
  cjTrackingNumber?: string | null;
  cjLastError?: string | null;
  cjIsSandbox?: boolean | null;
};

function statusTone(status: string) {
  const value = status.toLowerCase();

  if (value.includes("deliver")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (value.includes("ship") || value.includes("processing")) {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }

  if (value.includes("fail") || value.includes("cancel")) {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (
    value.includes("payment") ||
    value.includes("created") ||
    value.includes("paid")
  ) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-[#d8cfbf] bg-[#f7f3eb] text-[#675f55]";
}

export default function CJFulfillmentActions({
  orderNumber,
  orderStatus,
  cjStatus,
  cjStage,
  cjOrderId,
  cjShipmentOrderId,
  cjPayId,
  cjPayUrl,
  cjLogisticsName,
  cjPayableAmountUsd,
  cjTrackingNumber,
  cjLastError,
  cjIsSandbox,
}: Props) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const status = String(cjStatus || "not_sent");
  const paid = ["paid", "processing", "shipped", "delivered"].includes(
    String(orderStatus).toLowerCase(),
  );
  const hasCJOrder = Boolean(cjOrderId);

  async function run(action: "prepare" | "retry" | "sync") {
    setBusy(action);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderNumber)}/cj`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "CJ fulfillment action failed.");
      }

      window.location.reload();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "CJ fulfillment action failed.",
      );
      setBusy("");
    }
  }

  return (
    <div className="mt-5 border-t border-[#e4ddd2] pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8e7650]">
          CJ auto-order bridge
        </p>

        <span
          className={`border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.11em] ${statusTone(status)}`}
        >
          {status.replaceAll("_", " ")}
        </span>
      </div>

      {cjIsSandbox ? (
        <p className="mt-3 border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800">
          Sandbox mode — CJ will not charge or ship this test order.
        </p>
      ) : null}

      {status === "sandbox_paid" ? (
        <p className="mt-3 border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          Sandbox payment simulated successfully. The automatic CJ order bridge
          completed its full test flow without charging or shipping.
        </p>
      ) : null}

      <div className="mt-3 grid gap-2 text-xs text-[#625b52] sm:grid-cols-2">
        {cjStage ? (
          <p>
            <span className="font-black">Stage:</span>{" "}
            {String(cjStage).replaceAll("_", " ")}
          </p>
        ) : null}

        {cjOrderId ? (
          <p className="break-all">
            <span className="font-black">CJ order:</span> {cjOrderId}
          </p>
        ) : null}

        {cjShipmentOrderId ? (
          <p className="break-all">
            <span className="font-black">Shipment order:</span>{" "}
            {cjShipmentOrderId}
          </p>
        ) : null}

        {cjPayId ? (
          <p className="break-all">
            <span className="font-black">CJ payment ID:</span> {cjPayId}
          </p>
        ) : null}

        {cjLogisticsName ? (
          <p>
            <span className="font-black">Logistics:</span>{" "}
            {cjLogisticsName}
          </p>
        ) : null}

        {Number(cjPayableAmountUsd || 0) > 0 ? (
          <p>
            <span className="font-black">CJ payable:</span>{" "}
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(Number(cjPayableAmountUsd))}
          </p>
        ) : null}

        {cjTrackingNumber ? (
          <p className="break-all">
            <span className="font-black">Tracking:</span>{" "}
            {cjTrackingNumber}
          </p>
        ) : null}
      </div>

      {cjLastError ? (
        <p className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-700">
          {cjLastError}
        </p>
      ) : null}

      {!paid && !hasCJOrder ? (
        <p className="mt-3 text-xs text-[#746d63]">
          Mark the customer payment as paid first. WHOKEAS will then send the
          order to CJ automatically.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {!hasCJOrder || status === "failed" ? (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => run(hasCJOrder ? "retry" : "prepare")}
              className="border border-[#b9944d] bg-[#b9944d] px-3 py-2 text-[10px] font-black uppercase tracking-[0.11em] text-[#171410] transition hover:bg-[#c7a35d] disabled:opacity-50"
            >
              {busy
                ? "Working..."
                : hasCJOrder
                  ? "Retry CJ"
                  : "Send to CJ"}
            </button>
          ) : null}

          {cjPayUrl ? (
            <a
              href={cjPayUrl}
              target="_blank"
              rel="noreferrer"
              className="border border-emerald-700 bg-emerald-700 px-3 py-2 text-[10px] font-black uppercase tracking-[0.11em] text-white transition hover:bg-emerald-800"
            >
              Open CJ payment
            </a>
          ) : null}

          {hasCJOrder ? (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => run("sync")}
              className="border border-[#cfc5b5] px-3 py-2 text-[10px] font-black uppercase tracking-[0.11em] text-[#403a32] transition hover:border-[#8f826f] hover:bg-[#f7f3eb] disabled:opacity-50"
            >
              {busy === "sync" ? "Refreshing..." : "Refresh CJ"}
            </button>
          ) : null}
        </div>
      )}

      {error ? (
        <p className="mt-3 text-xs font-semibold text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
