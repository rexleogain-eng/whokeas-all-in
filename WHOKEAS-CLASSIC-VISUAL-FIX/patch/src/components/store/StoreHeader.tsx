import Image from "next/image";
import Link from "next/link";

import CartButton from "@/components/store/CartButton";

const nav = ["Tech", "Home", "Fashion", "Beauty", "Study", "Accessories"];

export default function StoreHeader({ query = "" }: { query?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#d8cfbf] bg-[#fffdf8]/95 shadow-[0_10px_35px_rgba(28,24,18,0.06)] backdrop-blur">
      <div className="bg-[#12110f] px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d6bd7b] sm:text-xs">
        Tanzania-first service · Prices in TZS · Order support from WHOKEAS
      </div>

      <div className="mx-auto grid max-w-[1580px] grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 lg:gap-7 lg:px-7">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <div className="relative flex h-14 w-16 items-center justify-center overflow-hidden border border-[#9b762c]/55 bg-[#171512] shadow-[0_8px_24px_rgba(23,21,18,.18)] sm:h-16 sm:w-20">
            <Image
              src="/brand/logo-mark.png"
              alt="WHOKEAS ALL IN"
              fill
              priority
              sizes="64px"
              className="object-contain p-1.5 drop-shadow-[0_2px_8px_rgba(214,189,123,.32)]"
            />
          </div>
          <div className="hidden leading-none md:block">
            <div className="text-[16px] font-black tracking-[0.17em] text-[#171512] lg:text-[17px]">
              WHOKEAS
            </div>
            <div className="mt-1.5 text-[10px] font-bold tracking-[0.34em] text-[#9b762c]">
              ALL IN
            </div>
          </div>
        </Link>

        <form
          action="/products"
          className="mx-auto flex w-full max-w-3xl overflow-hidden border border-[#cfc4b1] bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.7)] focus-within:border-[#9b762c]"
        >
          <input
            name="q"
            defaultValue={query}
            aria-label="Search products"
            placeholder="Search the WHOKEAS collection"
            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-[#242019] outline-none placeholder:text-[#91897c]"
          />
          <button className="border-l border-[#cfc4b1] bg-[#171512] px-5 text-xs font-bold uppercase tracking-[0.14em] text-white hover:bg-[#9b762c] sm:px-7">
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          <Link
            href="/#support"
            className="hidden px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#514a40] hover:text-[#9b762c] lg:block"
          >
            Support
          </Link>
          <CartButton />
        </div>
      </div>

      <nav className="border-t border-[#e6ded1] bg-[#f7f2e9]">
        <div className="mx-auto flex max-w-[1580px] items-center gap-7 overflow-x-auto px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#514a40] lg:px-7">
          <Link href="/products" className="shrink-0 text-[#9b762c] hover:text-[#171512]">
            Shop all
          </Link>
          {nav.map((item) => (
            <Link
              key={item}
              href={`/products?category=${encodeURIComponent(item)}`}
              className="shrink-0 hover:text-[#9b762c]"
            >
              {item}
            </Link>
          ))}
          <Link href="/products?sort=newest" className="shrink-0 hover:text-[#9b762c]">
            New arrivals
          </Link>
        </div>
      </nav>
    </header>
  );
}
