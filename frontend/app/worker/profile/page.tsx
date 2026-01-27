"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Star,
  Briefcase,
  Clock,
  AlertTriangle,
  ChevronRight,
  Settings,
  CreditCard,
  Heart,
} from "lucide-react";
import { workerApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { WorkerProfile } from "@/types";

export default function ProfilePage() {
  const { user, logout } = useAuthStore();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await workerApi.getProfile();
        setProfile(response.data);
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Profile Header */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile?.profile_image_url || ""} />
              <AvatarFallback className="text-2xl">
                {profile?.nickname?.[0] || user?.name?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{profile?.nickname}</h1>
              <p className="text-sm text-muted-foreground">{profile?.region}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {profile?.work_types?.map((type) => (
                  <Badge key={type} variant="secondary">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-yellow-500">
                <Star className="h-4 w-4 fill-current" />
                <span className="font-bold">{profile?.trust_score}</span>
              </div>
              <p className="text-xs text-muted-foreground">신뢰점수</p>
            </div>
            <div>
              <div className="font-bold">{profile?.total_jobs}</div>
              <p className="text-xs text-muted-foreground">총 근무</p>
            </div>
            <div>
              <div className="font-bold">{profile?.rating_avg}</div>
              <p className="text-xs text-muted-foreground">평점</p>
            </div>
            <div>
              <div className="font-bold text-red-500">{profile?.no_show_count}</div>
              <p className="text-xs text-muted-foreground">노쇼</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Menu Items */}
      <div className="space-y-3">
        <Link href="/worker/applications">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
                <span>지원 내역</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/worker/following">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Heart className="h-5 w-5 text-muted-foreground" />
                <span>팔로잉 업체</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/worker/settings">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <span>설정</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Card
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => {
            logout();
            window.location.href = "/auth/login";
          }}
        >
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3 text-destructive">
              <span>로그아웃</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bio */}
      {profile?.bio && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">자기소개</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{profile.bio}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
