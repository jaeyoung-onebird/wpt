"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, MapPin, Users } from "lucide-react";
import { orgApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { EventListItem, PaginatedResponse } from "@/types";

export default function OrgEventsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const response = await orgApi.getEvents(orgId, {
        status: statusFilter,
        page,
        size: 20,
      });
      const data: PaginatedResponse<EventListItem> = response.data;
      setEvents(data.items);
      setTotal(data.total);
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [orgId, page, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">임시저장</Badge>;
      case "published":
        return <Badge>모집중</Badge>;
      case "in_progress":
        return <Badge variant="warning">진행중</Badge>;
      case "completed":
        return <Badge variant="success">완료</Badge>;
      case "cancelled":
        return <Badge variant="destructive">취소</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">이벤트 관리</h1>
        <Link href={`/org/${orgId}/events/new`}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            이벤트 등록
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Button
          variant={statusFilter === null ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter(null)}
        >
          전체
        </Button>
        <Button
          variant={statusFilter === "published" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("published")}
        >
          모집중
        </Button>
        <Button
          variant={statusFilter === "in_progress" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("in_progress")}
        >
          진행중
        </Button>
        <Button
          variant={statusFilter === "completed" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("completed")}
        >
          완료
        </Button>
      </div>

      {/* Events List */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">로딩 중...</div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">등록된 이벤트가 없습니다</p>
            <Link href={`/org/${orgId}/events/new`}>
              <Button className="mt-4">첫 이벤트 등록하기</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">총 {total}개</p>

          <div className="space-y-4">
            {events.map((event) => (
              <Link key={event.id} href={`/org/${orgId}/events/${event.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">{event.title}</h3>
                          {getStatusBadge(event.status)}
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {event.event_date}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {event.location_name}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {event.filled_positions}/{event.total_positions}명
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          {formatCurrency(event.min_hourly_rate)}
                          {event.min_hourly_rate !== event.max_hourly_rate &&
                            ` ~ ${formatCurrency(event.max_hourly_rate)}`}
                        </p>
                        <p className="text-sm text-muted-foreground">/시</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

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
        </>
      )}
    </div>
  );
}
