import { redirect } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import GrowthRevenueClient from "@/components/admin/GrowthRevenueClient";
import { isAdmin } from "@/lib/admin-auth";
import { getGrowthDashboard } from "@/lib/growth-revenue";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GrowthRevenuePage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const dashboard = await getGrowthDashboard();

  return (
    <AdminShell
      active="growth"
      eyebrow="Growth and monetization"
      title="WHOKEAS Growth & Revenue Center"
      description="Measure real profit, create controlled promotions, manage performance partners, reward customer referrals and recover abandoned checkouts."
    >
      <GrowthRevenueClient initialData={dashboard} />
    </AdminShell>
  );
}
