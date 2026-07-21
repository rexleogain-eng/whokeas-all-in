"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

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

type PaymentMethod =
  | "cash_on_delivery"
  | "manual_mobile_money"
  | "manual_bank_transfer";

type FormState = {
  fullName: string;
  phone: string;
  email: string;
  region: string;
  district: string;
  ward: string;
  addressLine: string;
  notes: string;
  paymentMethod: PaymentMethod;
};

const regions = [
  "Arusha", "Dar es Salaam", "Dodoma", "Geita", "Iringa", "Kagera",
  "Katavi", "Kigoma", "Kilimanjaro", "Lindi", "Manyara", "Mara",
  "Mbeya", "Morogoro", "Mtwara", "Mwanza", "Njombe", "Pemba North",
  "Pemba South", "Pwani", "Rukwa", "Ruvuma", "Shinyanga", "Simiyu",
  "Singida", "Songwe", "Tabora", "Tanga", "Unguja North",
  "Unguja South", "Unguja Urban West"
];

const methods: Array<{
  value: PaymentMethod;
  title: string;
  description: string;
}> = [
  {
    value: "cash_on_delivery",
    title: "Cash on Delivery",
    description:
      "Available only where delivery and collection can be confirmed.",
  },
  {
    value: "manual_mobile_money",
    title: "Mobile Money Transfer",
    description:
      "Pay using the number shown after ordering, then submit the reference.",
  },
  {
    value: "manual_bank_transfer",
    title: "NMB Bank Transfer",
    description:
      "Transfer to the displayed NMB account, then submit the reference.",
  },
];

function formatPrice(value: number) {
  return `TZS ${value.toLocaleString("en-US")}`;
}

export default function CheckoutClient() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<FormState>({
    fullName: "",
    phone: "",
    email: "",
    region: "Kilimanjaro",
    district: "",
    ward: "",
    addressLine: "",
    notes: "",
    paymentMethod: "manual_mobile_money",
  });

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

  const displayedSubtotal = useMemo(
    () => items.reduce((total, item) => total + item.price * item.quantity, 0),
    [items],
  );

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: form,
          paymentMethod: form.paymentMethod,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Could not create the order.");
      }

      localStorage.removeItem("whokeas-cart");
      window.dispatchEvent(new Event("whokeas-cart-updated"));
      window.location.href = `/order-confirmation/${result.orderNumber}`;
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create the order.",
      );
      setSubmitting(false);
    }
  }

  if (!ready) {
    return <div className="bg-white p-8">Loading checkout...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-black">Your cart is empty</h1>
        <Link
          href="/#products"
          className="mt-6 inline-block rounded-full bg-[#171512] text-white px-6 py-3 text-sm font-bold"
        >
          Return to products
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submitOrder}
      className="grid gap-5 lg:grid-cols-[1fr_380px]"
    >
      <div className="space-y-5">
        <section className="bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-[#171512]">Step 1 of 2</p>
          <h1 className="mt-2 text-3xl font-black">Delivery details</h1>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold">Full name *</span>
              <input
                required
                value={form.fullName}
                onChange={(event) =>
                  updateField("fullName", event.target.value)
                }
                className="w-full rounded-lg border border-[#cfc4b1] px-4 py-3 outline-none focus:border-[#171512]"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-bold">
                Phone number *
              </span>
              <input
                required
                inputMode="tel"
                placeholder="07XXXXXXXX or +255..."
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                className="w-full rounded-lg border border-[#cfc4b1] px-4 py-3 outline-none focus:border-[#171512]"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-bold">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="w-full rounded-lg border border-[#cfc4b1] px-4 py-3 outline-none focus:border-[#171512]"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-bold">Region *</span>
              <select
                required
                value={form.region}
                onChange={(event) => updateField("region", event.target.value)}
                className="w-full rounded-lg border border-[#cfc4b1] bg-white px-4 py-3 outline-none focus:border-[#171512]"
              >
                {regions.map((region) => (
                  <option key={region}>{region}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-sm font-bold">District *</span>
              <input
                required
                value={form.district}
                onChange={(event) =>
                  updateField("district", event.target.value)
                }
                className="w-full rounded-lg border border-[#cfc4b1] px-4 py-3 outline-none focus:border-[#171512]"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-bold">Ward</span>
              <input
                value={form.ward}
                onChange={(event) => updateField("ward", event.target.value)}
                className="w-full rounded-lg border border-[#cfc4b1] px-4 py-3 outline-none focus:border-[#171512]"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold">
                Street, village, landmark or pickup details *
              </span>
              <textarea
                required
                rows={3}
                value={form.addressLine}
                onChange={(event) =>
                  updateField("addressLine", event.target.value)
                }
                className="w-full rounded-lg border border-[#cfc4b1] px-4 py-3 outline-none focus:border-[#171512]"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold">
                Optional order notes
              </span>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                className="w-full rounded-lg border border-[#cfc4b1] px-4 py-3 outline-none focus:border-[#171512]"
              />
            </label>
          </div>
        </section>

        <section className="bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-[#171512]">Step 2 of 2</p>
          <h2 className="mt-2 text-3xl font-black">Payment method</h2>
          <p className="mt-2 text-sm text-[#6f675c]">
            Payment is verified manually before supplier fulfilment.
          </p>

          <div className="mt-6 grid gap-3">
            {methods.map((method) => {
              const selected = form.paymentMethod === method.value;

              return (
                <label
                  key={method.value}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    selected
                      ? "border-[#171512] bg-[#f3ead9] ring-1 ring-[#171512]"
                      : "border-[#cfc4b1] hover:border-slate-500"
                  }`}
                >
                  <div className="flex gap-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.value}
                      checked={selected}
                      onChange={() =>
                        updateField("paymentMethod", method.value)
                      }
                      className="mt-1"
                    />
                    <div>
                      <p className="font-black">{method.title}</p>
                      <p className="mt-1 text-sm leading-6 text-[#6f675c]">
                        {method.description}
                      </p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="h-fit bg-white p-6 shadow-sm lg:sticky lg:top-24">
        <h2 className="text-2xl font-black">Order summary</h2>

        <div className="mt-5 max-h-72 space-y-4 overflow-y-auto border-y border-[#d8cfbf] py-4">
          {items.map((item) => (
            <div key={item.key} className="flex justify-between gap-4 text-sm">
              <div>
                <p className="font-bold">{item.name}</p>
                <p className="mt-1 text-[#81796e]">
                  {item.variantName ? `${item.variantName} - ` : ""}
                  Qty {item.quantity}
                </p>
              </div>
              <p className="shrink-0 font-semibold">
                {formatPrice(item.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <span>Products</span>
            <span>{formatPrice(displayedSubtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>Confirmed separately</span>
          </div>
          <div className="flex justify-between border-t border-[#d8cfbf] pt-4 text-xl font-black text-[#9b762c]">
            <span>Current total</span>
            <span>{formatPrice(displayedSubtotal)}</span>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-full bg-[#171512] text-white px-5 py-3 text-sm font-bold shadow-sm hover:bg-[#9b762c] disabled:opacity-60"
        >
          {submitting ? "Creating order..." : "Place Order"}
        </button>

        <p className="mt-3 text-center text-xs leading-5 text-[#81796e]">
          Orders remain pending until payment or cash-on-delivery approval.
        </p>
      </aside>
    </form>
  );
}