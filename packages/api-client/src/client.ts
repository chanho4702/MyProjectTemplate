export interface Item {
  id: string;
  name: string;
  createdAt: string;
}
export interface ValidationViolation {
  field: string;
  message: string;
}

interface ProblemDetail {
  title?: unknown;
  detail?: unknown;
  code?: unknown;
  requestId?: unknown;
  violations?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly requestId: string | undefined;
  readonly violations: ValidationViolation[];

  constructor(options: {
    message: string;
    status: number;
    code?: string;
    requestId?: string;
    violations?: ValidationViolation[];
  }) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.violations = options.violations ?? [];
  }
}

export interface ApiClient {
  listItems(options?: { signal?: AbortSignal }): Promise<Item[]>;
  createItem(name: string, options?: { signal?: AbortSignal }): Promise<Item>;
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestIdFactory?: () => string;
}

const ITEM_PATH = "/api/v1/items";

function buildUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalizedBase}${path}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readViolations(value: unknown): ValidationViolation[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    const field = readString(candidate.field);
    const message = readString(candidate.message);
    return field && message ? [{ field, message }] : [];
  });
}

async function readProblem(response: Response): Promise<ProblemDetail> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("json")) return {};

  try {
    const value: unknown = await response.json();
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

async function expectJson<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;

  const problem = await readProblem(response);
  const requestId = readString(problem.requestId) ?? response.headers.get("x-request-id") ?? undefined;
  const detail = readString(problem.detail);
  const title = readString(problem.title);

  throw new ApiError({
    status: response.status,
    code: readString(problem.code),
    requestId,
    violations: readViolations(problem.violations),
    message: detail ?? title ?? `API request failed with status ${response.status}.`,
  });
}

function defaultRequestIdFactory(): string {
  return globalThis.crypto.randomUUID();
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const baseUrl = options.baseUrl ?? "";
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const requestIdFactory = options.requestIdFactory ?? defaultRequestIdFactory;

  return {
    async listItems(requestOptions) {
      const response = await fetchImpl(buildUrl(baseUrl, ITEM_PATH), {
        headers: { Accept: "application/json", "X-Request-Id": requestIdFactory() },
        signal: requestOptions?.signal,
      });
      return expectJson<Item[]>(response);
    },

    async createItem(name, requestOptions) {
      const response = await fetchImpl(buildUrl(baseUrl, ITEM_PATH), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Request-Id": requestIdFactory(),
        },
        body: JSON.stringify({ name }),
        signal: requestOptions?.signal,
      });
      return expectJson<Item>(response);
    },
  };
}
