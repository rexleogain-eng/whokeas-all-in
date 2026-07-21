import CartClient from "@/components/store/CartClient";
import StoreHeader from "@/components/store/StoreHeader";

export const metadata = {
  title: "Shopping Cart",
};

export default function CartPage() {
  return (
    <main className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <StoreHeader />
      <div className="mx-auto max-w-[1500px] px-4 py-7 lg:px-6">
        <CartClient />
      </div>
    </main>
  );
}
