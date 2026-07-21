import Image from "next/image";
import Link from "next/link";

import CartButton from "@/components/store/CartButton";
import CheckoutClient from "@/components/checkout/CheckoutClient";

export const metadata = {
  title: "Checkout",
};

export default function CheckoutPage() {
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

      <div className="mx-auto max-w-[1350px] px-4 py-6 lg:px-6">
        <CheckoutClient />
      </div>
    </main>
  );
}