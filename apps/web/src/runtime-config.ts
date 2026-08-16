export type AppEnvironment = "local" | "dev" | "prod";

export type AuthRuntimeConfig =
  | { enabled: false }
  | {
      enabled: true;
      authority: string;
      clientId: string;
      scope: string;
      callbackPath: string;
      logoutCallbackPath: string;
      postLogoutPath: string;
    };

export interface RuntimeConfig {
  environment: AppEnvironment;
  apiBaseUrl: string;
  auth: AuthRuntimeConfig;
}

const ENVIRONMENTS = new Set<AppEnvironment>(["local", "dev", "prod"]);
const HTTP_PROTOCOLS = new Set(["http:", "https:"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateBaseUrl(value: unknown, environment: AppEnvironment): string {
  if (value === "") return "";
  if (typeof value !== "string") throw new Error("app-config.json의 apiBaseUrl은 문자열이어야 합니다.");

  if (value.startsWith("/")) return value.endsWith("/") ? value.slice(0, -1) : value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("app-config.json의 apiBaseUrl은 빈 값, /경로 또는 http(s) URL이어야 합니다.");
  }

  if (!HTTP_PROTOCOLS.has(url.protocol)) {
    throw new Error("app-config.json의 apiBaseUrl은 http 또는 https만 사용할 수 있습니다.");
  }
  if (url.username || url.password) {
    throw new Error("apiBaseUrl에 사용자 이름이나 비밀번호를 넣지 마세요.");
  }
  if (environment === "prod" && LOCAL_HOSTS.has(url.hostname)) {
    throw new Error("prod apiBaseUrl에는 localhost 주소를 사용할 수 없습니다.");
  }
  if (environment === "prod" && url.protocol !== "https:") {
    throw new Error("prod의 외부 apiBaseUrl은 https를 사용해야 합니다.");
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function validateAuthUrl(value: unknown, environment: AppEnvironment): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("auth.enabled=true이면 auth.authority가 필요합니다.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("auth.authority는 OIDC provider의 http(s) URL이어야 합니다.");
  }

  if (!HTTP_PROTOCOLS.has(url.protocol)) throw new Error("auth.authority는 http 또는 https만 사용할 수 있습니다.");
  if (url.username || url.password) throw new Error("auth.authority에 사용자 이름이나 비밀번호를 넣지 마세요.");
  if (url.search || url.hash) throw new Error("auth.authority에는 query string이나 fragment를 넣지 마세요.");
  if (environment === "prod" && LOCAL_HOSTS.has(url.hostname)) {
    throw new Error("prod auth.authority에는 localhost 주소를 사용할 수 없습니다.");
  }
  if (environment === "prod" && url.protocol !== "https:") {
    throw new Error("prod auth.authority는 https를 사용해야 합니다.");
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function validatePath(value: unknown, fallback: string, field: string): string {
  const path = value ?? fallback;
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("?") ||
    path.includes("#") ||
    path.includes("\\")
  ) {
    throw new Error(`${field}는 query나 fragment가 없는 같은 origin 절대 경로여야 합니다.`);
  }
  return path;
}

function validateAuthConfig(value: unknown, environment: AppEnvironment): AuthRuntimeConfig {
  if (value === undefined) return { enabled: false };
  if (!isRecord(value)) throw new Error("app-config.json의 auth는 JSON 객체여야 합니다.");
  if ("clientSecret" in value || "client_secret" in value) {
    throw new Error("브라우저 설정에 client secret을 넣지 마세요. SPA는 공개 OIDC client여야 합니다.");
  }
  if (typeof value.enabled !== "boolean") throw new Error("auth.enabled는 true 또는 false여야 합니다.");
  if (!value.enabled) return { enabled: false };

  if (typeof value.clientId !== "string" || value.clientId.length === 0) {
    throw new Error("auth.enabled=true이면 auth.clientId가 필요합니다.");
  }
  const scope = value.scope ?? "openid profile email";
  if (typeof scope !== "string" || !scope.split(/\s+/).includes("openid")) {
    throw new Error("auth.scope에는 openid가 포함되어야 합니다.");
  }

  return {
    enabled: true,
    authority: validateAuthUrl(value.authority, environment),
    clientId: value.clientId,
    scope,
    callbackPath: validatePath(value.callbackPath, "/oidc/callback", "auth.callbackPath"),
    logoutCallbackPath: validatePath(value.logoutCallbackPath, "/oidc/logout-callback", "auth.logoutCallbackPath"),
    postLogoutPath: validatePath(value.postLogoutPath, "/", "auth.postLogoutPath"),
  };
}

export function parseRuntimeConfig(value: unknown): RuntimeConfig {
  if (!isRecord(value)) throw new Error("app-config.json은 JSON 객체여야 합니다.");

  const environment = value.environment;
  if (typeof environment !== "string" || !ENVIRONMENTS.has(environment as AppEnvironment)) {
    throw new Error("app-config.json의 environment는 local, dev, prod 중 하나여야 합니다.");
  }

  const parsedEnvironment = environment as AppEnvironment;
  return {
    environment: parsedEnvironment,
    apiBaseUrl: validateBaseUrl(value.apiBaseUrl, parsedEnvironment),
    auth: validateAuthConfig(value.auth, parsedEnvironment),
  };
}

export async function loadRuntimeConfig(
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<RuntimeConfig> {
  const response = await fetchImpl("/app-config.json", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`app-config.json을 불러오지 못했습니다. HTTP ${response.status}`);
  }

  return parseRuntimeConfig(await response.json());
}
