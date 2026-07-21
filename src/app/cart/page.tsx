import CartClient from "@/components/store/CartClient";
import StoreHeader from "@/components/store/StoreHeader";

export const metadata = { title: "Shopping Cart" };

export default function CartPage() {
  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader />
      <div className="mx-auto max-w-[1450px] px-4 py-8 sm:px-6 lg:py-12">
        <CartClient />
      </div>
    </main>
  );
}
