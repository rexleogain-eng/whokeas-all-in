"use client";

import { useLayoutEffect } from "react";

function enforceUsCountry() {
  const selects = Array.from(document.querySelectorAll("select"));

  for (const select of selects) {
    const hasUsOption = Array.from(select.options).some(
      (option) => option.value === "US",
    );

    if (!hasUsOption || select.value === "US") continue;

    select.value = "US";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

export default function CheckoutUsGuard() {
  useLayoutEffect(() => {
    enforceUsCountry();

    const observer = new MutationObserver(() => {
      enforceUsCountry();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
