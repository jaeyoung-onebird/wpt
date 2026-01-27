"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, Star, UserMinus, Ban } from "lucide-react";
import { orgApi } from "@/lib/api";
import type { PaginatedResponse } from "@/types";

interface Follower {
  id: string;
  worker_id: string;
  nickname: string;
  profile_image_url: string | null;
  trust_score: number;
  total_jobs: number;
  is_mutual: boolean;
  note: string | null;
  followed_at: string;
}

export default function OrgWorkersPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchFollowers = async () => {
    setIsLoading(true);
    try {
      const response = await orgApi.getFollowers(orgId, page);
      const data: PaginatedResponse<Follower> = response.data;
      setFollowers(data.items);
      setTotal(data.total);
    } catch (error) {
      console.error("Failed to fetch followers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowers();
  }, [orgId, page]);

  const handleUnfollow = async (workerId: string) => {
    if (!confirm("팔로우를 취소하시겠습니까?")) return;

    try {
      await orgApi.unfollowWorker(orgId, workerId);
      setFollowers((prev) => prev.filter((f) => f.worker_id !== workerId));
      setTotal((prev) => prev - 1);
    } catch (error) {
      console.error("Failed to unfollow:", error);
    }
  };

  const handleBlock = async (workerId: string) => {
    const reason = prompt("차단 사유를 입력해주세요 (선택)");
    if (reason === null) return;

    try {
      await orgApi.blockWorker(orgId, workerId, reason || undefined);
      setFollowers((prev) => prev.filter((f) => f.worker_id !== workerId));
      setTotal((prev) => prev - 1);
    } catch (error) {
      console.error("Failed to block:", error);
    }
  };

  const filteredFollowers = searchQuery
    ? followers.filter((f) =>
        f.nickname.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : followers;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">근무자 관리</h1>
        <Badge variant="secondary">{total}명 팔로잉</Badge>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="근무자 검색"
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Workers List */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">로딩 중...</div>
      ) : filteredFollowers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {searchQuery ? "검색 결과가 없습니다" : "팔로잉 중인 근무자가 없습니다"}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredFollowers.map((follower) => (
            <Card key={follower.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>{follower.nickname[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{follower.nickname}</h3>
                        {follower.is_mutual && (
                          <Badge variant="secondary" className="text-xs">
                            맞팔
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                        {follower.trust_score}
                        <span>·</span>
                        <span>{follower.total_jobs}회 근무</span>
                      </div>
                    </div>
                  </div>
                </div>

                {follower.note && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    메모: {follower.note}
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleUnfollow(follower.worker_id)}
                  >
                    <UserMinus className="mr-1 h-4 w-4" />
                    언팔로우
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleBlock(follower.worker_id)}
                  >
                    <Ban className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            이전
          </Button>
          <Button
            variant="outline"
            disabled={page * 20 >= total}
            onClick={() => setPage(page + 1)}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}
