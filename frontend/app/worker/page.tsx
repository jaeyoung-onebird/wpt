"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Clock, ChevronRight, Star, Calendar } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { workerApi } from "@/lib/api";
import { formatCurrency, formatTime } from "@/lib/utils";
import type { ScheduleItem, EventListItem } from "@/types";

export default function WorkerHomePage() {
  const { user } = useAuthStore();
  const [todaySchedule, setTodaySchedule] = useState<ScheduleItem[]>([]);
  const [recommendedEvents, setRecommendedEvents] = useState<EventListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const [scheduleRes, eventsRes] = await Promise.all([
          workerApi.getSchedule({ from_date: today, to_date: today }),
          workerApi.searchEvents({ page: 1, size: 6 }),
        ]);
        setTodaySchedule(scheduleRes.data);
        setRecommendedEvents(eventsRes.data.items);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            안녕하세요, {user?.name || "근무자"}님
          </h1>
          <p className="text-muted-foreground">오늘도 좋은 하루 되세요!</p>
        </div>
        <Avatar className="h-12 w-12">
          <AvatarFallback>{user?.name?.[0] || "U"}</AvatarFallback>
        </Avatar>
      </div>

      {/* Today's Schedule */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">오늘 스케줄</h2>
          <Link href="/worker/schedule" className="text-sm text-primary">
            전체 보기
          </Link>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              로딩 중...
            </CardContent>
          </Card>
        ) : todaySchedule.length > 0 ? (
          <div className="space-y-3">
            {todaySchedule.map((schedule) => (
              <Card key={schedule.event_id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold">{schedule.event_title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {schedule.org_name} · {schedule.position_title}
                      </p>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4" />
                        {formatTime(schedule.start_time)} -{" "}
                        {formatTime(schedule.end_time)}
                      </div>
                    </div>
                    <Button>출근하기</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <Calendar className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">오늘 예정된 일정이 없습니다</p>
              <Link href="/worker/events">
                <Button variant="link">일자리 찾아보기</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Recommended Events */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">추천 일자리</h2>
          <Link href="/worker/events" className="text-sm text-primary">
            전체 보기
          </Link>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground">로딩 중...</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {recommendedEvents.map((event) => (
              <Link key={event.id} href={`/worker/events/${event.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold line-clamp-1">
                          {event.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {event.org_name}
                        </p>
                      </div>
                      {event.is_following_org && (
                        <Badge variant="secondary">팔로잉</Badge>
                      )}
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {event.event_date}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {event.location_name}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-semibold text-primary">
                        {formatCurrency(event.min_hourly_rate)}/시
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {event.filled_positions}/{event.total_positions}명
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">빠른 메뉴</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/worker/applications">
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <span>지원 내역</span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/worker/following">
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <span>팔로잉</span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>
    </div>
  );
}
