import Image from "next/image";
import Link from "next/link";

import CartButton from "@/components/store/CartButton";

const nav = ["Tech", "Home", "Fashion", "Beauty", "Study", "Accessories"];

export default function StoreHeader({ query = "" }: { query?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-orange-100 bg-white shadow-sm">
      <div className="bg-[#ff6a00] px-4 py-2 text-center text-xs font-bold text-white sm:text-sm">
        Global products • Tanzania delivery support • Prices in TZS
      </div>

      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-3 lg:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <div className="relative h-11 w-16">
            <Image
              src="/brand/logo-mark.png"
              alt="WHOKEAS ALL IN"
              fill
              priority
              sizes="64px"
              className="object-contain"
            />
          </div>
          <div className="hidden leading-none sm:block">
            <div className="font-black tracking-[0.12em] text-[#172033]">
              WHOKEAS
            </div>
            <div className="mt-1 text-[10px] font-black tracking-[0.3em] text-[#ff6a00]">
              ALL IN
            </div>
          </div>
        </Link>

        <form
          action="/products"
          className="flex min-w-0 flex-1 overflow-hidden rounded-full border-2 border-[#ff6a00] bg-white"
        >
          <input
            name="q"
            defaultValue={query}
            aria-label="Search products"
            placeholder="What are you looking for?"
            className="min-w-0 flex-1 px-4 py-2.5 text-sm outline-none"
          />
          <button className="bg-[#ff6a00] px-5 text-sm font-black text-white hover:bg-[#e85f00]">
            Search
          </button>
        </form>

        <Link
          href="/admin/login"
          className="hidden text-sm font-bold text-slate-700 hover:text-[#ff6a00] md:block"
        >
          Account
        </Link>
        <CartButton />
      </div>

      <nav className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center gap-1 overflow-x-auto px-3 py-2 text-sm lg:px-6">
          <Link
            href="/products"
            className="shrink-0 rounded-full bg-[#fff0e6] px-4 py-2 font-black text-[#e85f00]"
          >
            All products
          </Link>
          {nav.map((item) => (
            <Link
              key={item}
              href={`/products?category=${encodeURIComponent(item)}`}
              className="shrink-0 rounded-full px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100 hover:text-[#ff6a00]"
            >
              {item}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
