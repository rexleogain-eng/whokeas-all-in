$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json")) {
  throw "Run this script inside C:\Users\Hp\Desktop\whokeas-all-in"
}

$utf8 = [System.Text.UTF8Encoding]::new($false)

New-Item -ItemType Directory -Force ".\src\components\store" | Out-Null
New-Item -ItemType Directory -Force ".\src\app\products\[slug]" | Out-Null
New-Item -ItemType Directory -Force ".\src\app\cart" | Out-Null

$cartButton = @'
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
      className="relative flex shrink-0 items-end rounded border border-transparent px-2 py-1 text-white hover:border-white"
    >
      <span className="absolute left-5 top-0 text-xs font-black text-[#f3b61f]">
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
'@

$addToCart = @'
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
                      ? "border-[#e49b00] bg-[#fff7df] ring-1 ring-[#e49b00]"
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
          className="w-24 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm shadow-sm outline-none focus:border-[#e49b00]"
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
        className="mt-5 w-full rounded-full bg-[#ffd814] px-5 py-3 text-sm font-bold shadow-sm transition hover:bg-[#f7ca00] disabled:cursor-not-allowed disabled:bg-slate-300"
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
'@

$cartClient = @'
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
          {items.map((item, index) => (
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
          Shipping will be calculated from the customer&apos;s region.
        </div>

        <button
          type="button"
          disabled
          className="mt-5 w-full cursor-not-allowed rounded-full bg-slate-300 px-5 py-3 text-sm font-bold text-slate-600"
        >
          Checkout setup is next
        </button>

        <p className="mt-3 text-center text-xs leading-5 text-slate-500">
          No payment will be taken from this cart yet.
        </p>
      </aside>
    </div>
  );
}
'@

$seedVariants = @'
import { db } from "../lib/db";
import { products, productVariants } from "./schema";

const variantMap: Record<
  string,
  Array<{ name: string; sku: string; stockQuantity: number }>
> = {
  "wireless-earbuds": [
    { name: "Black", sku: "WAI-EARBUD-BLK", stockQuantity: 25 },
    { name: "White", sku: "WAI-EARBUD-WHT", stockQuantity: 18 },
  ],
  "foldable-laptop-stand": [
    { name: "Silver", sku: "WAI-STAND-SLV", stockQuantity: 30 },
    { name: "Black", sku: "WAI-STAND-BLK", stockQuantity: 22 },
  ],
  "focus-study-lamp": [
    { name: "White", sku: "WAI-LAMP-WHT", stockQuantity: 20 },
    { name: "Black", sku: "WAI-LAMP-BLK", stockQuantity: 16 },
  ],
  "desk-organizer": [
    { name: "Black", sku: "WAI-ORG-BLK", stockQuantity: 20 },
    { name: "Beige", sku: "WAI-ORG-BGE", stockQuantity: 14 },
  ],
  "wai-signature-tee": [
    { name: "Black / Small", sku: "WAI-TEE-BLK-S", stockQuantity: 12 },
    { name: "Black / Medium", sku: "WAI-TEE-BLK-M", stockQuantity: 18 },
    { name: "Black / Large", sku: "WAI-TEE-BLK-L", stockQuantity: 16 },
    { name: "Black / XL", sku: "WAI-TEE-BLK-XL", stockQuantity: 10 },
  ],
  "smart-storage-set": [
    { name: "3-piece set", sku: "WAI-STORAGE-3PC", stockQuantity: 15 },
  ],
};

async function seedVariants() {
  const allProducts = await db.select().from(products);

  for (const product of allProducts) {
    const variants = variantMap[product.slug] ?? [
      {
        name: "Standard",
        sku: `WAI-${product.slug.toUpperCase().slice(0, 20)}`,
        stockQuantity: 10,
      },
    ];

    await db
      .insert(productVariants)
      .values(
        variants.map((variant) => ({
          productId: product.id,
          name: variant.name,
          sku: variant.sku,
          cost: product.baseCost ?? "0",
          price: product.price,
          stockQuantity: variant.stockQuantity,
          isActive: true,
        })),
      )
      .onConflictDoNothing({ target: productVariants.sku });
  }

  console.log("Product variants seeded successfully.");
}

seedVariants()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
'@

$productPage = @'
import { and, asc, eq, ne } from "drizzle-orm";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import AddToCart from "@/components/store/AddToCart";
import CartButton from "@/components/store/CartButton";
import { db } from "@/lib/db";
import {
  categories,
  productImages,
  products,
  productVariants,
} from "@/db/schema";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function formatPrice(value: string) {
  return `TZS ${Number(value).toLocaleString("en-US")}`;
}

async function getProduct(slug: string) {
  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      shortDescription: products.shortDescription,
      price: products.price,
      compareAtPrice: products.compareAtPrice,
      currency: products.currency,
      brand: products.brand,
      categoryId: categories.id,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.slug, slug), eq(products.status, "active")))
    .limit(1);

  if (!product) return null;

  const [images, variants, related] = await Promise.all([
    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, product.id))
      .orderBy(asc(productImages.sortOrder)),
    db
      .select({
        id: productVariants.id,
        name: productVariants.name,
        price: productVariants.price,
        stockQuantity: productVariants.stockQuantity,
      })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, product.id),
          eq(productVariants.isActive, true),
        ),
      )
      .orderBy(asc(productVariants.name)),
    product.categoryId
      ? db
          .select({
            id: products.id,
            name: products.name,
            slug: products.slug,
            price: products.price,
          })
          .from(products)
          .where(
            and(
              eq(products.categoryId, product.categoryId),
              eq(products.status, "active"),
              ne(products.id, product.id),
            ),
          )
          .limit(4)
      : Promise.resolve([]),
  ]);

  return { product, images, variants, related };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getProduct(slug);

  if (!result) {
    return { title: "Product not found" };
  }

  return {
    title: result.product.name,
    description:
      result.product.shortDescription ??
      `Shop ${result.product.name} from WHOKEAS ALL IN.`,
  };
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getProduct(slug);

  if (!result) {
    notFound();
  }

  const { product, images, variants, related } = result;
  const primaryImage = images[0]?.imageUrl;

  return (
    <main className="min-h-screen bg-[#eaeded] text-[#0f1111]">
      <header className="sticky top-0 z-50 shadow-md">
        <div className="bg-[#101820] text-white">
          <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-3 lg:px-5">
            <Link
              href="/"
              aria-label="WHOKEAS ALL IN home"
              className="flex min-w-[194px] shrink-0 items-center gap-3 rounded-md border border-transparent px-2 py-1.5 transition hover:border-white/70"
            >
              <div className="relative h-12 w-[72px] shrink-0">
                <Image
                  src="/brand/logo-mark.png"
                  alt=""
                  fill
                  priority
                  sizes="72px"
                  className="object-contain"
                />
              </div>

              <div className="hidden leading-none sm:block">
                <div className="text-[17px] font-black tracking-[0.12em]">
                  WHOKEAS
                </div>
                <div className="mt-1.5 text-[11px] font-black tracking-[0.34em] text-[#f3b61f]">
                  ALL IN
                </div>
              </div>
            </Link>

            <form
              action="/search"
              className="flex h-11 min-w-0 flex-1 overflow-hidden rounded-md bg-white ring-2 ring-transparent focus-within:ring-[#f3b61f]"
            >
              <input
                name="q"
                aria-label="Search products"
                placeholder="Search WHOKEAS ALL IN"
                className="min-w-0 flex-1 px-4 text-sm text-slate-900 outline-none"
              />
              <button
                aria-label="Search"
                className="flex w-14 items-center justify-center bg-[#f3b61f] text-slate-950 hover:bg-[#ffca3a]"
              >
                <SearchIcon />
              </button>
            </form>

            <CartButton />
          </div>
        </div>

        <nav className="bg-[#223142] text-white">
          <div className="mx-auto flex h-10 max-w-[1500px] items-center gap-5 overflow-x-auto px-4 text-sm font-semibold">
            <Link href="/">Home</Link>
            <Link href="/#products">Products</Link>
            <Link href="/#categories">Categories</Link>
            <Link href="/cart">Cart</Link>
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-5 lg:px-6">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <Link href="/" className="hover:text-[#c7511f] hover:underline">
            Home
          </Link>
          <span>/</span>
          <Link
            href="/#categories"
            className="hover:text-[#c7511f] hover:underline"
          >
            {product.categoryName ?? "Products"}
          </Link>
          <span>/</span>
          <span>{product.name}</span>
        </nav>

        <section className="grid gap-8 bg-white p-5 shadow-sm lg:grid-cols-[minmax(360px,1fr)_minmax(360px,1fr)_330px]">
          <div>
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-50 via-amber-50 to-slate-200">
              {primaryImage ? (
                <Image
                  src={primaryImage}
                  alt={images[0]?.altText ?? product.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 90vw, 520px"
                  className="object-contain p-5"
                />
              ) : (
                <div className="text-center">
                  <div className="relative mx-auto h-36 w-56">
                    <Image
                      src="/brand/logo-mark.png"
                      alt=""
                      fill
                      sizes="224px"
                      className="object-contain opacity-80"
                    />
                  </div>
                  <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                    {product.categoryName ?? "WHOKEAS product"}
                  </p>
                </div>
              )}
            </div>

            <p className="mt-3 text-center text-xs text-slate-500">
              Supplier product images will appear here after approval.
            </p>
          </div>

          <div>
            <p className="text-sm text-[#007185]">
              Visit the {product.brand ?? "WHOKEAS ALL IN"} Store
            </p>

            <h1 className="mt-2 text-3xl font-medium leading-tight">
              {product.name}
            </h1>

            <div className="mt-4 border-y border-slate-200 py-4">
              <p className="text-sm text-slate-500">Price</p>
              <p className="mt-1 text-3xl font-medium text-[#b12704]">
                {formatPrice(product.price)}
              </p>

              {product.compareAtPrice && (
                <p className="mt-1 text-sm text-slate-500 line-through">
                  {formatPrice(product.compareAtPrice)}
                </p>
              )}
            </div>

            <div className="mt-5">
              <h2 className="font-black">About this item</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                <li>
                  {product.shortDescription ??
                    "Carefully selected for the WHOKEAS ALL IN catalogue."}
                </li>
                <li>Displayed in Tanzanian shillings for clearer local pricing.</li>
                <li>Order and delivery progress will be available in your account.</li>
                <li>Product specifications are reviewed before supplier activation.</li>
              </ul>
            </div>

            {product.description && (
              <div className="mt-6 border-t border-slate-200 pt-5">
                <h2 className="font-black">Product description</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
                  {product.description}
                </p>
              </div>
            )}
          </div>

          <aside className="h-fit rounded-xl border border-slate-300 p-5 shadow-sm">
            <p className="text-2xl font-medium">{formatPrice(product.price)}</p>
            <p className="mt-4 text-sm leading-6">
              Delivery cost and estimated arrival will be calculated using the
              customer&apos;s region.
            </p>
            <p className="mt-4 text-lg font-medium text-emerald-700">
              Available to order
            </p>

            <div className="mt-5">
              <AddToCart
                product={{
                  id: product.id,
                  slug: product.slug,
                  name: product.name,
                  price: product.price,
                }}
                variants={variants}
              />
            </div>

            <div className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Ships from</span>
                <span className="text-right font-semibold">Approved supplier</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Sold by</span>
                <span className="text-right font-semibold">WHOKEAS ALL IN</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Payment</span>
                <span className="text-right font-semibold">Secure checkout</span>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-5 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black">Product information</h2>

          <dl className="mt-5 grid max-w-3xl border border-slate-200 sm:grid-cols-[220px_1fr]">
            {[
              ["Brand", product.brand ?? "WHOKEAS ALL IN"],
              ["Category", product.categoryName ?? "General"],
              ["Currency", product.currency],
              ["Availability", "Active catalogue product"],
            ].map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="border-b border-slate-200 bg-slate-100 p-3 text-sm font-bold">
                  {label}
                </dt>
                <dd className="border-b border-slate-200 p-3 text-sm">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {related.length > 0 && (
          <section className="mt-5 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black">Related products</h2>

            <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
              {related.map((item) => (
                <Link href={`/products/${item.slug}`} key={item.id}>
                  <div className="flex aspect-square items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-amber-100">
                    <span className="text-xl font-black text-slate-500">WAI</span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold hover:text-[#c7511f]">
                    {item.name}
                  </h3>
                  <p className="mt-1 font-black">{formatPrice(item.price)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
'@

$cartPage = @'
import Image from "next/image";
import Link from "next/link";

import CartButton from "@/components/store/CartButton";
import CartClient from "@/components/store/CartClient";

export const metadata = {
  title: "Shopping Cart",
};

export default function CartPage() {
  return (
    <main className="min-h-screen bg-[#eaeded] text-[#0f1111]">
      <header className="bg-[#101820] text-white shadow-md">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-4 px-4 lg:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-12 w-[72px]">
              <Image
                src="/brand/logo-mark.png"
                alt=""
                fill
                priority
                sizes="72px"
                className="object-contain"
              />
            </div>
            <div>
              <div className="font-black tracking-[0.12em]">WHOKEAS</div>
              <div className="text-[10px] font-black tracking-[0.3em] text-[#f3b61f]">
                ALL IN
              </div>
            </div>
          </Link>

          <CartButton />
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-6 lg:px-6">
        <CartClient />
      </div>
    </main>
  );
}
'@

$loadingPage = @'
export default function ProductLoading() {
  return (
    <main className="min-h-screen animate-pulse bg-[#eaeded] p-6">
      <div className="mx-auto grid max-w-[1500px] gap-8 bg-white p-6 lg:grid-cols-3">
        <div className="aspect-square rounded-lg bg-slate-200" />
        <div className="space-y-5">
          <div className="h-6 w-1/3 rounded bg-slate-200" />
          <div className="h-12 rounded bg-slate-200" />
          <div className="h-10 w-1/2 rounded bg-slate-200" />
          <div className="h-44 rounded bg-slate-200" />
        </div>
        <div className="h-96 rounded-xl bg-slate-200" />
      </div>
    </main>
  );
}
'@

$notFoundPage = @'
import Link from "next/link";

export default function ProductNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eaeded] p-6">
      <div className="max-w-lg bg-white p-10 text-center shadow-sm">
        <h1 className="text-4xl font-black">Product not found</h1>
        <p className="mt-4 text-slate-600">
          This product may be unavailable, archived or incorrectly linked.
        </p>
        <Link
          href="/#products"
          className="mt-7 inline-block rounded-full bg-[#ffd814] px-6 py-3 text-sm font-bold hover:bg-[#f7ca00]"
        >
          Return to products
        </Link>
      </div>
    </main>
  );
}
'@

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\components\store\CartButton.tsx"),
  $cartButton,
  $utf8
)

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\components\store\AddToCart.tsx"),
  $addToCart,
  $utf8
)

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\components\store\CartClient.tsx"),
  $cartClient,
  $utf8
)

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\db\seed-variants.ts"),
  $seedVariants,
  $utf8
)

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\app\products\[slug]\page.tsx"),
  $productPage,
  $utf8
)

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\app\products\[slug]\loading.tsx"),
  $loadingPage,
  $utf8
)

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\app\products\[slug]\not-found.tsx"),
  $notFoundPage,
  $utf8
)

[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location) "src\app\cart\page.tsx"),
  $cartPage,
  $utf8
)

