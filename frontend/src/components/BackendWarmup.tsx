"use client";

import { useEffect } from "react";
import { warmUpBackend } from "@/lib/api";

/**
 * アプリ起動直後にバックエンドを起こすだけのコンポーネント（#125）。
 * 認証の解決を待たずに発火させることで、Firebase Auth の復元と
 * Cloud Run のコールドスタートが並列に進む。描画は行わない。
 */
export function BackendWarmup() {
  useEffect(() => {
    warmUpBackend();
  }, []);

  return null;
}
