import Link from "next/link";
import { redirect } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import ProductControlLoader from "@/components/admin/ProductControlLoader";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  return (
    <AdminShell
      active="products"
      eyebrow="Catalogue administration"
      title="Curate every product with precision"
      description="Control presentation, pricing, supplier details, variants and publishing status from one disciplined workspace."
      actions={
        <>
          <Link
            href="/admin/cj"
            className="border border-[#b9944d] bg-[#b9944d] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#171410]"
          >
            Import from CJ
          </Link>
          <Link
            href="/products"
            target="_blank"
            className="border border-[#2a261f] bg-[#2a261f] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white"
          >
            Open collection
          </Link>
        </>
      }
    >
      <ProductControlLoader />
    </AdminShell>
  );
}
