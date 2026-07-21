"use client";

import { useMemo, useState } from "react";

type Variant = {
  id: string;
  name: string;
  price: string;
  stockQuantity: number;
};

type Props = {
  product: {
    id: string;
    slug: string;
    name: string;
    price: string;
  };
  variants: Variant[];
};

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

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem("whokeas-cart");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function AddToCart({ product, variants }: Props) {
  const [selectedVariantId, setSelectedVariantId] = useState(
    variants[0]?.id ?? "",
  );
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId),
    [selectedVariantId, variants],
  );

  const effectivePrice = Number(selectedVariant?.price ?? product.price);
  const unavailable =
    selectedVariant !== undefined && selectedVariant.stockQuantity < 1;

  function addItem() {
    if (unavailable) return;

    const cart = readCart();
    const key = `${product.id}:${selectedVariant?.id ?? "default"}`;
    const existing = cart.find((item) => item.key === key);

    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({
        key,
        productId: product.id,
        variantId: selectedVariant?.id ?? null,
        slug: product.slug,
        name: product.name,
        variantName: selectedVariant?.name ?? null,
        price: effectivePrice,
        quantity,
      });
    }

    localStorage.setItem("whokeas-cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("whokeas-cart-updated"));

    setMessage("Added to cart");
    window.setTimeout(() => setMessage(""), 2200);
  }

  return (
    <div>
      {variants.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-bold">Choose an option</legend>

          <div className="grid grid-cols-2 gap-2">
            {variants.map((variant) => {
              const active = variant.id === selectedVariantId;

              return (
                <button
                  type="button"
                  key={variant.id}
                  disabled={variant.stockQuantity < 1}
                  onClick={() => setSelectedVariantId(variant.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                    active
                      ? "border-[#ff6a00] bg-[#fff0e6] ring-1 ring-[#ff6a00]"
                      : "border-slate-300 bg-white hover:border-slate-500"
                  } disabled:cursor-not-allowed disabled:opacity-45`}
                >
                  <span className="block font-bold">{variant.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {variant.stockQuantity > 0
                      ? `${variant.stockQuantity} available`
                      : "Unavailable"}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="mt-5">
        <label htmlFor="quantity" className="mb-2 block text-sm font-bold">
          Quantity
        </label>

        <select
          id="quantity"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
          className="w-24 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm shadow-sm outline-none focus:border-[#ff6a00]"
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        disabled={unavailable}
        onClick={addItem}
        className="mt-5 w-full rounded-full bg-[#ff6a00] text-white px-5 py-3 text-sm font-bold shadow-sm transition hover:bg-[#e85f00] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {unavailable ? "Currently unavailable" : "Add to Cart"}
      </button>

      <div
        aria-live="polite"
        className="mt-3 min-h-5 text-center text-sm font-bold text-emerald-700"
      >
        {message}
      </div>
    </div>
  );
}