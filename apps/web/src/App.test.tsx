import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "@myprojecttemplate/api-client";
import { ApiError } from "@myprojecttemplate/api-client";
import { App } from "./App";
import type { AuthClient } from "./auth-client";

const RUNTIME_CONFIG = { environment: "local" as const, apiBaseUrl: "", auth: { enabled: false } as const };
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

    await waitFor(() => expect(screen.getByText("요청을 완료하지 못했습니다.")).toBeTruthy());
    expect(screen.getByText(/gateway-request-0001/)).toBeTruthy();
    expect(screen.getByText("연결이 안 되면 이 순서로 확인하세요.")).toBeTruthy();
  });

  it("waits for login instead of calling a protected API anonymously", async () => {
    const client = createClient();
    const login = vi.fn();
    const anonymousSnapshot = { status: "anonymous" } as const;
    const authClient: AuthClient = {
      getSnapshot: () => anonymousSnapshot,
      subscribe: () => () => undefined,
      login,
      logout: vi.fn(),
      getAccessToken: vi.fn(),
    };

    render(
      <App
        apiClient={client}
        authClient={authClient}
        runtimeConfig={{ ...RUNTIME_CONFIG, auth: { enabled: true, authority: "http://localhost:8180/realms/template", clientId: "template-spa", scope: "openid profile email", callbackPath: "/oidc/callback", logoutCallbackPath: "/oidc/logout-callback", postLogoutPath: "/" } }}
      />,
    );

    expect(screen.getByText("로그인하면 API 연결을 시작합니다.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "로그인" })).toBeTruthy();
    await waitFor(() => expect(client.listItems).not.toHaveBeenCalled());
  });
});
