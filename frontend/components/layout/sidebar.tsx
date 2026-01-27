"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Users,
  CreditCard,
  Settings,
  UserPlus,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  orgId?: string;
  type: "org" | "admin";
}

const orgNavItems = (orgId: string) => [
  { href: `/org/${orgId}`, icon: LayoutDashboard, label: "대시보드" },
  { href: `/org/${orgId}/events`, icon: Calendar, label: "이벤트" },
  { href: `/org/${orgId}/workers`, icon: Users, label: "근무자" },
  { href: `/org/${orgId}/payroll`, icon: CreditCard, label: "급여" },
  { href: `/org/${orgId}/invite`, icon: UserPlus, label: "초대" },
  { href: `/org/${orgId}/settings`, icon: Settings, label: "설정" },
];

const adminNavItems = [
  { href: "/admin", icon: LayoutDashboard, label: "대시보드" },
  { href: "/admin/organizations", icon: Building2, label: "업체 관리" },
  { href: "/admin/users", icon: Users, label: "유저 관리" },
  { href: "/admin/workers", icon: Users, label: "근무자 관리" },
];

export function Sidebar({ orgId, type }: SidebarProps) {
  const pathname = usePathname();
  const navItems =
    type === "org" && orgId ? orgNavItems(orgId) : adminNavItems;

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background">
      <div className="flex h-16 items-center border-b px-6">
        <Link href={type === "org" ? `/org/${orgId}` : "/admin"}>
          <h1 className="text-xl font-bold text-primary">WorkProof Chain</h1>
        </Link>
      </div>

      <nav className="space-y-1 p-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== `/org/${orgId}` &&
              item.href !== "/admin" &&
              pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