# Upgrade the homepage cart button from static to live.
$homePagePath = (Resolve-Path ".\src\app\page.tsx").Path
$homePageSource = [System.IO.File]::ReadAllText($homePagePath)

if ($homePageSource -notmatch 'components/store/CartButton') {
  $homePageSource = $homePageSource.Replace(
    'import Link from "next/link";',
    'import Link from "next/link";' + [Environment]::NewLine + 'import CartButton from "@/components/store/CartButton";'
  )
}

$staticCartPattern = '(?s)<button className="relative flex shrink-0 items-end rounded border border-transparent px-2 py-1 hover:border-white">.*?</button>'
$homePageUpdated = [regex]::Replace($homePageSource, $staticCartPattern, '<CartButton />', 1)

if ($homePageUpdated -eq $homePageSource) {
  Write-Warning "The homepage static cart button was not found. Product and cart pages were still created."
}

[System.IO.File]::WriteAllText($homePagePath, $homePageUpdated, $utf8)

Write-Host "Seeding real product variants..." -ForegroundColor Cyan
npx tsx .\src\db\seed-variants.ts

Remove-Item -Recurse -Force ".\.next" -ErrorAction SilentlyContinue

Write-Host "Running production build verification..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "Product pages and working cart installed successfully." -ForegroundColor Green
Write-Host "Run: npm run dev" -ForegroundColor Yellow
