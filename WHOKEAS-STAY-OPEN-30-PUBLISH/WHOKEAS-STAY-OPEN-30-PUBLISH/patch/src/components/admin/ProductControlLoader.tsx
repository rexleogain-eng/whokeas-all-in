"use client";

import dynamic from "next/dynamic";

const ProductControlClient = dynamic(
  () => import("@/components/admin/ProductControlClient"),
  {
    ssr: false,
    loading: () => (
      <div className="border border-[#d9d0c1] bg-[#fffdf9] p-10 text-center text-sm text-[#746d63]">
        Loading catalogue control…
      </div>
    ),
  },
);

export default function ProductControlLoader() {
  return <ProductControlClient />;
}
