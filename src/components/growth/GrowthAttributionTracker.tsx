"use client";

import { useEffect } from "react";

const ATTRIBUTION_KEY = "whokeas-growth-attribution";
const PROMOTION_KEY = "whokeas-growth-promotion";
const VISITOR_KEY = "whokeas-growth-visitor";

function randomVisitorId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function GrowthAttributionTracker() {
  useEffect(() => {
    try {
      const search = new URLSearchParams(window.location.search);
      const attributionCode =
        search.get("ref") ||
        search.get("affiliate") ||
        search.get("partner");
      const promotionCode =
        search.get("coupon") ||
        search.get("promo");

      if (promotionCode) {
        localStorage.setItem(
          PROMOTION_KEY,
          promotionCode.trim().toUpperCase(),
        );
      }

      if (!attributionCode) return;

      const code = attributionCode
        .trim()
        .toUpperCase();

      if (!code) return;

      localStorage.setItem(
        ATTRIBUTION_KEY,
        JSON.stringify({
          code,
          expiresAt:
            Date.now() + 30 * 24 * 60 * 60 * 1000,
        }),
      );

      let visitorId =
        localStorage.getItem(VISITOR_KEY);

      if (!visitorId) {
        visitorId = randomVisitorId();
        localStorage.setItem(
          VISITOR_KEY,
          visitorId,
        );
      }

      void fetch("/api/growth/track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: true,
        body: JSON.stringify({
          code,
          visitorId,
          landingPath:
            window.location.pathname +
            window.location.search,
          referrer: document.referrer || null,
        }),
      });
    }
    catch {
      // Attribution must never interrupt storefront rendering.
    }
  }, []);

  return null;
}
