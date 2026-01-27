"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import type { Organization, PaginatedResponse } from "@/types";

export default function AdminOrganizations() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "unverified">("all");
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrgs = async () => {
    setIsLoading(true);
    try {
      const params: any = { page, size: 20 };
      if (search) params.search = search;
      if (filter === "verified") params.is_verified = true;
      if (filter === "unverified") params.is_verified = false;

      const response = await adminApi.getOrganizations(params);
      setOrgs(response.data.items);
      setTotal(response.data.total);
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, [page, filter]);

  const handleSearch = () => {
    setPage(1);
    fetchOrgs();
  };

  const handleVerify = async (orgId: string, isVerified: boolean) => {
    try {
      await adminApi.verifyOrganization(orgId, { is_verified: isVerified });
      fetchOrgs();
    } catch (error) {
      console.error("Failed to verify organization:", error);
      alert("처리에 실패했습니다");
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">업체 관리</h1>
        <Badge variant="outline">{total}개 업체</Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-1 gap-2">
              <Input
                placeholder="업체명 또는 사업자번호 검색"
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
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                전체
              </Button>
              <Button
                variant={filter === "verified" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("verified")}
              >
                인증됨
              </Button>
              <Button
                variant={filter === "unverified" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("unverified")}
              >
                미인증
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
                  <th className="p-4 text-left font-medium">업체명</th>
                  <th className="p-4 text-left font-medium">사업자번호</th>
                  <th className="p-4 text-left font-medium">대표자</th>
                  <th className="p-4 text-left font-medium">연락처</th>
                  <th className="p-4 text-center font-medium">상태</th>
                  <th className="p-4 text-center font-medium">가입일</th>
                  <th className="p-4 text-center font-medium">액션</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      로딩 중...
                    </td>
                  </tr>
                ) : orgs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      업체가 없습니다
                    </td>
                  </tr>
                ) : (
                  orgs.map((org) => (
                    <tr key={org.id} className="border-b hover:bg-muted/50">
                      <td className="p-4 font-medium">{org.name}</td>
                      <td className="p-4 text-muted-foreground">
                        {org.business_number || "-"}
                      </td>
                      <td className="p-4">{org.representative_name || "-"}</td>
                      <td className="p-4 text-muted-foreground">
                        {org.contact_phone || "-"}
                      </td>
                      <td className="p-4 text-center">
                        {org.is_verified ? (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            인증됨
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-600">
                            <XCircle className="mr-1 h-3 w-3" />
                            미인증
                          </Badge>
                        )}
                      </td>
                      <td className="p-4 text-center text-muted-foreground">
                        {new Date(org.created_at).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="p-4 text-center">
                        {org.is_verified ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVerify(org.id, false)}
                          >
                            인증 취소
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleVerify(org.id, true)}
                          >
                            인증하기
                          </Button>
                        )}
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
