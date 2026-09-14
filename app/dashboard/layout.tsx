import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { GlobalSearch } from "@/components/search/global-search";
import { GlobalEngineerTracker } from "@/components/engineer/global-tracker";
import { WelcomeModal } from "@/components/layout/welcome-modal";
import { AttendanceHeader } from "@/components/attendance/attendance-header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?next=/dashboard");
  }

  // serialize for client sidebar (JWTPayload -> plain)
  const sidebarUser = {
    name: user.name,
    email: user.email,
    role: user.role,
  };

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen>
        <DashboardSidebar user={sidebarUser} />
        <SidebarInset>
        {/* Top bar inside inset — uses same shadcn theme tokens */}
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <div className="flex flex-1 items-center justify-between gap-4">
            <p className="hidden lg:block text-sm text-muted-foreground">UPS/Inverter AMC & Repair Service Tracking</p>
            <div className="flex items-center gap-2 flex-1 justify-end">
              <AttendanceHeader />
              <GlobalSearch />
              <NotificationBell />
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 bg-muted/20">{children}</main>
        </SidebarInset>
      </SidebarProvider>
      <GlobalEngineerTracker role={sidebarUser.role} />
      <WelcomeModal user={sidebarUser} />
    </TooltipProvider>
  );
}
