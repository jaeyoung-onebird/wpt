"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "이메일을 입력해주세요")
    .email("올바른 이메일 형식이 아닙니다"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await authApi.login(data.email, data.password);
      setAuth(response.data);

      // Redirect based on user type
      const { user, org_memberships, worker_profile_id } = response.data;

      if (user.platform_role === "admin" || user.platform_role === "super_admin") {
        router.push("/admin");
      } else if (org_memberships.length > 0) {
        router.push(`/org/${org_memberships[0].org_id}`);
      } else if (worker_profile_id) {
        router.push("/worker");
      } else {
        router.push("/onboarding");
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "로그인에 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">로그인</CardTitle>
        <CardDescription>WorkProof Chain에 오신 것을 환영합니다</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">이메일</label>
            <Input
              type="email"
              placeholder="email@example.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">비밀번호</label>
            <Input
              type="password"
              placeholder="••••••••"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "로그인 중..." : "로그인"}
          </Button>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">계정이 없으신가요? </span>
            <Link href="/auth/signup" className="text-primary hover:underline">
              회원가입
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
