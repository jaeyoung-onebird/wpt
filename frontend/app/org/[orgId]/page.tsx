"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Users, CreditCard, TrendingUp, Plus, Check, X } from "lucide-react";
import { orgApi } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Organization, EventListItem } from "@/types";

interface ApplicationForOrg {
  id: string;
  worker_id: string;
  worker_nickname: string;
  worker_trust_score: number;
  position_title: string;
  applied_at: string;
  is_following: boolean;
}

export default function OrgDashboardPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [org, setOrg] = useState<Organization | null>(null);
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [pendingApplications, setPendingApplications] = useState<ApplicationForOrg[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [orgRes, eventsRes] = await Promise.all([
          orgApi.getOrg(orgId),
          orgApi.getEvents(orgId, { status: "published", page: 1, size: 5 }),
        ]);
        setOrg(orgRes.data);
        setEvents(eventsRes.data.items);

        // Fetch pending applications from first event
        if (eventsRes.data.items.length > 0) {
          const appRes = await orgApi.getEventApplications(
            orgId,
            eventsRes.data.items[0].id,
            "pending"
          );
          setPendingApplications(appRes.data.slice(0, 5));
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [orgId]);

  const handleApplicationReview = async (
    applicationId: string,
    status: "accepted" | "rejected"
  ) => {
    try {
      await orgApi.reviewApplication(orgId, applicationId, { status });
      setPendingApplications((prev) =>
        prev.filter((app) => app.id !== applicationId)
      );
    } catch (error) {
      console.error("Failed to review application:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{org?.name}</h1>
          <p className="text-muted-foreground">
            {org?.is_verified ? (
              <Badge variant="success">인증완료</Badge>
            ) : (
              <Badge variant="secondary">인증대기</Badge>
            )}
          </p>
        </div>
        <Link href={`/org/${orgId}/events/new`}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            이벤트 등록
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-100 p-3">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">진행중 이벤트</p>
              <p className="text-2xl font-bold">{events.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-100 p-3">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">팔로워</p>
              <p className="text-2xl font-bold">{org?.follower_count || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-yellow-100 p-3">
              <TrendingUp className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">평균 평점</p>
              <p className="text-2xl font-bold">{org?.rating_avg || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-purple-100 p-3">
              <CreditCard className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">이번달 정산</p>
              <p className="text-2xl font-bold">{formatCurrency(0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>진행중 이벤트</CardTitle>
            <Link href={`/org/${orgId}/events`}>
              <Button variant="ghost" size="sm">
                전체 보기
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                등록된 이벤트가 없습니다
              </p>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <Link
                    key={event.id}
                    href={`/org/${orgId}/events/${event.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
                      <div>
                        <h3 className="font-semibold">{event.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {event.event_date} | {event.location_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge>
                          {event.filled_positions}/{event.total_positions}명
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Applications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>대기중 지원</CardTitle>
            <Badge variant="secondary">{pendingApplications.length}건</Badge>
          </CardHeader>
          <CardContent>
            {pendingApplications.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                대기중인 지원이 없습니다
              </p>
            ) : (
              <div className="space-y-4">
                {pendingApplications.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {app.worker_nickname[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {app.worker_nickname}
                          </span>
                          {app.is_following && (
                            <Badge variant="secondary" className="text-xs">
                              팔로잉
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {app.position_title} · 신뢰 {app.worker_trust_score}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() =>
                          handleApplicationReview(app.id, "rejected")
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          handleApplicationReview(app.id, "accepted")
                        }
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
