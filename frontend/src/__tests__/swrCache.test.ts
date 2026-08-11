import { beforeEach, describe, expect, it } from "vitest";
import type { State } from "swr";
import {
  cacheStorageKey,
  clearSnapshot,
  readSnapshot,
  writeSnapshot,
  type CacheStorage,
} from "@/lib/swr-cache";

const UID = "user-1";
const OTHER_UID = "user-2";

function createFakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const storage: CacheStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  };
  return { storage, store };
}

let fake: ReturnType<typeof createFakeStorage>;

beforeEach(() => {
  fake = createFakeStorage();
});

describe("writeSnapshot / readSnapshot", () => {
  it("should restore data that was previously stored", () => {
    const entries: [string, State][] = [["logs-key", { data: [{ id: "log-1" }] }]];

    writeSnapshot(UID, entries, fake.storage);

    expect(readSnapshot(UID, fake.storage)).toEqual([
      ["logs-key", { data: [{ id: "log-1" }] }],
    ]);
  });

  it("should not store entries that failed to load", () => {
    const entries: [string, State][] = [
      ["ok-key", { data: "value" }],
      ["error-key", { error: new Error("failed") }],
      ["pending-key", { isLoading: true }],
    ];

    writeSnapshot(UID, entries, fake.storage);

    expect(readSnapshot(UID, fake.storage)).toEqual([["ok-key", { data: "value" }]]);
  });

  it("should keep each user's cache separate", () => {
    writeSnapshot(UID, [["logs-key", { data: "user-1 data" }]], fake.storage);

    expect(readSnapshot(OTHER_UID, fake.storage)).toEqual([]);
  });

  it("should return no entries when the stored cache is corrupted", () => {
    fake.store.set(cacheStorageKey(UID), "{not valid json");

    expect(readSnapshot(UID, fake.storage)).toEqual([]);
  });

  it("should not throw when the storage rejects the write", () => {
    const failingStorage: CacheStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => undefined,
    };

    expect(() =>
      writeSnapshot(UID, [["logs-key", { data: "value" }]], failingStorage)
    ).not.toThrow();
  });
});

describe("clearSnapshot", () => {
  it("should remove the stored cache so it does not stay on the device after logout", () => {
    writeSnapshot(UID, [["logs-key", { data: "value" }]], fake.storage);

    clearSnapshot(UID, fake.storage);

    expect(readSnapshot(UID, fake.storage)).toEqual([]);
  });
});
