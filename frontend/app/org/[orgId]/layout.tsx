"use client";

import { useParams } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const orgId = params.orgId as string;

  return (
    <div className="min-h-screen">
      <Sidebar orgId={orgId} type="org" />
      <div className="pl-64">
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
