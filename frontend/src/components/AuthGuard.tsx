"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AppSkeleton } from "@/components/ui/skeleton";

type Props = {
  children: React.ReactNode;
  /**
   * 認証の解決を待たずに children を描画する（#125）。
   * サーバーのデータが無くても操作を始められる画面（入力フォーム）向け。
   * 未認証が確定した時点でログイン画面へ送る挙動は変わらない。
   */
  renderWhileResolving?: boolean;
};

export function AuthGuard({ children, renderWhileResolving = false }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // 認証の解決から API 取得までの間ずっと白画面だったため、
  // 先にアプリの骨組みだけを描画して体感の待ち時間を減らす（#125）
  if (loading) return renderWhileResolving ? <>{children}</> : <AppSkeleton />;

  // 未認証が確定。ログイン画面へ遷移するまでの繋ぎ
  if (!user) return <AppSkeleton />;

  return <>{children}</>;
}
