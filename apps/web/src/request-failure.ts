import { ApiError } from "@myprojecttemplate/api-client";
import type { ValidationViolation } from "@myprojecttemplate/api-client";

/**
 * 화면 전체가 공유하는 실패 분류다. 어떤 화면에서 실패했는지와 무관하게
 * 같은 상태 코드는 같은 안내 문구와 같은 다음 행동으로 이어진다.
 */
export type RequestFailureKind =
  | "network"
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "validation"
  | "conflict"
  | "rateLimited"
  | "server"
  | "unknown";

export interface RequestFailure {
  kind: RequestFailureKind;
  /** 화면 상단에 굵게 표시하는 한 줄 요약. */
  title: string;
  /** 서버가 준 detail 또는 기본 문구. */
  message: string;
  /** 사용자가 지금 할 수 있는 다음 행동. */
  guidance: string;
  status?: number;
  code?: string;
  requestId?: string;
  violations: ValidationViolation[];
  /** 같은 요청을 다시 시도하는 것이 의미 있는 실패인지. */
  retryable: boolean;
  /** 다시 로그인해야 해결되는 실패인지. */
  requiresLogin: boolean;
}

interface FailureShape {
  kind: RequestFailureKind;
  title: string;
  guidance: string;
  retryable: boolean;
  requiresLogin: boolean;
}

const NETWORK_SHAPE: FailureShape = {
  kind: "network",
  title: "Gateway에 연결하지 못했습니다.",
  guidance: "Gateway와 sample-service가 실행 중인지 확인한 뒤 다시 불러오세요.",
  retryable: true,
  requiresLogin: false,
};

const UNKNOWN_SHAPE: FailureShape = {
  kind: "unknown",
  title: "요청을 완료하지 못했습니다.",
  guidance: "잠시 뒤 다시 시도하고, 반복되면 request ID로 서버 로그를 확인하세요.",
  retryable: true,
  requiresLogin: false,
};

const STATUS_SHAPES: ReadonlyArray<readonly [(status: number) => boolean, FailureShape]> = [
  [
    (status) => status === 401,
    {
      kind: "unauthorized",
      title: "인증이 만료되었거나 유효하지 않습니다.",
      guidance: "다시 로그인한 뒤 요청하세요. 반복되면 Gateway issuer와 프론트 authority가 같은 realm인지 확인하세요.",
      retryable: false,
      requiresLogin: true,
    },
  ],
  [
    (status) => status === 403,
    {
      kind: "forbidden",
      title: "이 작업을 수행할 권한이 없습니다.",
      guidance: "현재 계정의 역할로는 접근할 수 없습니다. 필요한 권한을 관리자에게 요청하세요.",
      retryable: false,
      requiresLogin: false,
    },
  ],
  [
    (status) => status === 404,
    {
      kind: "notFound",
      title: "대상을 찾지 못했습니다.",
      guidance: "이미 삭제되었거나 경로가 바뀌었을 수 있습니다. 목록을 다시 불러오세요.",
      retryable: true,
      requiresLogin: false,
    },
  ],
  [
    (status) => status === 409,
    {
      kind: "conflict",
      title: "다른 변경과 충돌했습니다.",
      guidance: "최신 상태를 다시 불러온 뒤 같은 작업을 반복하세요.",
      retryable: true,
      requiresLogin: false,
    },
  ],
  [
    (status) => status === 429,
    {
      kind: "rateLimited",
      title: "요청이 너무 많습니다.",
      guidance: "잠시 기다린 뒤 다시 시도하세요.",
      retryable: true,
      requiresLogin: false,
    },
  ],
  [
    (status) => status === 400 || status === 422,
    {
      kind: "validation",
      title: "입력값을 확인해야 합니다.",
      guidance: "표시된 항목을 수정한 뒤 다시 저장하세요.",
      retryable: false,
      requiresLogin: false,
    },
  ],
  [
    (status) => status >= 500,
    {
      kind: "server",
      title: "서버가 요청을 처리하지 못했습니다.",
      guidance: "sample-service와 Gateway health를 확인하고, request ID로 서버 로그를 검색하세요.",
      retryable: true,
      requiresLogin: false,
    },
  ],
];

const DEFAULT_MESSAGES: Readonly<Record<RequestFailureKind, string>> = {
  network: "네트워크 요청이 Gateway에 도달하지 못했습니다.",
  unauthorized: "인증 정보가 없거나 만료되었습니다.",
  forbidden: "요청한 리소스에 접근할 수 없습니다.",
  notFound: "요청한 리소스가 존재하지 않습니다.",
  validation: "요청 값이 API 계약을 만족하지 않습니다.",
  conflict: "현재 리소스 상태와 요청이 충돌합니다.",
  rateLimited: "허용된 요청 빈도를 넘었습니다.",
  server: "서버 내부 오류가 발생했습니다.",
  unknown: "알 수 없는 오류가 발생했습니다.",
};

function shapeForStatus(status: number): FailureShape {
  const matched = STATUS_SHAPES.find(([matches]) => matches(status));
  return matched ? matched[1] : UNKNOWN_SHAPE;
}

/** 사용자가 화면을 떠나거나 요청을 취소해 발생한 중단인지 판별한다. */
export function isAbortFailure(error: unknown): boolean {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) return error.name === "AbortError";
  return error instanceof Error && error.name === "AbortError";
}

/** 모든 실패를 화면이 그대로 그릴 수 있는 하나의 형태로 정규화한다. */
export function toRequestFailure(error: unknown): RequestFailure {
  if (error instanceof ApiError) {
    const shape = shapeForStatus(error.status);
    return {
      ...shape,
      message: error.message.length > 0 ? error.message : DEFAULT_MESSAGES[shape.kind],
      status: error.status,
      code: error.code,
      requestId: error.requestId,
      violations: error.violations,
    };
  }

  if (error instanceof TypeError) {
    return { ...NETWORK_SHAPE, message: DEFAULT_MESSAGES.network, violations: [] };
  }

  const message = error instanceof Error && error.message.length > 0 ? error.message : DEFAULT_MESSAGES.unknown;
  return { ...UNKNOWN_SHAPE, message, violations: [] };
}

/** 폼 하단 한 줄에 넣을 수 있도록 violation 목록을 축약한다. */
export function summarizeViolations(violations: readonly ValidationViolation[]): string {
  return violations.map((violation) => `${violation.field}: ${violation.message}`).join(" · ");
}
