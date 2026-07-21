import CheckoutClient from "@/components/checkout/CheckoutClient";
import StoreHeader from "@/components/store/StoreHeader";

export const metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader />
      <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:py-12">
        <CheckoutClient />
      </div>
    </main>
  );
}
