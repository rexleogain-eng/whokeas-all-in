import { redirect } from "next/navigation";

import AccountAuthForm from "@/components/account/AccountAuthForm";
import StoreHeader from "@/components/store/StoreHeader";
import { getCustomerSession } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create Customer Account",
};

export default async function CustomerRegisterPage() {
  if (await getCustomerSession()) {
    redirect("/account");
  }

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader />

      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_470px] lg:items-center lg:py-20">
        <section>
          <p className="classic-kicker">
            Join WHOKEAS
          </p>

          <h1 className="mt-4 max-w-2xl text-5xl font-normal leading-tight sm:text-6xl">
            One account for international shopping.
          </h1>

          <p className="mt-6 max-w-xl text-sm leading-7 text-[#746d62]">
            Save your delivery address, recover previous
            guest orders using the same email, and monitor
            every order from payment to delivery.
          </p>
        </section>

        <AccountAuthForm mode="register" />
      </div>
    </main>
  );
}