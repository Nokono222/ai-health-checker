"use client";

import { useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { LogListParams, LogRecord } from "@/lib/api";

export type LogsApi = {
  listLogs: (params?: LogListParams) => Promise<LogRecord[]>;
};

const LOGS_KEY_PREFIX = "logs";

/**
 * 期間ごとに一意な SWR キャッシュキー。
 * 同じ期間の取得はコンポーネント間・画面遷移をまたいで共有される。
 */
export function logsKey(params?: LogListParams): [string, string, string] {
  return [LOGS_KEY_PREFIX, params?.startDate ?? "", params?.endDate ?? ""];
}

/**
 * ログ一覧を SWR キャッシュ付きで取得する。
 * キャッシュ済みの期間は即座に表示され、裏で再検証される（stale-while-revalidate）。
 * api はモジュールレベルなど参照が安定した場所で生成して渡すこと。
 * enabled=false の間は取得しない（条件付きフェッチ用）。
 */
export function useLogs(
  params: LogListParams | undefined,
  api: LogsApi,
  enabled = true
) {
  const { data, error, isLoading } = useSWR(
    enabled ? logsKey(params) : null,
    () => api.listLogs(params),
    { keepPreviousData: true }
  );
  return {
    logs: data ?? [],
    loading: isLoading,
    error: error ? "ログの取得に失敗しました" : null,
  };
}

/**
 * ログの作成・更新・削除後に全期間のログキャッシュを無効化し再取得させる。
 *
 * swr から直接 import するグローバル mutate は既定キャッシュに束縛されており、
 * カスタムキャッシュプロバイダ（#125 C-3 の localStorage 永続化）配下では
 * 別のキャッシュを触ってしまい無効化が効かない。必ず useSWRConfig() の
 * mutate を使うこと。
 */
export function useInvalidateLogs(): () => Promise<unknown> {
  const { mutate } = useSWRConfig();
  return useCallback(
    () => mutate((key) => Array.isArray(key) && key[0] === LOGS_KEY_PREFIX),
    [mutate]
  );
}
