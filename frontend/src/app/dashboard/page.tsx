"use client";

/* Role-aware dashboard: creators get the analytics studio, eventees get
   saved / registered / tickets / reminders. */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import CreatorDashboard from "@/components/dashboard/CreatorDashboard";
import EventeeDashboard from "@/components/dashboard/EventeeDashboard";

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/login");
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50dvh" }}>
        <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "ev-spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return user.role === "creator" ? <CreatorDashboard /> : <EventeeDashboard />;
}
