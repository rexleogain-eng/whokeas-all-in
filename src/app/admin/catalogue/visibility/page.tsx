import Link from "next/link";
import { redirect } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import BlockedCleanupButton from "@/components/admin/BlockedCleanupButton";
import StorefrontVisibilityClient from "@/components/admin/StorefrontVisibilityClient";
import { isAdmin } from "@/lib/admin-auth";
import { getStorefrontCatalogHealth } from "@/lib/storefront-catalog-health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StorefrontVisibilityPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const health = await getStorefrontCatalogHealth();

  return (
    <AdminShell
      active="catalogue"
      eyebrow="Storefront visibility"
      title="Turn published supplier records into customer-visible products safely"
      description="Audit the exact U.S. storefront gates, identify why active products are hidden, repair eligible CJ products and remove supplier records that cannot meet the U.S. shipping promise."
      actions={
        <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
          <Link
            href="/admin/catalogue"
            className="border border-[#cfc5b5] bg-[#fffdf9] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#4e473e]"
          >
            ← Catalogue fill
          </Link>
          <Link
            href="/products"
            target="_blank"
            className="border border-[#2a261f] bg-[#2a261f] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white"
          >
            Open customer store
          </Link>
        </div>
      }
    >
      <StorefrontVisibilityClient initialHealth={health} />
      <BlockedCleanupButton />
    </AdminShell>
  );
}
