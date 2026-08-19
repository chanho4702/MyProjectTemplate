import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@myprojecttemplate/api-client";
import { AccessNotice, EmptyState, FailureNotice, LoadingState } from "./feedback";
import { toRequestFailure } from "./request-failure";

afterEach(cleanup);

describe("LoadingState", () => {
  it("announces the loading label through a status role", () => {
    render(<LoadingState label="Gateway에서 항목을 불러오고 있습니다." />);

    expect(screen.getByRole("status").textContent).toContain("Gateway에서 항목을 불러오고 있습니다.");
  });
});

describe("EmptyState", () => {
  it("explains what to do when the API succeeds with no rows", () => {
    render(<EmptyState symbol="+" title="아직 저장된 항목이 없습니다." description="첫 항목을 만드세요." />);

    expect(screen.getByRole("heading", { name: "아직 저장된 항목이 없습니다." })).toBeTruthy();
    expect(screen.getByText("첫 항목을 만드세요.")).toBeTruthy();
  });
});

describe("AccessNotice", () => {
  it("asks an anonymous visitor to log in", () => {
    const onLogin = vi.fn();
    render(<AccessNotice snapshot={{ status: "anonymous" }} onLogin={onLogin} />);

    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(onLogin).toHaveBeenCalled();
  });

  it("surfaces the auth client message when the OIDC setup itself failed", () => {
    render(<AccessNotice snapshot={{ status: "error", message: "issuer mismatch" }} onLogin={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "인증 설정을 확인해야 합니다." })).toBeTruthy();
    expect(screen.getByText("issuer mismatch")).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 로그인" })).toBeTruthy();
  });
});

describe("FailureNotice", () => {
  it("shows a retry action for a retryable failure", () => {
    const onRetry = vi.fn();
    render(<FailureNotice failure={toRequestFailure(new TypeError("Failed to fetch"))} onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows a login action instead of retry for a 401", () => {
    const onRetry = vi.fn();
    const onLogin = vi.fn();
    render(
      <FailureNotice
        failure={toRequestFailure(new ApiError({ message: "Unauthorized", status: 401 }))}
        onRetry={onRetry}
        onLogin={onLogin}
      />,
    );

    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다시 로그인" }));
    expect(onLogin).toHaveBeenCalled();
  });

  it("renders no action at all for a forbidden failure", () => {
    render(
      <FailureNotice
        failure={toRequestFailure(new ApiError({ message: "Forbidden", status: 403 }))}
        onRetry={vi.fn()}
        onLogin={vi.fn()}
      />,
    );

    expect(screen.getByText("이 작업을 수행할 권한이 없습니다.")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("lists every violation with its field name", () => {
    render(
      <FailureNotice
        failure={toRequestFailure(
          new ApiError({
            message: "Validation failed",
            status: 400,
            violations: [
              { field: "name", message: "must not be blank" },
              { field: "name", message: "size must be between 1 and 120" },
            ],
          }),
        )}
      />,
    );

    expect(screen.getByText("must not be blank")).toBeTruthy();
    expect(screen.getByText("size must be between 1 and 120")).toBeTruthy();
  });
});
