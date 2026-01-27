"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { workerApi } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PayrollRecord } from "@/types";

export default function PayrollPage() {
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    paid: 0,
  });

  useEffect(() => {
    const fetchPayroll = async () => {
      try {
        const response = await workerApi.getPayroll();
        const data: PayrollRecord[] = response.data;
        setPayrolls(data);

        // Calculate summary
        const total = data.reduce((sum, p) => sum + p.total_pay, 0);
        const pending = data
          .filter((p) => p.payment_status === "pending")
          .reduce((sum, p) => sum + p.total_pay, 0);
        const paid = data
          .filter((p) => p.payment_status === "paid")
          .reduce((sum, p) => sum + p.total_pay, 0);

        setSummary({ total, pending, paid });
      } catch (error) {
        console.error("Failed to fetch payroll:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPayroll();
  }, []);

  const getStatusBadge = (status: string, confirmed: boolean) => {
    if (status === "paid") {
      return <Badge variant="success">지급완료</Badge>;
    }
    if (status === "disputed") {
      return <Badge variant="destructive">이의제기</Badge>;
    }
    if (confirmed) {
      return <Badge variant="secondary">확인완료</Badge>;
    }
    return <Badge>정산대기</Badge>;
  };

  return (
    <div className="p-4">
      <h1 className="mb-6 text-xl font-bold">급여 내역</h1>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">총 금액</p>
            <p className="text-lg font-bold">{formatCurrency(summary.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">정산대기</p>
            <p className="text-lg font-bold text-yellow-600">
              {formatCurrency(summary.pending)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">지급완료</p>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(summary.paid)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payroll List */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">로딩 중...</div>
      ) : payrolls.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          급여 내역이 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {payrolls.map((payroll) => (
            <Card key={payroll.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{payroll.event_title}</h3>
                      {getStatusBadge(
                        payroll.payment_status,
                        payroll.worker_confirmed
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {payroll.org_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(payroll.work_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(payroll.total_pay)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {Math.floor(payroll.worked_minutes / 60)}시간{" "}
                      {payroll.worked_minutes % 60}분
                    </p>
                  </div>
                </div>

                <div className="mt-3 border-t pt-3 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>시급</span>
                    <span>{formatCurrency(payroll.hourly_rate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>기본급</span>
                    <span>{formatCurrency(payroll.base_pay)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
