import { cn } from "@/lib/utils";

/** 中身が確定するまでの間、レイアウトの輪郭だけを示すプレースホルダ */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-surface-2", className)} />
  );
}

/**
 * 認証の解決とログ取得を待つ間に表示するアプリ全体の骨組み（#125）。
 * 以前はこの間ずっと白画面だったため、ヘッダーとカード列の輪郭を先に描画する。
 */
export function AppSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas" role="status" aria-busy="true">
      <span className="sr-only">読み込み中</span>

      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-canvas px-5 pb-3 pt-3.5">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between lg:max-w-4xl">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>

      {/* Card list */}
      <div className="mx-auto flex w-full max-w-lg flex-col gap-2 px-4 pb-24 pt-3 lg:max-w-4xl">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-3">
          {CARD_PLACEHOLDER_KEYS.map((key) => (
            <div
              key={key}
              className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface-1 p-4"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CARD_PLACEHOLDER_KEYS = ["a", "b", "c", "d"];
