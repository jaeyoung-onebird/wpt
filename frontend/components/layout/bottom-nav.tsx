"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Calendar, CreditCard, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/worker", icon: Home, label: "홈" },
  { href: "/worker/events", icon: Search, label: "일자리" },
  { href: "/worker/schedule", icon: Calendar, label: "스케줄" },
  { href: "/worker/payroll", icon: CreditCard, label: "급여" },
  { href: "/worker/profile", icon: User, label: "마이" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background safe-bottom">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/worker" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
