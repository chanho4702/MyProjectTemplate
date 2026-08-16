export type AppEnvironment = "local" | "dev" | "prod";

export interface RuntimeConfig {
  environment: AppEnvironment;
  apiBaseUrl: string;
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

export function parseRuntimeConfig(value: unknown): RuntimeConfig {
  if (!isRecord(value)) throw new Error("app-config.json은 JSON 객체여야 합니다.");

  const environment = value.environment;
  if (typeof environment !== "string" || !ENVIRONMENTS.has(environment as AppEnvironment)) {
    throw new Error("app-config.json의 environment는 local, dev, prod 중 하나여야 합니다.");
  }

  return {
    environment: environment as AppEnvironment,
    apiBaseUrl: validateBaseUrl(value.apiBaseUrl, environment as AppEnvironment),
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
