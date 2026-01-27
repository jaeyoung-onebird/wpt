"use client";

import { Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth";
import { useRouter } from "next/navigation";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
}

export function Header({ title, showBack }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-4">
        {showBack && (
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            ←
          </Button>
        )}
        {title && <h1 className="text-lg font-semibold">{title}</h1>}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src="" />
            <AvatarFallback>{user?.name?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm md:inline">{user?.name}</span>
        </div>

        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
