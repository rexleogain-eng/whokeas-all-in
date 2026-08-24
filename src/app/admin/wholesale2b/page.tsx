import { redirect } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import Wholesale2BClient from "@/components/admin/Wholesale2BClient";
import { isAdmin } from "@/lib/admin-auth";
import { getWholesale2BStatus } from "@/lib/wholesale2b";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Wholesale2BPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const status = await getWholesale2BStatus();

  return (
    <AdminShell
      active="wholesale2b"
      eyebrow="Supplier source"
      title="Wholesale2B"
      description="Add U.S.-focused Wholesale2B products without mixing supplier IDs, pricing, stock or synchronization with CJ."
    >
      <Wholesale2BClient initialStatus={status} />
    </AdminShell>
  );
}
