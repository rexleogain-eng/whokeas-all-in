import CheckoutClient from "@/components/checkout/CheckoutClient";
import StoreHeader from "@/components/store/StoreHeader";

export const metadata = {
  title: "Checkout",
};

export default function CheckoutPage() {
  return (
    <main className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <StoreHeader />
      <div className="mx-auto max-w-[1350px] px-4 py-7 lg:px-6">
        <CheckoutClient />
      </div>
    </main>
  );
}
