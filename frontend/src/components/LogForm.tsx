"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLogForm, LogFormValues } from "@/hooks/useLogForm";
import {
  DuplicateGuardApi,
  useDuplicateDateGuard,
} from "@/hooks/useDuplicateDateGuard";
import { usePreviousWorkdayLog } from "@/hooks/usePreviousWorkdayLog";
import { createLog, updateLog, deleteLog, listLogs, DuplicateDateError, LogRecord } from "@/lib/api";
import { invalidateLogs, LogsApi } from "@/hooks/useLogs";
import { ColoredSlider } from "@/components/ui/colored-slider";
import { Card } from "@/components/ui/card";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { FormRow, Divider } from "@/components/ui/form-row";
import { Toggle } from "@/components/ui/toggle";
import { getEmotionColor, getFatigueColor, getOvertimeColor } from "@/lib/colors";
import { formatMood } from "@/lib/format";

type Props = {
  existingLog?: LogRecord;
};

function toNullableStr(v: string): string | null {
  return v.trim() === "" ? null : v.trim();
}

// テストで差し替えられるよう DI で渡す（参照安定のためモジュールレベルで生成）
const duplicateGuardApi: DuplicateGuardApi = { listLogs };
const logsApi: LogsApi = { listLogs };

export function LogForm({ existingLog }: Props) {
  const router = useRouter();
  // 新規記録は認証の解決を待たずに描画されるため（#125）、サーバーを叩く処理は
  // 認証が済むまで止める。フォームの入力自体はその間も自由に行える
  const { user } = useAuth();
  const authenticated = user !== null;
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // fatigue が null = 朝の分だけ記録された未完成ログ（勤務終了後の項目が未入力）
  const isIncompleteLog = existingLog ? existingLog.fatigue === null : false;

  const initial: Partial<LogFormValues> | undefined = existingLog
    ? {
        date: existingLog.date,
        is_holiday: existingLog.is_holiday,
        morning_only: isIncompleteLog,
        mood_morning: existingLog.mood_morning,
        // 休日は記録対象外だった頃のログは null のため、記録済みログの編集時は
        // スライダーの表示値に合わせて 0 で初期化する
        mood_after_work:
          existingLog.mood_after_work ?? (isIncompleteLog ? null : 0),
        fatigue: existingLog.fatigue ?? 3,
        comment: existingLog.comment ?? "",
        work_content: existingLog.work_content ?? "",
        work_start: existingLog.work_start ?? "",
        work_end: existingLog.work_end ?? "",
        gym: existingLog.gym,
      }
    : undefined;

  const { form, fields, setField, overtimePreview } = useLogForm(initial);
  const { formState: { errors } } = form;

  // 新規記録時のみ、選択中の日付に既存ログがあれば編集画面へ誘導する
  const existingLogIdForDate = useDuplicateDateGuard(
    fields.date,
    !existingLog && authenticated,
    duplicateGuardApi
  );

  // 前回の勤務日の仕事内容をワンタップで転記できるようにする（#95, #115）
  // 勤務時間は毎日変動するため転記対象は work_content のみ。
  // 対象は入力中のフォームのみ（新規 or 追記待ちの編集）。朝のみモードは
  // 仕事内容を入力しないため対象外
  const canCopyPrevious = !existingLog || isIncompleteLog;
  const previousLog = usePreviousWorkdayLog(
    fields.date,
    canCopyPrevious && !fields.is_holiday && !fields.morning_only && authenticated,
    logsApi
  );

  function applyPreviousLog() {
    if (!previousLog) return;
    setField("work_content", previousLog.work_content ?? "");
  }

  const moodColor = getEmotionColor(fields.mood_morning);
  const wemColor = getEmotionColor(fields.mood_after_work ?? 0);
  const fatigueColor = getFatigueColor(fields.fatigue);
  const overtimeColor = getOvertimeColor(overtimePreview?.score ?? null);

  async function onValid(data: LogFormValues) {
    setSubmitting(true);
    setApiError(null);
    try {
      // 朝のみモードでは勤務終了後にしか分からない項目を未入力(null)として保存する
      const morning = data.morning_only;
      const payload = {
        date: data.date,
        is_holiday: data.is_holiday,
        mood_morning: data.mood_morning,
        mood_after_work: morning ? null : (data.mood_after_work ?? 0),
        fatigue: morning ? null : data.fatigue,
        comment: toNullableStr(data.comment),
        work_content:
          data.is_holiday || morning ? null : toNullableStr(data.work_content),
        work_start: data.is_holiday ? null : toNullableStr(data.work_start),
        work_end: data.is_holiday || morning ? null : toNullableStr(data.work_end),
        gym: morning ? false : data.gym,
      };
      if (existingLog) {
        await updateLog(existingLog.id, payload);
      } else {
        await createLog(payload);
      }
      // 一覧キャッシュを無効化してから遷移する（完了は待たず、遷移先で再検証される）
      void invalidateLogs();
      router.push("/");
      router.refresh();
    } catch (err) {
      if (err instanceof DuplicateDateError) {
        setApiError("この日付は記録済みです。既存の記録を編集してください。");
      } else {
        setApiError(err instanceof Error ? err.message : "エラーが発生しました");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!existingLog) return;
    try {
      await deleteLog(existingLog.id);
      void invalidateLogs();
      router.push("/");
      router.refresh();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "削除に失敗しました");
      setShowDeleteConfirm(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-canvas">

      {/* Sticky header */}
      <div className="sticky top-0 z-10 shrink-0 border-b border-border bg-canvas px-5 pb-3 pt-3.5">
        <div className="mx-auto flex w-full max-w-lg items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex cursor-pointer items-center gap-1 p-0 text-base font-medium text-primary focus:outline-none"
          >
            <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
              <path d="M7 1.5L1.5 6.5L7 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            戻る
          </button>
          <span className="text-lg font-semibold text-fg">
            {existingLog ? "詳細・編集" : "新規記録"}
          </span>
          {existingLog && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="ml-auto cursor-pointer p-0 text-sm font-medium text-danger focus:outline-none"
            >
              削除
            </button>
          )}
        </div>
      </div>

      {/* Form body */}
      <form onSubmit={form.handleSubmit(onValid)} className="mx-auto flex w-full max-w-lg flex-col gap-2.5 px-4 pb-10 pt-3.5">

        {apiError && (
          <p className="rounded-xl bg-danger-subtle px-3.5 py-2.5 text-sm text-danger">
            {apiError}
          </p>
        )}
        {Object.keys(errors).length > 0 && (
          <p className="rounded-xl bg-danger-subtle px-3.5 py-2.5 text-sm text-danger">
            {Object.values(errors)[0]?.message ?? "入力内容を確認してください"}
          </p>
        )}
        {existingLogIdForDate && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-primary-subtle px-3.5 py-2.5">
            <p className="text-sm text-fg-secondary">
              この日付は記録済みです
            </p>
            <button
              type="button"
              onClick={() => router.push(`/logs/${existingLogIdForDate}/edit`)}
              className="shrink-0 cursor-pointer rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-white"
            >
              編集画面を開く
            </button>
          </div>
        )}

        {/* Entry mode: 朝のうちは朝の分だけ記録し、勤務終了後に追記できる */}
        {(!existingLog || isIncompleteLog) && (
          <div className="flex rounded-full border border-border bg-surface-1 p-0.5">
            {([
              { value: false, label: "1日分" },
              { value: true, label: "朝のみ" },
            ] as const).map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setField("morning_only", option.value)}
                className={`flex-1 cursor-pointer rounded-full py-1.5 text-sm font-medium transition-colors ${
                  fields.morning_only === option.value
                    ? "bg-primary text-white"
                    : "text-fg-secondary"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {/* Date + Holiday */}
        <Card className="flex flex-col gap-0 p-0 overflow-hidden">
          <FormRow label="日付">
            {/* 日付はログの識別子のため編集時は変更不可（バックエンドも受け付けない） */}
            <input
              type="date"
              value={fields.date}
              onChange={(e) => setField("date", e.target.value)}
              required
              disabled={!!existingLog}
              className="cursor-pointer bg-transparent py-3.5 text-right text-sm text-fg outline-none disabled:cursor-default disabled:opacity-60"
            />
          </FormRow>
          <Divider />
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-sm font-medium text-fg-secondary">休日</span>
            <Toggle checked={fields.is_holiday} onChange={(v) => setField("is_holiday", v)} />
          </div>
        </Card>

        {/* Morning mood */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-fg-secondary">朝の気分</span>
            <span className="text-2xl font-semibold tracking-tight" style={{ color: moodColor }}>
              {formatMood(fields.mood_morning)}
            </span>
          </div>
          <ColoredSlider min={-5} max={5} value={fields.mood_morning} onChange={(v) => setField("mood_morning", v)} color={moodColor} minLabel="−5" maxLabel="+5" midLabel="0" />
        </Card>

        {/* Work fields */}
        {!fields.is_holiday && (
          <>
            <Card className="flex flex-col gap-0 p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="text-sm font-medium text-fg-secondary">開始</span>
                <input type="time" value={fields.work_start} onChange={(e) => setField("work_start", e.target.value)} required={!fields.is_holiday} className="cursor-pointer bg-transparent text-right text-sm text-fg outline-none" />
              </div>
              {!fields.morning_only && (
                <>
                  <Divider />
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <span className="text-sm font-medium text-fg-secondary">終了</span>
                    <input type="time" value={fields.work_end} onChange={(e) => setField("work_end", e.target.value)} required={!fields.is_holiday && !fields.morning_only} className="cursor-pointer bg-transparent text-right text-sm text-fg outline-none" />
                  </div>
                  <Divider />
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <span className="text-sm font-medium text-fg-secondary">残業スコア</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-semibold tracking-tight" style={{ color: overtimeColor }}>
                        {overtimePreview ? overtimePreview.score : "—"}
                      </span>
                      <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-fg-muted">
                        自動
                      </span>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </>
        )}

        {/* Fatigue */}
        {!fields.morning_only && (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium text-fg-secondary">疲れ度</span>
              <span className="text-2xl font-semibold" style={{ color: fatigueColor }}>
                {fields.fatigue}
              </span>
            </div>
            <ColoredSlider min={1} max={5} value={fields.fatigue} onChange={(v) => setField("fatigue", v)} color={fatigueColor} minLabel="1 快適" maxLabel="5 疲弊" />
          </Card>
        )}

        {/* End-of-day mood: 休日も記録する */}
        {!fields.morning_only && (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium text-fg-secondary">1日の終わりの気分</span>
              <span className="text-2xl font-semibold tracking-tight" style={{ color: wemColor }}>
                {formatMood(fields.mood_after_work ?? 0)}
              </span>
            </div>
            <ColoredSlider min={-5} max={5} value={fields.mood_after_work ?? 0} onChange={(v) => setField("mood_after_work", v)} color={wemColor} minLabel="−5" maxLabel="+5" midLabel="0" />
          </Card>
        )}

        {/* Work content */}
        {!fields.is_holiday && !fields.morning_only && (
          <>
            {canCopyPrevious && previousLog && (
              <button
                type="button"
                onClick={applyPreviousLog}
                className="-mb-0.5 cursor-pointer self-end p-0 text-sm font-medium text-primary"
              >
                前回と同じ仕事内容を入力
              </button>
            )}
            <Card>
              <label className="mb-2.5 block text-sm font-medium text-fg-secondary">仕事内容</label>
              <textarea
                value={fields.work_content}
                onChange={(e) => setField("work_content", e.target.value)}
                placeholder="今日の業務内容…"
                className="min-h-[72px] w-full resize-none bg-transparent text-sm leading-relaxed text-fg outline-none placeholder:text-fg-muted"
              />
            </Card>
          </>
        )}

        {/* Gym */}
        {!fields.morning_only && (
          <Card className="flex flex-col gap-0 p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm font-medium text-fg-secondary">ジムに行った</span>
              <Toggle checked={fields.gym} onChange={(v) => setField("gym", v)} />
            </div>
          </Card>
        )}

        {/* Comment */}
        <Card>
          <label className="mb-2.5 block text-sm font-medium text-fg-secondary">コメント</label>
          <textarea
            value={fields.comment}
            onChange={(e) => setField("comment", e.target.value)}
            placeholder="今日のメモ…"
            className="min-h-[72px] w-full resize-none bg-transparent text-sm leading-relaxed text-fg outline-none placeholder:text-fg-muted"
          />
        </Card>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !!existingLogIdForDate || !authenticated}
          className="mt-1 w-full cursor-pointer rounded-xl bg-primary py-3.5 text-base font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? "保存中..."
            : !authenticated
              ? "準備中..."
              : existingLog
                ? "保存する"
                : fields.morning_only
                  ? "朝の分を記録する"
                  : "記録する"}
        </button>
      </form>

      {/* Delete confirmation bottom sheet */}
      <ConfirmSheet
        open={showDeleteConfirm}
        title="記録を削除しますか？"
        message="この操作は取り消せません。"
        confirmLabel="削除する"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
