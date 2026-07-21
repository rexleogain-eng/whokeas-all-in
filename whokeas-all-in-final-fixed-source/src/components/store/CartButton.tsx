"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StoredCartItem = {
  quantity: number;
};

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
      className="relative flex shrink-0 items-end rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-800 hover:border-[#ff6a00] hover:text-[#ff6a00]"
    >
      <span className="absolute left-5 top-0 text-xs font-black text-[#ff6a00]">
        {count}
      </span>

      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H7" />
        <circle cx="10" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </svg>

      <span className="hidden text-sm font-bold sm:inline">Cart</span>
    </Link>
  );
}