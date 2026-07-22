import Link from "next/link";
import { redirect } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import AutomationControlClient from "@/components/admin/AutomationControlClient";
import { isAdmin } from "@/lib/admin-auth";
import { getAutomationDashboardData } from "@/lib/catalog-automation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AutomationAdminPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const data = await getAutomationDashboardData();

  return (
    <AdminShell
      active="automation"
      eyebrow="Catalogue autopilot"
      title="Let the store source, classify and price products itself"
      description="The automation searches CJ, rejects unsuitable products, classifies strong candidates, calculates international market prices and publishes only products that pass inventory, shipping, margin and regional price gates."
      actions={
        <>
          <Link
            href="/admin/cj"
            className="border border-[#cfc5b5] bg-[#fffdf9] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#4e473e]"
          >
            Manual sourcing
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
      <AutomationControlClient initialData={data} />
    </AdminShell>
  );
}
