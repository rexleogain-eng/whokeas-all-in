"use client";

import { useEffect } from "react";

export default function OrderEmailTrigger() {
  useEffect(() => {
    const prefix = "/order-confirmation/";
    const pathname = window.location.pathname;

    if (!pathname.startsWith(prefix)) return;

    const orderNumber = decodeURIComponent(
      pathname.slice(prefix.length).split("/")[0] || "",
    ).trim();

    const params = new URLSearchParams(window.location.search);
    const key = String(params.get("key") || "").trim();

    if (!orderNumber || !key) return;

    const storageKey = `whokeas-order-email-${orderNumber}`;

    try {
      if (sessionStorage.getItem(storageKey) === "requested") return;
      sessionStorage.setItem(storageKey, "requested");
    }
    catch {
      // Session storage is only a client-side duplicate guard.
    }

    void fetch(
      `/api/orders/${encodeURIComponent(orderNumber)}/confirmation-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key }),
        cache: "no-store",
        keepalive: true,
      },
    ).catch(() => {
      // Email delivery is optional and must never disrupt the order page.
    });
  }, []);

  return null;
}
