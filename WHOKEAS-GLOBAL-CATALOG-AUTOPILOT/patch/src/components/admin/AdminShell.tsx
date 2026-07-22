import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type AdminSection = "overview" | "orders" | "products" | "cj" | "automation";

type Props = {
  active: AdminSection;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
};

const navItems: Array<{
  key: AdminSection;
  href: string;
  label: string;
  short: string;
}> = [
  { key: "overview", href: "/admin", label: "Overview", short: "OV" },
  { key: "orders", href: "/admin/orders", label: "Orders", short: "OR" },
  { key: "products", href: "/admin/products", label: "Products", short: "PR" },
  { key: "cj", href: "/admin/cj", label: "CJ Sourcing", short: "CJ" },
  { key: "automation", href: "/admin/automation", label: "Automation", short: "AU" },
];

export default function AdminShell({
  active,
  eyebrow,
  title,
  description,
  children,
  actions,
}: Props) {
  return (
    <main className="min-h-screen bg-[#f3efe7] text-[#191713]">
      <aside className="border-b border-[#302a22] bg-[#171410] text-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-[276px] lg:border-b-0 lg:border-r">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-5 px-4 py-4 lg:h-full lg:flex-col lg:items-stretch lg:px-5 lg:py-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="relative grid h-12 w-14 shrink-0 place-items-center overflow-hidden border border-[#a98a4f]/50 bg-[#211d17]">
              <Image
                src="/brand/logo-mark.png"
                alt="WHOKEAS"
                fill
                priority
                sizes="56px"
                className="object-contain p-1.5"
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black tracking-[0.22em]">
                WHOKEAS
              </span>
              <span className="mt-0.5 block truncate text-[9px] font-bold tracking-[0.34em] text-[#d4b56f]">
                MANAGEMENT OFFICE
              </span>
            </span>
          </Link>

          <nav className="hidden space-y-1.5 lg:block">
            <p className="mb-4 px-3 text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
              Administration
            </p>
            {navItems.map((item) => {
              const selected = active === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`group flex items-center gap-3 border px-3 py-3 text-sm font-semibold transition ${
                    selected
                      ? "border-[#b9944d] bg-[#b9944d] text-[#171410]"
                      : "border-transparent text-white/70 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 place-items-center border text-[10px] font-black tracking-[0.08em] ${
                      selected
                        ? "border-[#171410]/20 bg-[#171410]/10"
                        : "border-white/15 bg-white/[0.03]"
                    }`}
                  >
                    {item.short}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden lg:block">
            <div className="border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d4b56f]">
                Store status
              </p>
              <div className="mt-3 flex items-center gap-2 text-sm text-white/75">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Administration online
              </div>
              <Link
                href="/"
                target="_blank"
                className="mt-4 inline-flex text-xs font-bold uppercase tracking-[0.16em] text-white underline decoration-[#b9944d] underline-offset-4"
              >
                Open storefront
              </Link>
            </div>

            <form action="/api/admin/logout" method="post" className="mt-3">
              <button
                type="submit"
                className="w-full border border-white/15 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white/70 transition hover:border-white/35 hover:text-white"
              >
                Sign out securely
              </button>
            </form>
          </div>

          <div className="flex gap-2 overflow-x-auto lg:hidden">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`whitespace-nowrap border px-3 py-2 text-xs font-bold ${
                  active === item.key
                    ? "border-[#b9944d] bg-[#b9944d] text-[#171410]"
                    : "border-white/15 text-white/70"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </aside>

      <section className="lg:pl-[276px]">
        <header className="border-b border-[#d9d0c1] bg-[#faf8f3]">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-5 py-7 sm:px-7 lg:flex-row lg:items-end lg:justify-between lg:px-10 lg:py-9">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#9a7534]">
                {eyebrow}
              </p>
              <h1 className="mt-2 max-w-4xl font-serif text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
                {title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#6b645b] sm:text-base">
                {description}
              </p>
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
        </header>

        <div className="mx-auto max-w-[1600px] px-5 py-7 sm:px-7 lg:px-10 lg:py-9">
          {children}
        </div>
      </section>
    </main>
  );
}
