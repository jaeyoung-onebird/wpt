"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";

const navItems = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/organizations", label: "업체 관리", icon: Building2 },
  { href: "/admin/users", label: "유저 관리", icon: Users },
  { href: "/admin/workers", label: "근무자 관리", icon: Briefcase },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    if (
      !isLoading &&
      user &&
      user.platform_role !== "admin" &&
      user.platform_role !== "super_admin"
    ) {
      alert("관리자 권한이 필요합니다");
      router.push("/");
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  if (!user || (user.platform_role !== "admin" && user.platform_role !== "super_admin")) {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="border-b p-4">
            <Link href="/admin" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                W
              </div>
              <div>
                <h1 className="font-bold">WorkProof Chain</h1>
                <p className="text-xs text-muted-foreground">Admin Panel</p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Info */}
          <div className="border-t p-4">
            <div className="mb-2 text-sm">
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">
                {user.platform_role === "super_admin" ? "Super Admin" : "Admin"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-1 p-6">{children}</main>
    </div>
  );
}
