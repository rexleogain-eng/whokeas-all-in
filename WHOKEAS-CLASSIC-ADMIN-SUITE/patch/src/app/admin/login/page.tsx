import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdmin()) {
    redirect("/admin");
  }

  return (
    <main className="grid min-h-screen bg-[#f3efe7] text-[#191713] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#181510] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-[0.09] [background-image:linear-gradient(rgba(255,255,255,.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.22)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-4">
            <span className="relative grid h-16 w-20 place-items-center border border-[#b9944d]/50 bg-[#211d17]">
              <Image
                src="/brand/logo-mark.png"
                alt="WHOKEAS"
                fill
                priority
                sizes="80px"
                className="object-contain p-2"
              />
            </span>
            <span>
              <span className="block text-lg font-black tracking-[0.24em]">WHOKEAS</span>
              <span className="mt-1 block text-[10px] font-bold tracking-[0.34em] text-[#d4b56f]">
                PRIVATE MANAGEMENT OFFICE
              </span>
            </span>
          </Link>
        </div>

        <div className="relative z-10 max-w-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d4b56f]">
            Authorized personnel only
          </p>
          <h1 className="mt-4 font-serif text-6xl font-semibold leading-[1.02]">
            Quiet control.
            <br />
            Clear decisions.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-white/60">
            Manage orders, catalogue quality, supplier sourcing and payment verification from one protected workspace.
          </p>
        </div>

        <p className="relative z-10 text-xs uppercase tracking-[0.18em] text-white/35">
          WHOKEAS ALL IN · Tanzania
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="relative h-12 w-14 overflow-hidden border border-[#b9944d]/50 bg-[#211d17]">
              <Image
                src="/brand/logo-mark.png"
                alt="WHOKEAS"
                fill
                priority
                sizes="56px"
                className="object-contain p-1.5"
              />
            </span>
            <span>
              <span className="block text-sm font-black tracking-[0.22em]">WHOKEAS</span>
              <span className="block text-[9px] font-bold tracking-[0.3em] text-[#9a7534]">ADMIN</span>
            </span>
          </Link>

          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#9a7534]">
            Secure sign-in
          </p>
          <h2 className="mt-3 font-serif text-4xl font-semibold">Welcome back</h2>
          <p className="mt-3 text-sm leading-6 text-[#71695f]">
            Enter the private administrator secret to open the management office.
          </p>

          <div className="mt-8 border border-[#d9d0c1] bg-[#fffdf9] p-6 shadow-[0_18px_60px_rgba(54,45,32,0.08)] sm:p-8">
            <AdminLoginForm />
          </div>

          <p className="mt-6 text-center text-xs leading-5 text-[#857d72]">
            Access attempts are limited to authorized WHOKEAS administrators.
          </p>
        </div>
      </section>
    </main>
  );
}
