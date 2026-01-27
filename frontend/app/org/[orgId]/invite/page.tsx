"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Link as LinkIcon, QrCode } from "lucide-react";
import { orgApi } from "@/lib/api";

export default function InvitePage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateInviteLink = async () => {
    setIsLoading(true);
    try {
      const response = await orgApi.createInvite(orgId);
      const { invite_url, expires_at } = response.data;
      setInviteUrl(`${window.location.origin}${invite_url}`);
      setExpiresAt(expires_at);
    } catch (error) {
      console.error("Failed to create invite:", error);
      alert("초대 링크 생성에 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">근무자 초대</h1>

      <Card>
        <CardHeader>
          <CardTitle>초대 링크 생성</CardTitle>
          <CardDescription>
            근무자에게 초대 링크를 공유하여 회원가입을 유도할 수 있습니다.
            <br />
            초대 링크로 가입한 근무자는 자동으로 맞팔로우 됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!inviteUrl ? (
            <Button onClick={generateInviteLink} disabled={isLoading}>
              <LinkIcon className="mr-2 h-4 w-4" />
              {isLoading ? "생성 중..." : "초대 링크 생성하기"}
            </Button>
          ) : (
            <>
              <div className="flex gap-2">
                <Input value={inviteUrl} readOnly className="font-mono text-sm" />
                <Button variant="outline" onClick={copyToClipboard}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {expiresAt && (
                <p className="text-sm text-muted-foreground">
                  유효기간:{" "}
                  {new Date(expiresAt).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  까지
                </p>
              )}

              <Button variant="outline" onClick={generateInviteLink}>
                새 링크 생성
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>초대 방법</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              1
            </div>
            <div>
              <h3 className="font-medium">초대 링크 생성</h3>
              <p className="text-sm text-muted-foreground">
                위 버튼을 클릭하여 초대 링크를 생성합니다.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              2
            </div>
            <div>
              <h3 className="font-medium">링크 공유</h3>
              <p className="text-sm text-muted-foreground">
                카카오톡, 문자 등으로 근무자에게 링크를 공유합니다.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              3
            </div>
            <div>
              <h3 className="font-medium">자동 맞팔로우</h3>
              <p className="text-sm text-muted-foreground">
                링크로 가입한 근무자는 자동으로 맞팔로우 됩니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
