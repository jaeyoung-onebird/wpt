"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldCheck,
  ShieldOff,
  User as UserIcon,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import type { UserAdmin, PaginatedResponse } from "@/types";

export default function AdminUsers() {
  const [users, setUsers] = useState<UserAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const params: any = { page, size: 20 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;

      const response = await adminApi.getUsers(params);
      setUsers(response.data.items);
      setTotal(response.data.total);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchUsers();
  };

  const handleStatusChange = async (userId: string, isActive: boolean) => {
    if (!confirm(isActive ? "유저를 활성화하시겠습니까?" : "유저를 비활성화하시겠습니까?")) {
      return;
    }

    try {
      await adminApi.updateUserStatus(userId, { is_active: isActive });
      fetchUsers();
    } catch (error) {
      console.error("Failed to update user status:", error);
      alert("처리에 실패했습니다");
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm(`유저 권한을 ${newRole}로 변경하시겠습니까?`)) {
      return;
    }

    try {
      await adminApi.updateUserRole(userId, { platform_role: newRole });
      fetchUsers();
    } catch (error) {
      console.error("Failed to update user role:", error);
      alert("권한 변경에 실패했습니다. Super Admin 권한이 필요합니다.");
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return (
          <Badge className="bg-red-100 text-red-700">
            <ShieldCheck className="mr-1 h-3 w-3" />
            Super Admin
          </Badge>
        );
      case "admin":
        return (
          <Badge className="bg-orange-100 text-orange-700">
            <Shield className="mr-1 h-3 w-3" />
            Admin
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <UserIcon className="mr-1 h-3 w-3" />
            User
          </Badge>
        );
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">유저 관리</h1>
        <Badge variant="outline">{total}명</Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-1 gap-2">
              <Input
                placeholder="이름, 전화번호, 이메일 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="max-w-sm"
              />
              <Button variant="outline" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant={roleFilter === null ? "default" : "outline"}
                size="sm"
                onClick={() => setRoleFilter(null)}
              >
                전체
              </Button>
              <Button
                variant={roleFilter === "admin" ? "default" : "outline"}
                size="sm"
                onClick={() => setRoleFilter("admin")}
              >
                Admin
              </Button>
              <Button
                variant={roleFilter === "user" ? "default" : "outline"}
                size="sm"
                onClick={() => setRoleFilter("user")}
              >
                User
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-4 text-left font-medium">이름</th>
                  <th className="p-4 text-left font-medium">전화번호</th>
                  <th className="p-4 text-left font-medium">이메일</th>
                  <th className="p-4 text-center font-medium">권한</th>
                  <th className="p-4 text-center font-medium">프로필</th>
                  <th className="p-4 text-center font-medium">상태</th>
                  <th className="p-4 text-center font-medium">마지막 로그인</th>
                  <th className="p-4 text-center font-medium">액션</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      로딩 중...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      유저가 없습니다
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-muted/50">
                      <td className="p-4 font-medium">{user.name}</td>
                      <td className="p-4 text-muted-foreground">{user.phone}</td>
                      <td className="p-4 text-muted-foreground">
                        {user.email || "-"}
                      </td>
                      <td className="p-4 text-center">
                        {getRoleBadge(user.platform_role)}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-1">
                          {user.has_worker_profile && (
                            <Badge variant="secondary" className="text-xs">
                              근무자
                            </Badge>
                          )}
                          {user.has_org_membership && (
                            <Badge variant="secondary" className="text-xs">
                              업체
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {user.is_active ? (
                          <Badge className="bg-green-100 text-green-700">
                            활성
                          </Badge>
                        ) : (
                          <Badge variant="destructive">비활성</Badge>
                        )}
                      </td>
                      <td className="p-4 text-center text-muted-foreground">
                        {user.last_login_at
                          ? new Date(user.last_login_at).toLocaleDateString("ko-KR")
                          : "-"}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          {user.platform_role === "user" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRoleChange(user.id, "admin")}
                            >
                              Admin 승격
                            </Button>
                          )}
                          {user.platform_role === "admin" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRoleChange(user.id, "user")}
                            >
                              권한 해제
                            </Button>
                          )}
                          {user.is_active ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusChange(user.id, false)}
                            >
                              비활성화
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleStatusChange(user.id, true)}
                            >
                              활성화
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 border-t p-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
