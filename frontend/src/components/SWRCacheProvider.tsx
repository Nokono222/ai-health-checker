"use client";

import { useCallback, useEffect, useRef } from "react";
import { SWRConfig } from "swr";
import type { Cache, State } from "swr";
import { useAuth } from "@/context/AuthContext";
import { clearSnapshot, readSnapshot, writeSnapshot } from "@/lib/swr-cache";

/**
 * SWR のキャッシュを localStorage に永続化する（#125 C-3）。
 * 2回目以降の起動では前回のログ一覧が即座に表示され、裏で再検証される
 * （stale-while-revalidate）。バックエンドのコールドスタートを待たずに
 * 中身のある画面が出せるのが狙い。
 *
 * キャッシュは uid ごとに分け、ログアウト・アカウント切替時には端末から消す。
 */
export function SWRCacheProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const cacheRef = useRef<Map<string, State> | null>(null);
  const previousUidRef = useRef<string | null>(null);

  const provider = useCallback((): Cache => {
    // プリレンダリング時は localStorage が無いので空から始める
    const restored =
      uid && typeof window !== "undefined"
        ? readSnapshot(uid, window.localStorage)
        : [];
    const map = new Map<string, State>(restored);
    cacheRef.current = map;
    return map;
  }, [uid]);

  // ログアウト・アカウント切替では前のユーザーのキャッシュを端末に残さない
  useEffect(() => {
    const previous = previousUidRef.current;
    if (previous && previous !== uid) {
      clearSnapshot(previous, window.localStorage);
    }
    previousUidRef.current = uid;
  }, [uid]);

  // 離脱時に書き戻す。beforeunload はモバイルで発火しないことがあるため
  // visibilitychange / pagehide を使う
  useEffect(() => {
    if (!uid) return;

    const persist = () => {
      if (cacheRef.current) {
        writeSnapshot(uid, cacheRef.current, window.localStorage);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") persist();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", persist);
    return () => {
      persist();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", persist);
    };
  }, [uid]);

  // uid が変わったらキャッシュごと作り直し、前のユーザーのデータを引き継がない
  return (
    <SWRConfig key={uid ?? "anonymous"} value={{ provider }}>
      {children}
    </SWRConfig>
  );
}
