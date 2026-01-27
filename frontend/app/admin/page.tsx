"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Building2,
  CalendarDays,
  Briefcase,
  TrendingUp,
  DollarSign,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import type { PlatformStats, DailyStats } from "@/types";

export default function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, dailyRes] = await Promise.all([
          adminApi.getStats(),
          adminApi.getDailyStats(7),
        ]);
        setStats(statsRes.data);
        setDailyStats(dailyRes.data);
      } catch (error) {
        console.error("Failed to fetch admin stats:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  const statCards = [
    {
      title: "총 유저",
      value: stats?.total_users.toLocaleString() || "0",
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-50",
    },
    {
      title: "총 근무자",
      value: stats?.total_workers.toLocaleString() || "0",
      icon: Briefcase,
      color: "text-green-500",
      bgColor: "bg-green-50",
    },
    {
      title: "총 업체",
      value: stats?.total_organizations.toLocaleString() || "0",
      icon: Building2,
      color: "text-purple-500",
      bgColor: "bg-purple-50",
    },
    {
      title: "인증 업체",
      value: stats?.verified_organizations.toLocaleString() || "0",
      icon: CheckCircle,
      color: "text-emerald-500",
      bgColor: "bg-emerald-50",
    },
    {
      title: "총 이벤트",
      value: stats?.total_events.toLocaleString() || "0",
      icon: CalendarDays,
      color: "text-orange-500",
      bgColor: "bg-orange-50",
    },
    {
      title: "진행중 이벤트",
      value: stats?.active_events.toLocaleString() || "0",
      icon: TrendingUp,
      color: "text-red-500",
      bgColor: "bg-red-50",
    },
    {
      title: "총 지원",
      value: stats?.total_applications.toLocaleString() || "0",
      icon: AlertCircle,
      color: "text-yellow-500",
      bgColor: "bg-yellow-50",
    },
    {
      title: "총 정산액",
      value: `${((stats?.total_payroll_amount || 0) / 1000000).toFixed(1)}M`,
      icon: DollarSign,
      color: "text-indigo-500",
      bgColor: "bg-indigo-50",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">플랫폼 대시보드</h1>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div className={`rounded-full p-3 ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle>최근 7일 통계</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-left font-medium">날짜</th>
                  <th className="p-3 text-right font-medium">신규 유저</th>
                  <th className="p-3 text-right font-medium">신규 근무자</th>
                  <th className="p-3 text-right font-medium">신규 업체</th>
                  <th className="p-3 text-right font-medium">신규 이벤트</th>
                  <th className="p-3 text-right font-medium">지원</th>
                  <th className="p-3 text-right font-medium">완료</th>
                  <th className="p-3 text-right font-medium">정산액</th>
                </tr>
              </thead>
              <tbody>
                {dailyStats.map((day) => (
                  <tr key={day.date} className="border-b hover:bg-muted/50">
                    <td className="p-3">{day.date}</td>
                    <td className="p-3 text-right">{day.new_users}</td>
                    <td className="p-3 text-right">{day.new_workers}</td>
                    <td className="p-3 text-right">{day.new_orgs}</td>
                    <td className="p-3 text-right">{day.new_events}</td>
                    <td className="p-3 text-right">{day.new_applications}</td>
                    <td className="p-3 text-right">{day.completed_jobs}</td>
                    <td className="p-3 text-right">
                      {day.total_paid.toLocaleString()}원
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
