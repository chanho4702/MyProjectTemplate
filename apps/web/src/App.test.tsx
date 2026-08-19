import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "@myprojecttemplate/api-client";
import { ApiError } from "@myprojecttemplate/api-client";
import { App } from "./App";
import type { AuthClient, AuthSnapshot } from "./auth-client";

const RUNTIME_CONFIG = { environment: "local" as const, apiBaseUrl: "", auth: { enabled: false } as const };
const OIDC_RUNTIME_CONFIG = {
  ...RUNTIME_CONFIG,
  auth: {
    enabled: true,
    authority: "http://localhost:8180/realms/template",
    clientId: "template-spa",
    scope: "openid profile email",
    callbackPath: "/oidc/callback",
    logoutCallbackPath: "/oidc/logout-callback",
    postLogoutPath: "/",
  } as const,
};
const DISABLED_AUTH_SNAPSHOT = { status: "disabled" } as const;
const DISABLED_AUTH_CLIENT: AuthClient = {
  getSnapshot: () => DISABLED_AUTH_SNAPSHOT,
  subscribe: () => () => undefined,
  login: vi.fn(),
  logout: vi.fn(),
  getAccessToken: vi.fn(),
};

afterEach(cleanup);

function createClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    listItems: vi.fn().mockResolvedValue([]),
    createItem: vi.fn(),
    ...overrides,
  };
}

function createAuthClient(snapshot: AuthSnapshot, login = vi.fn()): AuthClient {
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    login,
    logout: vi.fn(),
    getAccessToken: vi.fn(),
  };
}

describe("App", () => {
  it("renders items returned through the Gateway client", async () => {
    const client = createClient({
      listItems: vi.fn().mockResolvedValue([
        { id: "0d1758c1-5a47-4bc3-84cb-f1887bcfa734", name: "first-item", createdAt: "2026-08-16T00:00:00Z" },
      ]),
    });

    render(<App apiClient={client} authClient={DISABLED_AUTH_CLIENT} runtimeConfig={RUNTIME_CONFIG} />);

    expect(screen.getByText("Gateway에서 항목을 불러오고 있습니다.")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("first-item")).toBeTruthy());
    expect(client.listItems).toHaveBeenCalled();
  });

  it("shows a recovery direction and request id when the API fails", async () => {
    const client = createClient({
      listItems: vi.fn().mockRejectedValue(
        new ApiError({ message: "Service Unavailable", status: 503, requestId: "gateway-request-0001" }),
      ),
    });

    render(<App apiClient={client} authClient={DISABLED_AUTH_CLIENT} runtimeConfig={RUNTIME_CONFIG} />);

    await waitFor(() => expect(screen.getByText("서버가 요청을 처리하지 못했습니다.")).toBeTruthy());
    expect(screen.getByText(/gateway-request-0001/)).toBeTruthy();
    expect(screen.getByText("연결이 안 되면 이 순서로 확인하세요.")).toBeTruthy();
  });

  it("retries the same request from the failure notice", async () => {
    const listItems = vi
      .fn()
      .mockRejectedValueOnce(new ApiError({ message: "Service Unavailable", status: 503 }))
      .mockResolvedValueOnce([
        { id: "1f1758c1-5a47-4bc3-84cb-f1887bcfa734", name: "recovered-item", createdAt: "2026-08-16T00:00:00Z" },
      ]);

    render(<App apiClient={createClient({ listItems })} authClient={DISABLED_AUTH_CLIENT} runtimeConfig={RUNTIME_CONFIG} />);

    const retry = await screen.findByRole("button", { name: "다시 시도" });
    fireEvent.click(retry);

    await waitFor(() => expect(screen.getByText("recovered-item")).toBeTruthy());
    expect(listItems).toHaveBeenCalledTimes(2);
  });

  it("offers a new login when an authenticated session gets a 401", async () => {
    const login = vi.fn();
    const client = createClient({
      listItems: vi.fn().mockRejectedValue(new ApiError({ message: "Unauthorized", status: 401 })),
    });

    render(
      <App
        apiClient={client}
        authClient={createAuthClient({ status: "authenticated", displayName: "tester" }, login)}
        runtimeConfig={OIDC_RUNTIME_CONFIG}
      />,
    );

    const relogin = await screen.findByRole("button", { name: "다시 로그인" });
    expect(screen.getByText("인증이 만료되었거나 유효하지 않습니다.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();

    fireEvent.click(relogin);
    expect(login).toHaveBeenCalled();
  });

  it("shows the field level violations returned by a rejected create request", async () => {
    const client = createClient({
      createItem: vi.fn().mockRejectedValue(
        new ApiError({
          message: "Request validation failed",
          status: 400,
          requestId: "gateway-request-0002",
          violations: [{ field: "name", message: "must not be blank" }],
        }),
      ),
    });

    render(<App apiClient={client} authClient={DISABLED_AUTH_CLIENT} runtimeConfig={RUNTIME_CONFIG} />);

    fireEvent.change(screen.getByLabelText("항목 이름"), { target: { value: "duplicated-item" } });
    fireEvent.click(screen.getByRole("button", { name: /writer DB에 저장/ }));

    await waitFor(() => expect(screen.getByText("입력값을 확인해야 합니다.")).toBeTruthy());
    expect(screen.getByText("must not be blank")).toBeTruthy();
    expect(screen.getByText(/gateway-request-0002/)).toBeTruthy();
  });

  it("keeps client side validation inline instead of showing a request failure", async () => {
    const client = createClient();

    render(<App apiClient={client} authClient={DISABLED_AUTH_CLIENT} runtimeConfig={RUNTIME_CONFIG} />);

    fireEvent.click(screen.getByRole("button", { name: /writer DB에 저장/ }));

    await waitFor(() => expect(screen.getByText("항목 이름을 입력하세요.")).toBeTruthy());
    expect(client.createItem).not.toHaveBeenCalled();
  });

  it("waits for login instead of calling a protected API anonymously", async () => {
    const client = createClient();
    const login = vi.fn();

    render(
      <App
        apiClient={client}
        authClient={createAuthClient({ status: "anonymous" }, login)}
        runtimeConfig={OIDC_RUNTIME_CONFIG}
      />,
    );

    expect(screen.getByText("로그인하면 API 연결을 시작합니다.")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "로그인" })[0]!);
    expect(login).toHaveBeenCalled();
    await waitFor(() => expect(client.listItems).not.toHaveBeenCalled());
  });
});
