"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CartItem = {
  key: string;
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  variantName: string | null;
  price: number;
  quantity: number;
};

function formatPrice(value: number) {
  return `TZS ${value.toLocaleString("en-US")}`;
}

export default function CartClient() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("whokeas-cart");
      setItems(raw ? JSON.parse(raw) : []);
    } catch {
      setItems([]);
    } finally {
      setReady(true);
    }
  }, []);

  function save(nextItems: CartItem[]) {
    setItems(nextItems);
    localStorage.setItem("whokeas-cart", JSON.stringify(nextItems));
    window.dispatchEvent(new Event("whokeas-cart-updated"));
  }

  function changeQuantity(key: string, quantity: number) {
    save(
      items.map((item) =>
        item.key === key ? { ...item, quantity: Math.max(1, quantity) } : item,
      ),
    );
  }

  function removeItem(key: string) {
    save(items.filter((item) => item.key !== key));
  }

  const subtotal = useMemo(
    () => items.reduce((total, item) => total + item.price * item.quantity, 0),
    [items],
  );

  if (!ready) {
    return <div className="p-8 text-sm text-slate-500">Loading cart...</div>;
  }

  if (items.length === 0) {
    return (
      <section className="bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-black">Your cart is empty</h1>
        <p className="mt-3 text-slate-600">
          Explore the store and add products you want to order.
        </p>
        <Link
          href="/#products"
          className="mt-6 inline-block rounded-full bg-[#ffd814] px-6 py-3 text-sm font-bold hover:bg-[#f7ca00]"
        >
          Continue shopping
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
      <section className="bg-white p-5 shadow-sm">
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-3xl font-black">Shopping Cart</h1>
        </div>

        <div className="divide-y divide-slate-200">
          {items.map((item) => (
            <article
              key={item.key}
              className="grid gap-4 py-6 sm:grid-cols-[140px_1fr_auto]"
            >
              <div className="flex aspect-square items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-amber-100">
                <span className="text-2xl font-black text-slate-500">WAI</span>
              </div>

              <div>
                <Link
                  href={`/products/${item.slug}`}
                  className="text-lg font-bold hover:text-[#c7511f]"
                >
                  {item.name}
                </Link>

                {item.variantName && (
                  <p className="mt-2 text-sm text-slate-500">
                    Option: {item.variantName}
                  </p>
                )}

                <p className="mt-2 text-sm font-semibold text-emerald-700">
                  Available to order
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <select
                    aria-label={`Quantity for ${item.name}`}
                    value={item.quantity}
                    onChange={(event) =>
                      changeQuantity(item.key, Number(event.target.value))
                    }
                    className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        Qty: {value}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    className="text-sm font-semibold text-[#007185] hover:text-[#c7511f] hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <p className="font-black">{formatPrice(item.price)}</p>
            </article>
          ))}
        </div>
      </section>

      <aside className="h-fit bg-white p-5 shadow-sm lg:sticky lg:top-32">
        <p className="text-lg">
          Subtotal ({items.reduce((total, item) => total + item.quantity, 0)}{" "}
          items):
          <span className="ml-2 font-black">{formatPrice(subtotal)}</span>
        </p>

        <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          Delivery fee will be confirmed before payment.
        </div>

        <Link
          href="/checkout"
          className="mt-5 block w-full rounded-full bg-[#ffd814] px-5 py-3 text-center text-sm font-bold shadow-sm hover:bg-[#f7ca00]"
        >
          Proceed to Checkout
        </Link>

        <p className="mt-3 text-center text-xs leading-5 text-slate-500">
          No payment is taken during this test checkout.
        </p>
      </aside>
    </div>
  );
}