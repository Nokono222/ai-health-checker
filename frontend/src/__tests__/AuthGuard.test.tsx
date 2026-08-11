import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockReplace, mockUseAuth } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockUseAuth: vi.fn(),
}));

// 認証状態とルーターは外部境界のためモックする
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import { AuthGuard } from "@/components/AuthGuard";

const PROTECTED_TEXT = "ダッシュボード";

function renderGuard() {
  return render(
    <AuthGuard>
      <p>{PROTECTED_TEXT}</p>
    </AuthGuard>
  );
}

describe("AuthGuard", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("should show a loading placeholder instead of a blank screen while auth is resolving", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });

    renderGuard();

    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.queryByText(PROTECTED_TEXT)).toBeNull();
  });

  it("should render children when the user is authenticated", () => {
    mockUseAuth.mockReturnValue({ user: { uid: "user-1" }, loading: false });

    renderGuard();

    expect(screen.getByText(PROTECTED_TEXT)).toBeDefined();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("should render children immediately while auth is resolving when renderWhileResolving is set", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });

    render(
      <AuthGuard renderWhileResolving>
        <p>{PROTECTED_TEXT}</p>
      </AuthGuard>
    );

    expect(screen.getByText(PROTECTED_TEXT)).toBeDefined();
  });

  it("should redirect to the login page when the user is not authenticated", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    renderGuard();

    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(screen.queryByText(PROTECTED_TEXT)).toBeNull();
  });
});
