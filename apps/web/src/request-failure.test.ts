import { describe, expect, it } from "vitest";

import { ApiError } from "@myprojecttemplate/api-client";
import { isAbortFailure, summarizeViolations, toRequestFailure } from "./request-failure";

describe("toRequestFailure", () => {
  it("keeps the server detail and request id for a 500 response", () => {
    const failure = toRequestFailure(
      new ApiError({ message: "Service Unavailable", status: 503, requestId: "gateway-request-0001" }),
    );

    expect(failure.kind).toBe("server");
    expect(failure.message).toBe("Service Unavailable");
    expect(failure.requestId).toBe("gateway-request-0001");
    expect(failure.retryable).toBe(true);
    expect(failure.requiresLogin).toBe(false);
  });

  it("asks for a new login only on 401", () => {
    const unauthorized = toRequestFailure(new ApiError({ message: "Unauthorized", status: 401 }));
    const forbidden = toRequestFailure(new ApiError({ message: "Forbidden", status: 403 }));

    expect(unauthorized.kind).toBe("unauthorized");
    expect(unauthorized.requiresLogin).toBe(true);
    expect(unauthorized.retryable).toBe(false);

    expect(forbidden.kind).toBe("forbidden");
    expect(forbidden.requiresLogin).toBe(false);
    expect(forbidden.retryable).toBe(false);
  });

  it("carries validation violations for a 400 response", () => {
    const failure = toRequestFailure(
      new ApiError({
        message: "Validation failed",
        status: 400,
        code: "validation_error",
        violations: [{ field: "name", message: "must not be blank" }],
      }),
    );

    expect(failure.kind).toBe("validation");
    expect(failure.code).toBe("validation_error");
    expect(failure.violations).toEqual([{ field: "name", message: "must not be blank" }]);
    expect(summarizeViolations(failure.violations)).toBe("name: must not be blank");
  });

  it.each([
    [404, "notFound"],
    [409, "conflict"],
    [429, "rateLimited"],
    [422, "validation"],
    [418, "unknown"],
  ])("maps status %i to the %s kind", (status, kind) => {
    expect(toRequestFailure(new ApiError({ message: "failed", status })).kind).toBe(kind);
  });

  it("treats a fetch TypeError as a Gateway connection failure", () => {
    const failure = toRequestFailure(new TypeError("Failed to fetch"));

    expect(failure.kind).toBe("network");
    expect(failure.title).toContain("Gateway");
    expect(failure.retryable).toBe(true);
    expect(failure.violations).toEqual([]);
  });

  it("falls back to a generic failure for unknown values", () => {
    const failure = toRequestFailure("boom");

    expect(failure.kind).toBe("unknown");
    expect(failure.message).toBe("알 수 없는 오류가 발생했습니다.");
  });

  it("uses the default message when the server sends an empty detail", () => {
    expect(toRequestFailure(new ApiError({ message: "", status: 500 })).message).toBe("서버 내부 오류가 발생했습니다.");
  });
});

describe("isAbortFailure", () => {
  it("detects an aborted request", () => {
    const controller = new AbortController();
    controller.abort();

    expect(isAbortFailure(controller.signal.reason)).toBe(true);
  });

  it("does not treat an API error as an abort", () => {
    expect(isAbortFailure(new ApiError({ message: "failed", status: 500 }))).toBe(false);
  });
});
