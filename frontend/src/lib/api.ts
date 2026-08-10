import { getIdToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { DuplicateDateError, NoLogsError } from "@/lib/errors";
import { AnalysisReport, AnalysisRunParams } from "@/lib/reports";

export type { AnalysisReport, AnalysisRunParams };
export { DuplicateDateError, NoLogsError };

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export type WarmUpFetch = (url: string) => Promise<unknown>;

const defaultWarmUpFetch: WarmUpFetch = (url) => fetch(url, { cache: "no-store" });

/**
 * バックエンド（Cloud Run）のコールドスタートを先に始めさせる（#125）。
 * 認証の解決を待たずに発火させることで、Firebase Auth の復元と
 * コールドスタートが直列ではなく並列になる。
 * 認証不要の /health を使い、結果は使わないので失敗は無視する。
 */
export function warmUpBackend(fetcher: WarmUpFetch = defaultWarmUpFetch): void {
  void Promise.resolve()
    .then(() => fetcher(`${BACKEND_URL}/health`))
    .catch(() => undefined);
}

async function getToken(): Promise<string> {
  if (!auth.currentUser) throw new Error("Not authenticated");
  return getIdToken(auth.currentUser);
}

export async function fetchWithAuth(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getToken();
  return fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

export type LogCreatePayload = {
  date: string;
  is_holiday: boolean;
  mood_morning: number;
  mood_after_work: number | null;
  fatigue: number | null;
  comment: string | null;
  work_content: string | null;
  work_start: string | null;
  work_end: string | null;
  gym: boolean;
};

export type LogUpdatePayload = Partial<Omit<LogCreatePayload, "date">>;

export type LogRecord = LogCreatePayload & {
  id: string;
  user_id: string;
  overtime_minutes: number | null;
  overtime_score: number | null;
  created_at: string;
  updated_at: string;
};

export async function createLog(payload: LogCreatePayload): Promise<LogRecord> {
  const res = await fetchWithAuth("/logs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (res.status === 409) throw new DuplicateDateError();
  if (!res.ok) throw new Error(`Failed to create log: ${res.status}`);
  return res.json();
}

export async function updateLog(id: string, payload: LogUpdatePayload): Promise<LogRecord> {
  const res = await fetchWithAuth(`/logs/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update log: ${res.status}`);
  return res.json();
}

export async function getLog(id: string): Promise<LogRecord | null> {
  const res = await fetchWithAuth(`/logs/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to get log: ${res.status}`);
  return res.json();
}

export async function deleteLog(id: string): Promise<void> {
  const res = await fetchWithAuth(`/logs/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete log: ${res.status}`);
}

export type LogListParams = {
  startDate?: string;
  endDate?: string;
};

export async function listLogs(params?: LogListParams): Promise<LogRecord[]> {
  const query = new URLSearchParams();
  if (params?.startDate) query.set("start_date", params.startDate);
  if (params?.endDate) query.set("end_date", params.endDate);
  const qs = query.toString();
  const res = await fetchWithAuth(qs ? `/logs?${qs}` : "/logs");
  if (!res.ok) throw new Error(`Failed to list logs: ${res.status}`);
  return res.json();
}

export async function listReports(): Promise<AnalysisReport[]> {
  const res = await fetchWithAuth("/analysis/reports");
  if (!res.ok) throw new Error(`Failed to list reports: ${res.status}`);
  return res.json();
}

export async function runAnalysis(params?: AnalysisRunParams): Promise<AnalysisReport> {
  const body: Record<string, string> = {};
  if (params?.startDate) body.start_date = params.startDate;
  if (params?.endDate) body.end_date = params.endDate;
  if (params?.focus) body.focus = params.focus;
  const res = await fetchWithAuth("/analysis/run", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (res.status === 404) throw new NoLogsError();
  if (!res.ok) throw new Error(`Failed to run analysis: ${res.status}`);
  return res.json();
}
