"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AppSkeleton } from "@/components/ui/skeleton";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // 認証の解決から API 取得までの間ずっと白画面だったため、
  // 先にアプリの骨組みだけを描画して体感の待ち時間を減らす（#125）
  if (loading || !user) return <AppSkeleton />;

  return <>{children}</>;
}
