"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StoredCartItem = { quantity: number };

function getCartCount() {
  try {
    const raw = localStorage.getItem("whokeas-cart");
    const items: StoredCartItem[] = raw ? JSON.parse(raw) : [];
    return items.reduce(
      (total, item) => total + Math.max(0, Number(item.quantity) || 0),
      0,
    );
  } catch {
    return 0;
  }
}

export default function CartButton() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => setCount(getCartCount());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("whokeas-cart-updated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("whokeas-cart-updated", refresh);
    };
  }, []);

  return (
    <Link
      href="/cart"
      aria-label={`Cart with ${count} item${count === 1 ? "" : "s"}`}
      className="relative flex shrink-0 items-center gap-2 border border-[#cfc4b1] bg-[#fffdf8] px-3 py-2.5 text-[#171512] hover:border-[#9b762c] hover:text-[#9b762c]"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H7" />
        <circle cx="10" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </svg>
      <span className="hidden text-xs font-bold uppercase tracking-[0.12em] sm:inline">
        Cart
      </span>
      <span className="flex h-5 min-w-5 items-center justify-center bg-[#9b762c] px-1 text-[10px] font-black text-white">
        {count}
      </span>
    </Link>
  );
}
