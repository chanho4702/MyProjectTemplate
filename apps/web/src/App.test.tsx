import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "@myprojecttemplate/api-client";
import { ApiError } from "@myprojecttemplate/api-client";
import { App } from "./App";

const RUNTIME_CONFIG = { environment: "local" as const, apiBaseUrl: "" };

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

    render(<App apiClient={client} runtimeConfig={RUNTIME_CONFIG} />);

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

    render(<App apiClient={client} runtimeConfig={RUNTIME_CONFIG} />);

    await waitFor(() => expect(screen.getByText("요청을 완료하지 못했습니다.")).toBeTruthy());
    expect(screen.getByText(/gateway-request-0001/)).toBeTruthy();
    expect(screen.getByText("연결이 안 되면 이 순서로 확인하세요.")).toBeTruthy();
  });
});
