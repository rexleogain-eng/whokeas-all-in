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
    const frame = window.requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem("whokeas-cart");
        setItems(raw ? JSON.parse(raw) : []);
      } catch {
        setItems([]);
      } finally {
        setReady(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function save(nextItems: CartItem[]) {
    setItems(nextItems);
    localStorage.setItem("whokeas-cart", JSON.stringify(nextItems));
    window.dispatchEvent(new Event("whokeas-cart-updated"));
  }

  function changeQuantity(key: string, quantity: number) {
    save(items.map((item) => item.key === key ? { ...item, quantity: Math.max(1, quantity) } : item));
  }

  function removeItem(key: string) {
    save(items.filter((item) => item.key !== key));
  }

  const subtotal = useMemo(
    () => items.reduce((total, item) => total + item.price * item.quantity, 0),
    [items],
  );

  if (!ready) {
    return <div className="border border-[#d8cfbf] bg-[#fffdf8] p-8 text-sm text-[#746d62]">Loading cart...</div>;
  }

  if (items.length === 0) {
    return (
      <section className="border border-[#d8cfbf] bg-[#fffdf8] p-10 shadow-[0_18px_55px_rgba(39,31,21,.06)]">
        <p className="classic-kicker">Your selection</p>
        <h1 className="mt-3 text-4xl font-normal">Your cart is empty.</h1>
        <p className="mt-4 text-sm text-[#746d62]">Explore the collection and select the products you would like to order.</p>
        <Link href="/#products" className="classic-button-dark mt-7">Continue shopping</Link>
      </section>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
      <section className="border border-[#d8cfbf] bg-[#fffdf8] p-5 sm:p-7">
        <div className="border-b border-[#d8cfbf] pb-5">
          <p className="classic-kicker">Your selection</p>
          <h1 className="mt-2 text-4xl font-normal">Shopping cart</h1>
        </div>

        <div className="divide-y divide-[#ded5c7]">
          {items.map((item) => (
            <article key={item.key} className="grid gap-5 py-7 sm:grid-cols-[120px_1fr_auto]">
              <div className="flex aspect-square items-center justify-center bg-[#f1ece3] font-serif text-2xl text-[#9f9586]">WAI</div>
              <div>
                <Link href={`/products/${item.slug}`} className="text-xl font-normal hover:text-[#9b762c]">{item.name}</Link>
                {item.variantName && <p className="mt-2 text-xs text-[#746d62]">Option: {item.variantName}</p>}
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5b745f]">Available to order</p>
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <select
                    aria-label={`Quantity for ${item.name}`}
                    value={item.quantity}
                    onChange={(event) => changeQuantity(item.key, Number(event.target.value))}
                    className="border border-[#cfc4b1] bg-[#fffdf8] px-3 py-2 text-xs outline-none focus:border-[#9b762c]"
                  >
                    {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>Qty: {value}</option>)}
                  </select>
                  <button type="button" onClick={() => removeItem(item.key)} className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9b762c] hover:text-[#171512]">Remove</button>
                </div>
              </div>
              <p className="text-sm font-bold">{formatPrice(item.price)}</p>
            </article>
          ))}
        </div>
      </section>

      <aside className="h-fit border border-[#d8cfbf] bg-[#f7f2e9] p-6 lg:sticky lg:top-40">
        <p className="classic-kicker">Order summary</p>
        <div className="mt-5 flex items-end justify-between border-b border-[#d8cfbf] pb-5">
          <span className="text-sm">Subtotal ({items.reduce((total, item) => total + item.quantity, 0)} items)</span>
          <span className="text-xl font-bold">{formatPrice(subtotal)}</span>
        </div>
        <div className="mt-5 border border-[#c8bda9] bg-[#fffdf8] p-4 text-xs leading-6 text-[#625b50]">Delivery fee is confirmed before payment and supplier fulfilment.</div>
        <Link href="/checkout" className="classic-button-dark mt-5 w-full">Proceed to checkout</Link>
        <p className="mt-4 text-center text-[10px] uppercase tracking-[0.1em] text-[#8b8378]">Secure order recording · Local verification</p>
      </aside>
    </div>
  );
}
