"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Calendar, Filter } from "lucide-react";
import { workerApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { EventListItem, PaginatedResponse } from "@/types";

export default function EventSearchPage() {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [followingOnly, setFollowingOnly] = useState(false);
  const [searchParams, setSearchParams] = useState({
    region: "",
    work_type: "",
  });

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const params = {
        page,
        size: 20,
        following_only: followingOnly,
        region: searchParams.region || undefined,
        work_type: searchParams.work_type || undefined,
      };
      const response = await workerApi.searchEvents(params);
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
  }, [page, followingOnly]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEvents();
  };

  return (
    <div className="p-4">
      {/* Search Header */}
      <div className="sticky top-0 z-10 -mx-4 bg-background px-4 pb-4">
        <h1 className="mb-4 text-xl font-bold">일자리 검색</h1>

        <form onSubmit={handleSearch} className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="지역 검색"
                className="pl-9"
                value={searchParams.region}
                onChange={(e) =>
                  setSearchParams({ ...searchParams, region: e.target.value })
                }
              />
            </div>
            <Button type="submit" size="icon" variant="outline">
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={followingOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setFollowingOnly(!followingOnly)}
            >
              팔로잉 업체만
            </Button>
          </div>
        </form>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">
            검색 중...
          </div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            검색 결과가 없습니다
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              총 {total}개의 일자리
            </p>

            {events.map((event) => (
              <Link key={event.id} href={`/worker/events/${event.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{event.title}</h3>
                          {event.is_following_org && (
                            <Badge variant="secondary" className="text-xs">
                              팔로잉
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {event.org_name}
                        </p>
                      </div>
                      <Badge
                        variant={
                          event.total_positions - event.filled_positions > 0
                            ? "default"
                            : "secondary"
                        }
                      >
                        {event.total_positions - event.filled_positions > 0
                          ? `${event.total_positions - event.filled_positions}명 모집중`
                          : "마감"}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {event.event_date}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {event.location_name}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(event.min_hourly_rate)}
                        {event.min_hourly_rate !== event.max_hourly_rate &&
                          ` ~ ${formatCurrency(event.max_hourly_rate)}`}
                        /시
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {event.start_time.slice(0, 5)} -{" "}
                        {event.end_time.slice(0, 5)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}

            {/* Pagination */}
            {total > 20 && (
              <div className="flex justify-center gap-2 pt-4">
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
    </div>
  );
}
