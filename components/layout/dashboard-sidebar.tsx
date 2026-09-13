"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  LayoutDashboard,
  Settings,
  Users,
  BarChart3,
  Package,
  Building2,
  MapPin,
  Battery,
  FileText,
  Headset,
  Wrench,
  ClipboardList,
  Boxes,
  Receipt,
  QrCode,
  Bell,
  History,
  Shield,
  LogOut,
} from "lucide-react"
import { hasPermission } from "@/lib/rbac"

type DashboardSidebarProps = {
  user: {
    name: string
    email: string
    role: string
  }
}

const navConfig: { label: string; items: { title: string; url: string; icon: typeof LayoutDashboard; perm?: string }[] }[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Reports", url: "/dashboard/reports", icon: BarChart3, perm: "reports.view" },
    ],
  },
  {
    label: "Master Data",
    items: [
      { title: "Customers", url: "/dashboard/customers", icon: Building2, perm: "customer.view" },
      { title: "Sites", url: "/dashboard/sites", icon: MapPin, perm: "site.view" },
      { title: "Equipment", url: "/dashboard/equipment", icon: Battery, perm: "equipment.view" },
      { title: "AMC Contracts", url: "/dashboard/amc", icon: FileText, perm: "amc.view" },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Service Calls", url: "/dashboard/service-calls", icon: Headset, perm: "serviceCall.view" },
      { title: "Visits", url: "/dashboard/visits", icon: ClipboardList, perm: "serviceCall.view" },
      { title: "Engineers", url: "/dashboard/engineers", icon: Wrench, perm: "users.view" },
      { title: "Engineer Locations", url: "/dashboard/engineers/locations", icon: MapPin, perm: "users.view" },
      { title: "Spare Parts", url: "/dashboard/parts", icon: Boxes, perm: "parts.view" },
      { title: "Inventory", url: "/dashboard/inventory", icon: Boxes, perm: "inventory.view" },
      { title: "Part Requests", url: "/dashboard/part-requests", icon: Boxes, perm: "partRequest.view" },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Finance", url: "/dashboard/finance", icon: Receipt, perm: "finance.view" },
      { title: "Invoices", url: "/dashboard/invoices", icon: Receipt, perm: "invoice.view" },
      { title: "Payments", url: "/dashboard/payments", icon: Receipt, perm: "payment.view" },
      { title: "Expenses", url: "/dashboard/expenses", icon: Receipt, perm: "expense.view" },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Users & Roles", url: "/dashboard/users", icon: Users, perm: "users.view" },
      { title: "Settings", url: "/dashboard/settings", icon: Settings },
      // AUDIT FEATURE TEMPORARILY HIDDEN — not deleted, just commented/hidden per request
      // { title: "Audit Logs", url: "/dashboard/audit-logs", icon: Shield, perm: "audit.view" },
    ],
  },
]

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const pathname = usePathname()
  const filteredGroups = navConfig.map((g) => ({
    ...g,
    items: g.items.filter((it) => {
      if (!it.perm) return true
      return hasPermission(user.role as never, it.perm as never)
    }),
  })).filter((g) => g.items.length > 0)

  // Only the longest matching URL should be active.
  // Fixes: Dashboard ("/dashboard") was matching every "/dashboard/*" route,
  // and "/dashboard/engineers" was matching "/dashboard/engineers/locations".
  const allUrls = filteredGroups.flatMap((g) => g.items.map((i) => i.url))
  const activeUrl = [...allUrls]
    .sort((a, b) => b.length - a.length)
    .find((url) => pathname === url || pathname.startsWith(url + "/"))

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 shrink-0 border-b px-2 flex !flex-row items-center !py-0 !gap-2">
        <div className="flex items-center gap-2 w-full">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden leading-tight">
            <span className="text-sm font-semibold">ESP Soln</span>
            <span className="text-xs text-muted-foreground">AMC Tracker</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {filteredGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={item.url === activeUrl}
                      tooltip={item.title}
                      render={<Link href={item.url} />}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t">
        <div className="flex items-center gap-2 px-2 py-2">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden flex-1">
            <span className="truncate text-sm font-medium">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            <span className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{user.role}</span>
          </div>
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" })
              window.location.href = "/sign-in"
            }}
            className="group-data-[collapsible=icon]:hidden rounded-md p-1.5 hover:bg-sidebar-accent"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
