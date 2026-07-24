"use client";

import Link from "next/link";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

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
  | "manual_bank_transfer"
  | "international_payment_request";

type Market = {
  countryCode: string;
  countryName: string;
  currency: string;
  locale: string;
  primary: boolean;
};

type Quote = {
  countryCode: string;
  countryName: string;
  currency: string;
  locale: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  items: Array<{
    productId: string;
    variantId: string | null;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

type FormState = {
  fullName: string;
  phone: string;
  email: string;
  countryCode: string;
  region: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2: string;
  notes: string;
  paymentMethod: PaymentMethod;
  createAccount: boolean;
  password: string;
};

function formatMoney(
  value: number,
  currency: string,
  locale: string,
) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits:
        currency === "TZS" ? 0 : 2,
    }).format(value);
  }
  catch {
    return `${currency} ${value.toLocaleString("en-US")}`;
  }
}

export default function CheckoutClient() {
  const [items, setItems] =
    useState<CartItem[]>([]);

  const [markets, setMarkets] =
    useState<Market[]>([]);

  const [quote, setQuote] =
    useState<Quote | null>(null);

  const [account, setAccount] =
    useState<{
      authenticated: boolean;
      fullName?: string;
      email?: string;
    }>({ authenticated: false });

  const [ready, setReady] =
    useState(false);

  const [quoteBusy, setQuoteBusy] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [quoteError, setQuoteError] =
    useState("");

  const [form, setForm] =
    useState<FormState>({
      fullName: "",
      phone: "",
      email: "",
      countryCode: "TZ",
      region: "",
      city: "",
      postalCode: "",
      addressLine1: "",
      addressLine2: "",
      notes: "",
      paymentMethod: "manual_mobile_money",
      createAccount: false,
      password: "",
    });

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      let storedItems: CartItem[] = [];

      try {
        const raw =
          localStorage.getItem("whokeas-cart");

        storedItems = raw
          ? JSON.parse(raw)
          : [];
      }
      catch {
        storedItems = [];
      }

      setItems(storedItems);

      try {
        const [marketsResponse, accountResponse] =
          await Promise.all([
            fetch("/api/checkout/markets", {
              cache: "no-store",
            }),

            fetch("/api/customer/me", {
              cache: "no-store",
            }),
          ]);

        const marketsResult =
          await marketsResponse.json();

        const accountResult =
          await accountResponse.json();

        if (cancelled) return;

        if (
          marketsResponse.ok &&
          marketsResult.ok &&
          Array.isArray(marketsResult.markets)
        ) {
          setMarkets(marketsResult.markets);
        }

        if (
          accountResponse.ok &&
          accountResult.ok &&
          accountResult.authenticated
        ) {
          setAccount({
            authenticated: true,
            fullName:
              accountResult.customer?.fullName,
            email:
              accountResult.customer?.email,
          });

          const address = accountResult.address;
          const customer = accountResult.customer;

          setForm((current) => ({
            ...current,
            fullName:
              address?.recipientName ||
              customer?.fullName ||
              "",

            phone:
              address?.phone ||
              customer?.phone ||
              "",

            email:
              customer?.email || "",

            countryCode:
              address?.countryCode ||
              customer?.countryCode ||
              "TZ",

            region:
              address?.region || "",

            city:
              address?.city || "",

            postalCode:
              address?.postalCode || "",

            addressLine1:
              address?.addressLine1 || "",

            addressLine2:
              address?.addressLine2 || "",

            paymentMethod:
              (
                address?.countryCode ||
                customer?.countryCode
              ) === "TZ"
                ? "manual_mobile_money"
                : "international_payment_request",
          }));
        }
      }
      catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not prepare checkout.",
          );
        }
      }
      finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !ready ||
      items.length === 0 ||
      !form.countryCode
    ) {
      return;
    }

    const controller = new AbortController();

    async function loadQuote() {
      setQuoteBusy(true);
      setQuoteError("");

      try {
        const response = await fetch(
          "/api/checkout/quote",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            signal: controller.signal,
            body: JSON.stringify({
              countryCode: form.countryCode,
              items: items.map((item) => ({
                productId: item.productId,
                variantId: item.variantId,
                quantity: item.quantity,
              })),
            }),
          },
        );

        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(
            result.error ||
              "Could not calculate market pricing.",
          );
        }

        setQuote(result.quote);
      }
      catch (caught) {
        if (
          caught instanceof DOMException &&
          caught.name === "AbortError"
        ) {
          return;
        }

        setQuote(null);
        setQuoteError(
          caught instanceof Error
            ? caught.message
            : "Could not calculate market pricing.",
        );
      }
      finally {
        if (!controller.signal.aborted) {
          setQuoteBusy(false);
        }
      }
    }

    loadQuote();

    return () => controller.abort();
  }, [
    ready,
    items,
    form.countryCode,
  ]);

  const selectedMarket = useMemo(
    () =>
      markets.find(
        (market) =>
          market.countryCode ===
          form.countryCode,
      ) || null,
    [markets, form.countryCode],
  );

  const isTanzania =
    form.countryCode === "TZ";

  const paymentMethods: Array<{
    value: PaymentMethod;
    title: string;
    description: string;
  }> = isTanzania
    ? [
        {
          value: "manual_mobile_money",
          title: "Mobile Money Transfer",
          description:
            "Pay using the local number shown after ordering, then submit the transaction reference.",
        },
        {
          value: "manual_bank_transfer",
          title: "NMB Bank Transfer",
          description:
            "Transfer to the displayed bank account, then submit the transaction reference.",
        },
        {
          value: "cash_on_delivery",
          title: "Cash on Delivery",
          description:
            "Available only where delivery and collection can be confirmed.",
        },
      ]
    : [
        {
          value:
            "international_payment_request",
          title:
            "Secure International Payment Link",
          description:
            "Place the order now. WHOKEAS will send a secure online payment link to your email before fulfilment.",
        },
      ];

  function updateField<
    K extends keyof FormState
  >(
    field: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function changeCountry(value: string) {
    setForm((current) => ({
      ...current,
      countryCode: value,
      paymentMethod:
        value === "TZ"
          ? "manual_mobile_money"
          : "international_payment_request",
    }));
  }

  async function submitOrder(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");

    if (items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    if (!quote) {
      setError(
        quoteError ||
          "Wait for market pricing to finish.",
      );

      return;
    }

    if (
      form.createAccount &&
      form.password.length < 8
    ) {
      setError(
        "Account passwords require at least eight characters.",
      );

      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        "/api/orders",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customer: {
              fullName: form.fullName,
              phone: form.phone,
              email: form.email,
              countryCode: form.countryCode,
              countryName:
                selectedMarket?.countryName ||
                quote.countryName,
              region: form.region,
              city: form.city,
              postalCode: form.postalCode,
              addressLine1:
                form.addressLine1,
              addressLine2:
                form.addressLine2,
              notes: form.notes,
            },

            paymentMethod:
              form.paymentMethod,

            createAccount:
              !account.authenticated &&
              form.createAccount,

            password:
              !account.authenticated &&
              form.createAccount
                ? form.password
                : undefined,

            items: items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
            })),
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.error ||
            "Could not create the order.",
        );
      }

      localStorage.removeItem("whokeas-cart");

      window.dispatchEvent(
        new Event("whokeas-cart-updated"),
      );

      const key = result.accessKey
        ? `?key=${encodeURIComponent(
            result.accessKey,
          )}`
        : "";

      window.location.href =
        `/order-confirmation/${encodeURIComponent(
          result.orderNumber,
        )}${key}`;
    }
    catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create the order.",
      );

      setSubmitting(false);
    }
  }

  if (!ready) {
    return (
      <div className="border border-[#d8cfbf] bg-[#fffdf8] p-8">
        Preparing international checkout…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border border-[#d8cfbf] bg-[#fffdf8] p-8">
        <h1 className="text-3xl font-black">
          Your cart is empty
        </h1>

        <Link
          href="/products"
          className="classic-button-dark mt-6"
        >
          Return to products
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submitOrder}
      className="grid gap-6 lg:grid-cols-[1fr_400px]"
    >
      <div className="space-y-6">
        <section className="border border-[#d8cfbf] bg-[#fffdf8] p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="classic-kicker">
                Guest or customer
              </p>

              <h1 className="mt-2 text-4xl font-normal">
                International delivery details
              </h1>
            </div>

            {account.authenticated ? (
              <Link
                href="/account"
                className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800"
              >
                Signed in
              </Link>
            ) : (
              <Link
                href="/account/login"
                className="border border-[#cfc4b1] bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#514a40]"
              >
                Sign in
              </Link>
            )}
          </div>

          <p className="mt-4 text-sm leading-6 text-[#746d62]">
            Registration is optional. Guest checkout
            remains available for the fastest purchase.
          </p>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold">
                Full name *
              </span>

              <input
                required
                autoComplete="name"
                value={form.fullName}
                onChange={(event) =>
                  updateField(
                    "fullName",
                    event.target.value,
                  )
                }
                className="w-full border border-[#cfc4b1] bg-white px-4 py-3 outline-none focus:border-[#9b762c]"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-bold">
                Email address *
              </span>

              <input
                required
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) =>
                  updateField(
                    "email",
                    event.target.value,
                  )
                }
                className="w-full border border-[#cfc4b1] bg-white px-4 py-3 outline-none focus:border-[#9b762c]"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-bold">
                Phone number *
              </span>

              <input
                required
                inputMode="tel"
                autoComplete="tel"
                placeholder="+255..., +1..., +44..."
                value={form.phone}
                onChange={(event) =>
                  updateField(
                    "phone",
                    event.target.value,
                  )
                }
                className="w-full border border-[#cfc4b1] bg-white px-4 py-3 outline-none focus:border-[#9b762c]"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-bold">
                Delivery country *
              </span>

              <select
                required
                value={form.countryCode}
                onChange={(event) =>
                  changeCountry(event.target.value)
                }
                className="w-full border border-[#cfc4b1] bg-white px-4 py-3 outline-none focus:border-[#9b762c]"
              >
                {markets.map((market) => (
                  <option
                    key={market.countryCode}
                    value={market.countryCode}
                  >
                    {market.countryName} ·{" "}
                    {market.currency}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-sm font-bold">
                State, province or region
              </span>

              <input
                autoComplete="address-level1"
                value={form.region}
                onChange={(event) =>
                  updateField(
                    "region",
                    event.target.value,
                  )
                }
                className="w-full border border-[#cfc4b1] bg-white px-4 py-3 outline-none focus:border-[#9b762c]"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-bold">
                City or district *
              </span>

              <input
                required
                autoComplete="address-level2"
                value={form.city}
                onChange={(event) =>
                  updateField(
                    "city",
                    event.target.value,
                  )
                }
                className="w-full border border-[#cfc4b1] bg-white px-4 py-3 outline-none focus:border-[#9b762c]"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-bold">
                Postal or ZIP code
              </span>

              <input
                autoComplete="postal-code"
                value={form.postalCode}
                onChange={(event) =>
                  updateField(
                    "postalCode",
                    event.target.value,
                  )
                }
                className="w-full border border-[#cfc4b1] bg-white px-4 py-3 outline-none focus:border-[#9b762c]"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold">
                Address line 1 *
              </span>

              <input
                required
                autoComplete="address-line1"
                placeholder="Street, building, house or delivery point"
                value={form.addressLine1}
                onChange={(event) =>
                  updateField(
                    "addressLine1",
                    event.target.value,
                  )
                }
                className="w-full border border-[#cfc4b1] bg-white px-4 py-3 outline-none focus:border-[#9b762c]"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold">
                Address line 2
              </span>

              <input
                autoComplete="address-line2"
                placeholder="Apartment, landmark or additional delivery detail"
                value={form.addressLine2}
                onChange={(event) =>
                  updateField(
                    "addressLine2",
                    event.target.value,
                  )
                }
                className="w-full border border-[#cfc4b1] bg-white px-4 py-3 outline-none focus:border-[#9b762c]"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold">
                Optional order notes
              </span>

              <textarea
                rows={2}
                value={form.notes}
                onChange={(event) =>
                  updateField(
                    "notes",
                    event.target.value,
                  )
                }
                className="w-full border border-[#cfc4b1] bg-white px-4 py-3 outline-none focus:border-[#9b762c]"
              />
            </label>
          </div>

          {!account.authenticated && (
            <div className="mt-7 border border-[#d8cfbf] bg-[#f7f2e9] p-5">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.createAccount}
                  onChange={(event) =>
                    updateField(
                      "createAccount",
                      event.target.checked,
                    )
                  }
                  className="mt-1 h-4 w-4 accent-[#9b762c]"
                />

                <span>
                  <span className="block font-bold">
                    Create my WHOKEAS customer account
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-[#746d62]">
                    Save this address and monitor the
                    order from your private dashboard.
                  </span>
                </span>
              </label>

              {form.createAccount && (
                <label className="mt-5 block">
                  <span className="mb-2 block text-sm font-bold">
                    Choose a password *
                  </span>

                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(event) =>
                      updateField(
                        "password",
                        event.target.value,
                      )
                    }
                    className="w-full border border-[#cfc4b1] bg-white px-4 py-3 outline-none focus:border-[#9b762c]"
                  />

                  <span className="mt-2 block text-xs text-[#746d62]">
                    At least eight characters, including
                    one letter and one number.
                  </span>
                </label>
              )}
            </div>
          )}
        </section>

        <section className="border border-[#d8cfbf] bg-[#fffdf8] p-6 sm:p-7">
          <p className="classic-kicker">
            Payment
          </p>

          <h2 className="mt-2 text-3xl font-normal">
            Choose the available method
          </h2>

          <div className="mt-6 grid gap-3">
            {paymentMethods.map((method) => {
              const selected =
                form.paymentMethod === method.value;

              return (
                <label
                  key={method.value}
                  className={`cursor-pointer border p-4 transition ${
                    selected
                      ? "border-[#171512] bg-[#f3ead9] ring-1 ring-[#171512]"
                      : "border-[#cfc4b1] bg-white hover:border-[#9b762c]"
                  }`}
                >
                  <div className="flex gap-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.value}
                      checked={selected}
                      onChange={() =>
                        updateField(
                          "paymentMethod",
                          method.value,
                        )
                      }
                      className="mt-1"
                    />

                    <div>
                      <p className="font-bold">
                        {method.title}
                      </p>

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

      <aside className="h-fit border border-[#d8cfbf] bg-[#fffdf8] p-6 lg:sticky lg:top-40">
        <p className="classic-kicker">
          Market quote
        </p>

        <h2 className="mt-2 text-3xl font-normal">
          Order summary
        </h2>

        {quoteBusy && (
          <div className="mt-5 border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
            Calculating pricing for your delivery
            country…
          </div>
        )}

        {quoteError && (
          <div className="mt-5 border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {quoteError}
          </div>
        )}

        {quote && (
          <>
            <div className="mt-5 max-h-80 space-y-4 overflow-y-auto border-y border-[#d8cfbf] py-4">
              {quote.items.map((item) => (
                <div
                  key={`${item.productId}-${item.variantId || ""}`}
                  className="flex justify-between gap-4 text-sm"
                >
                  <div>
                    <p className="font-bold">
                      {item.productName}
                    </p>

                    <p className="mt-1 text-[#81796e]">
                      {item.variantName
                        ? `${item.variantName} · `
                        : ""}
                      Qty {item.quantity}
                    </p>
                  </div>

                  <p className="shrink-0 font-semibold">
                    {formatMoney(
                      item.lineTotal,
                      quote.currency,
                      quote.locale,
                    )}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Products and estimated delivery</span>

                <span>
                  {formatMoney(
                    quote.subtotal,
                    quote.currency,
                    quote.locale,
                  )}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Additional checkout fee</span>
                <span>None</span>
              </div>

              <div className="flex justify-between border-t border-[#d8cfbf] pt-4 text-xl font-bold text-[#9b762c]">
                <span>Total</span>

                <span>
                  {formatMoney(
                    quote.total,
                    quote.currency,
                    quote.locale,
                  )}
                </span>
              </div>
            </div>

            <p className="mt-4 border border-[#c8bda9] bg-[#f7f2e9] p-4 text-xs leading-6 text-[#625b50]">
              Market: {quote.countryName}. Final supplier
              fulfilment begins after payment verification.
            </p>
          </>
        )}

        {error && (
          <div className="mt-5 border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={
            submitting ||
            quoteBusy ||
            !quote
          }
          className="mt-6 w-full bg-[#171512] px-5 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-white hover:bg-[#9b762c] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? "Creating secure order…"
            : account.authenticated
              ? "Place order"
              : form.createAccount
                ? "Place order and create account"
                : "Continue as guest"}
        </button>

        <p className="mt-4 text-center text-[10px] uppercase tracking-[0.1em] text-[#8b8378]">
          Guest checkout · Secure order access ·
          International addresses
        </p>
      </aside>
    </form>
  );
}