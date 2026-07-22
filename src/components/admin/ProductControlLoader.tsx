"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const loadingPanel = (
  <div className="border border-[#d9d0c1] bg-[#fffdf9] p-10 text-center text-sm text-[#746d63]">
    Loading catalogue control…
  </div>
);

const ProductControlClient = dynamic(
  () => import("@/components/admin/ProductControlClient"),
  {
    ssr: false,
    loading: () => loadingPanel,
  },
);

export default function ProductControlLoader() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keep the server output and the browser's first render identical.
  // Product Control is intentionally mounted only after hydration because it
  // relies on browser APIs and live admin state.
  if (!mounted) return loadingPanel;

  return <ProductControlClient />;
}
