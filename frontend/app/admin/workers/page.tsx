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
  Star,
  AlertTriangle,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import type { WorkerAdmin, PaginatedResponse } from "@/types";

export default function AdminWorkers() {
  const [workers, setWorkers] = useState<WorkerAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [editingTrustScore, setEditingTrustScore] = useState<{
    id: string;
    score: number;
  } | null>(null);

  const fetchWorkers = async () => {
    setIsLoading(true);
    try {
      const params: any = { page, size: 20 };
      if (search) params.search = search;

      const response = await adminApi.getWorkers(params);
      setWorkers(response.data.items);
      setTotal(response.data.total);
    } catch (error) {
      console.error("Failed to fetch workers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, [page]);

  const handleSearch = () => {
    setPage(1);
    fetchWorkers();
  };

  const handleTrustScoreUpdate = async (workerId: string, score: number) => {
    const reason = prompt("신뢰점수 변경 사유를 입력하세요:");
    if (!reason) return;

    try {
      await adminApi.updateTrustScore(workerId, {
        trust_score: score,
        reason,
      });
      setEditingTrustScore(null);
      fetchWorkers();
    } catch (error) {
      console.error("Failed to update trust score:", error);
      alert("신뢰점수 변경에 실패했습니다. Super Admin 권한이 필요합니다.");
    }
  };

  const getTrustScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-blue-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">근무자 관리</h1>
        <Badge variant="outline">{total}명</Badge>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Input
              placeholder="닉네임, 실명, 전화번호 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="max-w-sm"
            />
            <Button variant="outline" onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
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
                  <th className="p-4 text-left font-medium">닉네임</th>
                  <th className="p-4 text-left font-medium">실명</th>
                  <th className="p-4 text-left font-medium">전화번호</th>
                  <th className="p-4 text-left font-medium">지역</th>
                  <th className="p-4 text-center font-medium">신뢰점수</th>
                  <th className="p-4 text-center font-medium">근무</th>
                  <th className="p-4 text-center font-medium">노쇼</th>
                  <th className="p-4 text-center font-medium">지각</th>
                  <th className="p-4 text-center font-medium">가입경로</th>
                  <th className="p-4 text-center font-medium">가입일</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground">
                      로딩 중...
                    </td>
                  </tr>
                ) : workers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground">
                      근무자가 없습니다
                    </td>
                  </tr>
                ) : (
                  workers.map((worker) => (
                    <tr key={worker.id} className="border-b hover:bg-muted/50">
                      <td className="p-4 font-medium">{worker.nickname}</td>
                      <td className="p-4 text-muted-foreground">
                        {worker.real_name || "-"}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {worker.phone || "-"}
                      </td>
                      <td className="p-4">{worker.region || "-"}</td>
                      <td className="p-4 text-center">
                        {editingTrustScore?.id === worker.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={editingTrustScore.score}
                              onChange={(e) =>
                                setEditingTrustScore({
                                  ...editingTrustScore,
                                  score: parseInt(e.target.value) || 0,
                                })
                              }
                              className="h-8 w-16 text-center"
                            />
                            <Button
                              size="sm"
                              onClick={() =>
                                handleTrustScoreUpdate(
                                  worker.id,
                                  editingTrustScore.score
                                )
                              }
                            >
                              저장
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingTrustScore(null)}
                            >
                              취소
                            </Button>
                          </div>
                        ) : (
                          <button
                            className={`flex items-center justify-center gap-1 font-bold ${getTrustScoreColor(
                              worker.trust_score
                            )}`}
                            onClick={() =>
                              setEditingTrustScore({
                                id: worker.id,
                                score: worker.trust_score,
                              })
                            }
                          >
                            <Star className="h-4 w-4" />
                            {worker.trust_score}
                          </button>
                        )}
                      </td>
                      <td className="p-4 text-center">{worker.total_jobs}</td>
                      <td className="p-4 text-center">
                        {worker.no_show_count > 0 ? (
                          <span className="flex items-center justify-center gap-1 text-red-600">
                            <AlertTriangle className="h-4 w-4" />
                            {worker.no_show_count}
                          </span>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {worker.late_count > 0 ? (
                          <span className="text-yellow-600">
                            {worker.late_count}
                          </span>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="outline" className="text-xs">
                          {worker.signup_source === "direct"
                            ? "직접"
                            : worker.signup_source === "invite"
                            ? "초대"
                            : worker.signup_source}
                        </Badge>
                      </td>
                      <td className="p-4 text-center text-muted-foreground">
                        {new Date(worker.created_at).toLocaleDateString("ko-KR")}
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
