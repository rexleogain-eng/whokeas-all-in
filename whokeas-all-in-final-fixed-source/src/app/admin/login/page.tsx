import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdmin()) {
    redirect("/admin/orders");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eaeded] p-5">
      <section className="w-full max-w-md bg-white p-8 shadow-sm">
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
            <div className="text-[10px] font-black tracking-[0.3em] text-[#c58b00]">
              ADMIN
            </div>
          </div>
        </Link>

        <h1 className="mt-7 text-3xl font-black">Admin access</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Review payment references and update order progress.
        </p>

        <AdminLoginForm />
      </section>
    </main>
  );
}