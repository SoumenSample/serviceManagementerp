import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard";
import { CoordinatorDashboard } from "@/components/dashboard/coordinator-dashboard";
import { AccountsDashboard } from "@/components/dashboard/accounts-dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

async function getSummary() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  // Use internal fetch via relative URL in server component - fetch via API route directly would need auth cookie forwarding
  // Instead we call the API via fetch with cache no-store and headers passthrough
  // For server component, we can directly call logic or fetch with cookies
  // Use fetch to /api/dashboard/summary with no-store
  const res = await fetch(`${base}/api/dashboard/summary`, { cache: "no-store", headers: { cookie: (await import("next/headers").then((m) => m.cookies().toString())) } } as RequestInit).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json();
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  // Fetch summary server-side without relying on base URL if fetch fails, show loading fallback client-side
  // For now, client will fetch via useEffect in dashboards; server render shell
  const role = user.role;

  return (
    <div className="flex-1 space-y-6 px-6 pt-0">
      <div className="flex md:flex-row flex-col md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {role === "engineer" ? "Engineer Dashboard" : role === "accounts" ? "Accounts Dashboard" : role === "coordinator" ? "Coordinator Dashboard" : role === "manager" ? "Manager Dashboard" : "Super Admin Dashboard"}
          </h1>
          <p className="text-muted-foreground">Welcome {user.name} • {role}</p>
        </div>
      </div>

      <RoleDashboardLoader role={role} />
    </div>
  );
}

function RoleDashboardLoader({ role }: { role: string }) {
  // Client loader to fetch summary
  return <DashboardClient role={role} />;
}

// Client component wrapper
import { DashboardClient } from "@/components/dashboard/dashboard-client";
