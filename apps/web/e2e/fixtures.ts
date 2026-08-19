import { test as base } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

/**
 * Gateway 대신 브라우저 단계에서 응답을 돌려주는 stub이다. 백엔드를 띄우지 않아도
 * 로딩·빈 목록·오류·권한 화면을 실제 Chromium에서 그대로 재현할 수 있다.
 */

export interface StubItem {
  id: string;
  name: string;
  createdAt: string;
}

export interface ProblemOptions {
  status: number;
  detail: string;
  code?: string;
  requestId?: string;
  violations?: { field: string; message: string }[];
}

export type StubResponse =
  | { kind: "json"; status: number; contentType: string; body: unknown }
  | { kind: "unreachable" }
  | { kind: "hang" };

export const ITEMS_PATH = "**/api/v1/items";
export const CONFIG_PATH = "**/app-config.json";

export const AUTH_DISABLED_CONFIG = {
  environment: "local",
  apiBaseUrl: "",
  auth: { enabled: false },
} as const;

export const AUTH_ENABLED_CONFIG = {
  environment: "local",
  apiBaseUrl: "",
  auth: {
    enabled: true,
    authority: "http://localhost:8180/realms/template",
    clientId: "template-spa",
    scope: "openid profile email",
    callbackPath: "/oidc/callback",
    logoutCallbackPath: "/oidc/logout-callback",
    postLogoutPath: "/",
  },
} as const;

export function items(...values: StubItem[]): StubResponse {
  return { kind: "json", status: 200, contentType: "application/json", body: values };
}

export function created(value: StubItem): StubResponse {
  return { kind: "json", status: 201, contentType: "application/json", body: value };
}

export function problem(options: ProblemOptions): StubResponse {
  return {
    kind: "json",
    status: options.status,
    contentType: "application/problem+json",
    body: {
      title: "Request failed",
      status: options.status,
      detail: options.detail,
      code: options.code,
      requestId: options.requestId,
      violations: options.violations,
    },
  };
}

export function unreachable(): StubResponse {
  return { kind: "unreachable" };
}

export function hang(): StubResponse {
  return { kind: "hang" };
}

class ResponseQueue {
  private readonly queued: StubResponse[] = [];
  private fallback: StubResponse = problem({ status: 500, detail: "stub not configured" });

  set(...responses: StubResponse[]): void {
    this.queued.length = 0;
    if (responses.length === 0) return;
    this.queued.push(...responses.slice(0, -1));
    this.fallback = responses[responses.length - 1]!;
  }

  next(): StubResponse {
    return this.queued.shift() ?? this.fallback;
  }
}

export interface Gateway {
  /** 브라우저가 실제로 보낸 요청 목록. "GET /api/v1/items" 형태다. */
  readonly calls: string[];
  /** 브라우저가 보낸 마지막 생성 요청 본문. */
  readonly createdNames: string[];
  /** 첫 호출부터 순서대로 사용하고, 마지막 응답은 이후 호출에 반복 사용한다. */
  onList(...responses: StubResponse[]): void;
  onCreate(...responses: StubResponse[]): void;
  useRuntimeConfig(config: unknown): void;
}

async function fulfill(route: Route, response: StubResponse): Promise<void> {
  if (response.kind === "unreachable") {
    await route.abort("connectionrefused");
    return;
  }
  if (response.kind === "hang") {
    return;
  }
  await route.fulfill({
    status: response.status,
    contentType: response.contentType,
    body: JSON.stringify(response.body),
  });
}

async function installGateway(page: Page): Promise<Gateway> {
  const calls: string[] = [];
  const createdNames: string[] = [];
  const listQueue = new ResponseQueue();
  const createQueue = new ResponseQueue();
  let runtimeConfig: unknown = AUTH_DISABLED_CONFIG;

  listQueue.set(items());
  createQueue.set(problem({ status: 500, detail: "create stub not configured" }));

  await page.route(CONFIG_PATH, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(runtimeConfig),
    }),
  );

  await page.route(ITEMS_PATH, async (route) => {
    const request = route.request();
    const method = request.method();
    calls.push(`${method} ${new URL(request.url()).pathname}`);

    if (method === "POST") {
      const payload: unknown = request.postDataJSON();
      if (payload && typeof payload === "object" && "name" in payload) {
        createdNames.push(String((payload as { name: unknown }).name));
      }
      await fulfill(route, createQueue.next());
      return;
    }

    await fulfill(route, listQueue.next());
  });

  return {
    calls,
    createdNames,
    onList: (...responses) => listQueue.set(...responses),
    onCreate: (...responses) => createQueue.set(...responses),
    useRuntimeConfig: (config) => {
      runtimeConfig = config;
    },
  };
}

export const test = base.extend<{ gateway: Gateway }>({
  gateway: async ({ page }, use) => {
    await use(await installGateway(page));
  },
});

export { expect } from "@playwright/test";
