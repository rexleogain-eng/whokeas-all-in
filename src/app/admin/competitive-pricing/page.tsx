import { redirect } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import CompetitivePricingClient from "@/components/admin/CompetitivePricingClient";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CompetitivePricingPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  return (
    <AdminShell
      active="pricing"
      eyebrow="Market intelligence"
      title="Competitor-aware pricing"
      description="Keep WHOKEAS prices close to the U.S. market while protecting a safe minimum margin and preserving the 15% cost-based baseline when we are already cheaper."
    >
      <CompetitivePricingClient />
    </AdminShell>
  );
}
