"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { workerApi } from "@/lib/api";
import { formatCurrency, formatTime } from "@/lib/utils";
import type { ScheduleItem } from "@/types";

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);

  const fetchSchedule = async () => {
    setIsLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const fromDate = new Date(year, month, 1).toISOString().split("T")[0];
      const toDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

      const response = await workerApi.getSchedule({
        from_date: fromDate,
        to_date: toDate,
      });
      setSchedules(response.data);
    } catch (error) {
      console.error("Failed to fetch schedule:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [currentMonth]);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge>예정</Badge>;
      case "checked_in":
        return <Badge variant="warning">근무중</Badge>;
      case "completed":
        return <Badge variant="success">완료</Badge>;
      case "no_show":
        return <Badge variant="destructive">노쇼</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Group schedules by date
  const groupedSchedules = schedules.reduce((acc, schedule) => {
    const date = schedule.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(schedule);
    return acc;
  }, {} as Record<string, ScheduleItem[]>);

  const sortedDates = Object.keys(groupedSchedules).sort();

  return (
    <div className="p-4">
      {/* Month Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">
          {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
        </h1>
        <Button variant="ghost" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Schedule List */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">로딩 중...</div>
      ) : sortedDates.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          이번 달 스케줄이 없습니다
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                {new Date(date).toLocaleDateString("ko-KR", {
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                })}
              </h2>

              <div className="space-y-3">
                {groupedSchedules[date].map((schedule) => (
                  <Card key={schedule.event_id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">
                              {schedule.event_title}
                            </h3>
                            {getStatusBadge(schedule.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {schedule.org_name} · {schedule.position_title}
                          </p>

                          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {formatTime(schedule.start_time)} -{" "}
                              {formatTime(schedule.end_time)}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-semibold text-primary">
                            {formatCurrency(schedule.hourly_rate)}/시
                          </div>
                        </div>
                      </div>

                      {schedule.status === "scheduled" && (
                        <div className="mt-3 flex justify-end">
                          <Button size="sm">출근하기</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
