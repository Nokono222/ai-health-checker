import type { State } from "swr";

/** localStorage 相当の最小インターフェース（テストで差し替えるため） */
export type CacheStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** キャッシュは uid ごとに分け、アカウント切替でデータが混ざらないようにする */
export function cacheStorageKey(uid: string): string {
  return `healthlog:swr-cache:${uid}`;
}

/** 端末に残すキャッシュの上限。超える場合は保存しない（localStorage の枯渇を避ける） */
const MAX_SNAPSHOT_BYTES = 1_000_000;

export type PersistedEntry = [string, { data: unknown }];

/** 保存済みキャッシュを読み出す。壊れていれば空として扱う */
export function readSnapshot(uid: string, storage: CacheStorage): PersistedEntry[] {
  try {
    const raw = storage.getItem(cacheStorageKey(uid));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is PersistedEntry =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === "string" &&
        typeof entry[1] === "object" &&
        entry[1] !== null
    );
  } catch {
    return [];
  }
}

/**
 * 取得に成功したデータだけを保存する。
 * エラーや取得中フラグは次回起動時に復元しても意味がないため落とす。
 */
export function writeSnapshot(
  uid: string,
  entries: Iterable<[string, State]>,
  storage: CacheStorage
): void {
  const persisted: PersistedEntry[] = [];
  for (const [key, state] of entries) {
    if (state && state.data !== undefined && state.error === undefined) {
      persisted.push([key, { data: state.data }]);
    }
  }
  try {
    const serialized = JSON.stringify(persisted);
    if (serialized.length > MAX_SNAPSHOT_BYTES) return;
    storage.setItem(cacheStorageKey(uid), serialized);
  } catch {
    // 容量超過などは無視する（キャッシュが無くてもアプリは動作する）
  }
}

/** ログアウト・アカウント切替時に端末から消す */
export function clearSnapshot(uid: string, storage: CacheStorage): void {
  try {
    storage.removeItem(cacheStorageKey(uid));
  } catch {
    // 失敗しても続行する
  }
}
