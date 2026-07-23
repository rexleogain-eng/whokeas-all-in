import Link from "next/link";
import { redirect } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import CatalogueExpansionClient from "@/components/admin/CatalogueExpansionClient";
import { isAdmin } from "@/lib/admin-auth";
import { getCatalogueExpansionDashboard } from "@/lib/catalogue-expansion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CatalogueExpansionPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const data = await getCatalogueExpansionDashboard();

  return (
    <AdminShell
      active="catalogue"
      eyebrow="Catalogue expansion"
      title="Fill the store safely—without flooding CJ"
      description="A controlled queue discovers real supplier products, removes design trials, prevents duplicates, imports one product at a time and keeps global selling prices near the fixed 30% gross-margin policy."
      actions={
        <>
          <Link
            href="/admin/automation"
            className="border border-[#cfc5b5] bg-[#fffdf9] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#4e473e]"
          >
            Pricing rules
          </Link>
          <Link
            href="/admin/products"
            className="border border-[#2a261f] bg-[#2a261f] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white"
          >
            Product control
          </Link>
        </>
      }
    >
      <CatalogueExpansionClient initialData={data} />
    </AdminShell>
  );
}
