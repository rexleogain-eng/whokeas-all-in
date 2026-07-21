import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import CJConnectorClient from "@/components/admin/CJConnectorClient";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function CJAdminPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  return (
    <main className="min-h-screen bg-[#eaeded] text-[#0f1111]">
      <header className="bg-[#101820] text-white shadow-md">
        <div className="mx-auto flex min-h-16 max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-3 lg:px-6">
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
                CJ AUTOMATION
              </div>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/orders"
              className="rounded-lg border border-white/25 px-4 py-2 text-sm font-bold"
            >
              Orders
            </Link>
            <Link
              href="/admin/products"
              className="rounded-lg border border-white/25 px-4 py-2 text-sm font-bold"
            >
              Products
            </Link>
            <Link
              href="/admin/cj"
              className="rounded-lg bg-[#ffd814] px-4 py-2 text-sm font-bold text-black"
            >
              CJ Import
            </Link>
            <form action="/api/admin/logout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-white/25 px-4 py-2 text-sm font-bold"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-7 lg:px-6">
        <div className="mb-6">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#b36f00]">
            Automated supplier sourcing
          </p>
          <h1 className="mt-2 text-4xl font-black">
            CJ Product Import Centre
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Search CJ, estimate freight to Tanzania, calculate WHOKEAS pricing,
            import complete draft products and synchronize supplier stock.
          </p>
        </div>

        <CJConnectorClient />
      </div>
    </main>
  );
}