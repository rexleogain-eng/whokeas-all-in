"use client";

import { useLayoutEffect } from "react";

const exactReplacements: Record<string, string> = {
  "Preparing international checkout…": "Preparing U.S. checkout…",
  "Guest or customer": "Customer details",
  "International delivery details": "U.S. delivery details",
  "Choose the available method": "Choose your payment option",
  "Market quote": "Order total",
  "Calculating pricing for your delivery country…": "Updating your order total…",
  "Products and estimated delivery": "Items",
  "Additional checkout fee": "Extra checkout fees",
  "Secure Online Payment Link": "Secure online payment",
  "Continue as guest": "Place order as guest",
  "Guest checkout · Secure order access · International addresses":
    "Guest checkout · Secure order access · United States delivery",
};

function polishElement(element: Element) {
  const text = element.textContent?.trim();
  if (!text) return;

  const exact = exactReplacements[text];
  if (exact && element.childElementCount === 0) {
    element.textContent = exact;
    return;
  }

  if (
    element.tagName === "P" &&
    text.includes("Final supplier fulfilment begins after payment verification.")
  ) {
    const countryMatch = text.match(/^Market:\s*(.+?)\./);
    const country = countryMatch?.[1]?.trim();
    element.textContent = country
      ? `Delivery to ${country}. Your order is prepared after payment is confirmed.`
      : "Your order is prepared after payment is confirmed.";
    return;
  }

  if (
    element.tagName === "P" &&
    text.includes("WHOKEAS will send a secure online payment link to your email before fulfilment.")
  ) {
    element.textContent =
      "Place your order now. WHOKEAS will send the secure payment step to your email before your order is prepared.";
  }
}

function polishCheckoutCopy() {
  document
    .querySelectorAll("main p, main h1, main h2, main button, main div")
    .forEach(polishElement);
}

export default function CheckoutCopyPolish() {
  useLayoutEffect(() => {
    polishCheckoutCopy();

    const observer = new MutationObserver(() => {
      polishCheckoutCopy();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
