import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AccountAuthForm from "@/components/account/AccountAuthForm";
import StoreHeader from "@/components/store/StoreHeader";
import { getCustomerSession } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customer Sign In",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CustomerLoginPage() {
  if (await getCustomerSession()) {
    redirect("/account");
  }

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader />

      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_470px] lg:items-center lg:py-20">
        <section>
          <p className="classic-kicker">
            Customer account
          </p>

          <h1 className="mt-4 max-w-2xl text-5xl font-normal leading-tight sm:text-6xl">
            Your orders, addresses and delivery progress.
          </h1>

          <p className="mt-6 max-w-xl text-sm leading-7 text-[#746d62]">
            Sign in to follow international and local
            orders from one private customer dashboard.
            Registration is never required before shopping.
          </p>
        </section>

        <AccountAuthForm mode="login" />
      </div>
    </main>
  );
}
