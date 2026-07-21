import Link from "next/link";
import { redirect } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import CJConnectorClient from "@/components/admin/CJConnectorClient";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function CJAdminPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  return (
    <AdminShell
      active="cj"
      eyebrow="International sourcing"
      title="Source products without weakening the brand"
      description="Search CJdropshipping, model landed cost in Tanzanian shillings and import selected products into a private draft review queue."
      actions={
        <Link
          href="/admin/products"
          className="border border-[#2a261f] bg-[#2a261f] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white"
        >
          Review catalogue
        </Link>
      }
    >
      <CJConnectorClient />
    </AdminShell>
  );
}
