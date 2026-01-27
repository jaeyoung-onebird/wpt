"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

const signupSchema = z.object({
  email: z
    .string()
    .min(1, "이메일을 입력해주세요")
    .email("올바른 이메일 형식이 아닙니다"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
  confirmPassword: z.string(),
  name: z.string().min(2, "이름은 2자 이상이어야 합니다"),
  phone: z
    .string()
    .regex(/^01[0-9]{8,9}$/, "올바른 전화번호 형식이 아닙니다")
    .optional()
    .or(z.literal("")),
  nickname: z.string().min(2, "닉네임은 2자 이상이어야 합니다").optional(),
  region: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "비밀번호가 일치하지 않습니다",
  path: ["confirmPassword"],
});

type SignupForm = z.infer<typeof signupSchema>;

function SignupFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type") || "worker";
  const inviteCode = searchParams.get("invite");
  const { setAuth } = useAuthStore();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true);
    setError("");

    try {
      const signupData = {
        email: data.email,
        password: data.password,
        name: data.name,
        phone: data.phone || undefined,
        nickname: type === "worker" ? data.nickname : undefined,
        region: type === "worker" ? data.region : undefined,
        invite_code: inviteCode || undefined,
      };

      const response = await authApi.signup(signupData);
      setAuth(response.data);

      if (type === "org") {
        router.push("/org/register");
      } else {
        router.push("/worker");
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "회원가입에 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">회원가입</CardTitle>
        <CardDescription>
          {type === "org" ? "업체 회원으로 가입합니다" : "근무자로 가입합니다"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {inviteCode && (
            <div className="rounded-md bg-primary/10 p-3 text-sm text-primary">
              초대 코드가 적용되었습니다
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">이메일 *</label>
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
            <label className="text-sm font-medium">이름 *</label>
            <Input placeholder="홍길동" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">전화번호</label>
            <Input
              type="tel"
              placeholder="01012345678"
              {...register("phone")}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>

          {type === "worker" && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">닉네임</label>
                <Input placeholder="활동명" {...register("nickname")} />
                {errors.nickname && (
                  <p className="text-sm text-destructive">{errors.nickname.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">활동 지역</label>
                <Input placeholder="서울 강남" {...register("region")} />
              </div>
            </>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">비밀번호 *</label>
            <Input
              type="password"
              placeholder="8자 이상"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">비밀번호 확인 *</label>
            <Input
              type="password"
              placeholder="비밀번호 재입력"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "가입 중..." : "회원가입"}
          </Button>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">이미 계정이 있으신가요? </span>
            <Link href="/auth/login" className="text-primary hover:underline">
              로그인
            </Link>
          </div>

          {type === "worker" && (
            <div className="text-center text-sm">
              <Link
                href="/auth/signup?type=org"
                className="text-muted-foreground hover:text-primary"
              >
                업체로 가입하기
              </Link>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <Card>
        <CardContent className="p-8 text-center">
          로딩 중...
        </CardContent>
      </Card>
    }>
      <SignupFormContent />
    </Suspense>
  );
}
