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
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId),
    [selectedVariantId, variants],
  );

  const effectivePrice = Number(selectedVariant?.price ?? product.price);
  const unavailable = selectedVariant !== undefined && selectedVariant.stockQuantity < 1;

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
    setMessage("Added to your cart");
    window.setTimeout(() => setMessage(""), 2200);
  }

  return (
    <div>
      {variants.length > 0 && (
        <fieldset>
          <legend className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#746d62]">
            Choose an option
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {variants.map((variant) => {
              const active = variant.id === selectedVariantId;
              return (
                <button
                  type="button"
                  key={variant.id}
                  disabled={variant.stockQuantity < 1}
                  onClick={() => setSelectedVariantId(variant.id)}
                  className={`border px-3 py-3 text-left text-xs ${
                    active
                      ? "border-[#9b762c] bg-[#f3ead9] text-[#171512]"
                      : "border-[#cfc4b1] bg-[#fffdf8] text-[#514a40] hover:border-[#9b762c]"
                  } disabled:cursor-not-allowed disabled:opacity-45`}
                >
                  <span className="block font-bold">{variant.name}</span>
                  <span className="mt-1 block text-[10px] text-[#8b8378]">
                    {variant.stockQuantity > 0 ? `${variant.stockQuantity} available` : "Unavailable"}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="mt-5">
        <label htmlFor="quantity" className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#746d62]">
          Quantity
        </label>
        <select
          id="quantity"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
          className="w-24 border border-[#cfc4b1] bg-[#fffdf8] px-3 py-2.5 text-sm outline-none focus:border-[#9b762c]"
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </div>

      <button
        type="button"
        disabled={unavailable}
        onClick={addItem}
        className="mt-5 w-full border border-[#171512] bg-[#171512] px-5 py-4 text-xs font-bold uppercase tracking-[0.16em] text-white hover:border-[#9b762c] hover:bg-[#9b762c] disabled:cursor-not-allowed disabled:border-[#aaa197] disabled:bg-[#aaa197]"
      >
        {unavailable ? "Currently unavailable" : "Add to cart"}
      </button>

      <div aria-live="polite" className="mt-3 min-h-5 text-center text-xs font-bold uppercase tracking-[0.1em] text-[#5b745f]">
        {message}
      </div>
    </div>
  );
}
