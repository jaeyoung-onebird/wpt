import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <h1 className="text-2xl font-bold text-primary">WorkProof Chain</h1>
          <div className="flex gap-2">
            <Link href="/auth/login">
              <Button variant="ghost">로그인</Button>
            </Link>
            <Link href="/auth/signup">
              <Button>회원가입</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="container mx-auto px-4 py-20 text-center">
          <h2 className="mb-6 text-4xl font-bold md:text-6xl">
            이벤트 인력 매칭의
            <br />
            <span className="text-primary">새로운 기준</span>
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            AI 기반 스마트 매칭으로 최적의 인력을 찾고,
            <br />
            투명한 근무 기록으로 신뢰를 쌓아가세요.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/auth/signup?type=worker">
              <Button size="lg">근무자로 시작하기</Button>
            </Link>
            <Link href="/auth/signup?type=org">
              <Button size="lg" variant="outline">
                업체로 시작하기
              </Button>
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="bg-muted/50 py-20">
          <div className="container mx-auto px-4">
            <h3 className="mb-12 text-center text-3xl font-bold">
              주요 기능
            </h3>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="rounded-lg bg-background p-6 shadow-sm">
                <div className="mb-4 text-4xl">🎯</div>
                <h4 className="mb-2 text-xl font-semibold">AI 스마트 매칭</h4>
                <p className="text-muted-foreground">
                  선호도와 경력을 분석해 최적의 일자리를 추천해드립니다.
                </p>
              </div>
              <div className="rounded-lg bg-background p-6 shadow-sm">
                <div className="mb-4 text-4xl">📊</div>
                <h4 className="mb-2 text-xl font-semibold">신뢰 점수 시스템</h4>
                <p className="text-muted-foreground">
                  근무 이력 기반 신뢰 점수로 우수 인력을 쉽게 찾으세요.
                </p>
              </div>
              <div className="rounded-lg bg-background p-6 shadow-sm">
                <div className="mb-4 text-4xl">💰</div>
                <h4 className="mb-2 text-xl font-semibold">투명한 정산</h4>
                <p className="text-muted-foreground">
                  실시간 급여 확인과 간편한 정산 시스템을 제공합니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4 py-20 text-center">
          <h3 className="mb-6 text-3xl font-bold">지금 바로 시작하세요</h3>
          <p className="mb-8 text-muted-foreground">
            가입은 무료이며, 1분이면 충분합니다.
          </p>
          <Link href="/auth/signup">
            <Button size="lg">무료로 시작하기</Button>
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 WorkProof Chain. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
