import { describe, expect, it, vi } from "vitest";

// api.ts は Firebase SDK を読み込むため、初期化を避けてモックする
vi.mock("@/lib/firebase", () => ({ auth: {} }));

import { warmUpBackend } from "@/lib/api";

describe("warmUpBackend", () => {
  it("should request the health endpoint to start the backend cold start early", async () => {
    const fetcher = vi.fn().mockResolvedValue(undefined);

    warmUpBackend(fetcher);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    expect(fetcher.mock.calls[0][0]).toMatch(/\/health$/);
  });

  it("should not throw when the warm-up request fails", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("network error"));

    expect(() => warmUpBackend(fetcher)).not.toThrow();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  });
});
