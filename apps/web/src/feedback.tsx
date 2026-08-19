import type { AuthSnapshot } from "./auth-client";
import type { RequestFailure } from "./request-failure";

/**
 * 로딩·빈 상태·오류·권한 안내를 한곳에 모은다. 새 화면을 추가할 때도
 * 같은 컴포넌트를 쓰면 상태별 문구와 접근성 role이 저절로 같아진다.
 */

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="loading-state" role="status">
      <span aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({ symbol, title, description }: { symbol: string; title: string; description: string }) {
  return (
    <div className="empty-state">
      <span aria-hidden="true">{symbol}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

/** 로그인 전이거나 인증 설정이 잘못돼 API를 아예 호출하지 않는 상태를 설명한다. */
export function AccessNotice({ snapshot, onLogin }: { snapshot: AuthSnapshot; onLogin: () => void }) {
  const hasAuthError = snapshot.status === "error";

  return (
    <div className="auth-required" role="status">
      <span aria-hidden="true">KEY</span>
      <h3>{hasAuthError ? "인증 설정을 확인해야 합니다." : "로그인하면 API 연결을 시작합니다."}</h3>
      <p>
        {hasAuthError
          ? snapshot.message
          : "상단의 로그인 버튼을 누르면 OIDC 제공자로 이동합니다. 비밀번호는 이 화면이나 저장소에 저장되지 않습니다."}
      </p>
      <div className="notice-actions">
        <button type="button" onClick={onLogin}>
          {hasAuthError ? "다시 로그인" : "로그인"}
        </button>
      </div>
    </div>
  );
}

export function FailureNotice({
  failure,
  onRetry,
  onLogin,
}: {
  failure: RequestFailure;
  onRetry?: () => void;
  onLogin?: () => void;
}) {
  const showLogin = failure.requiresLogin && Boolean(onLogin);
  const showRetry = failure.retryable && Boolean(onRetry);

  return (
    <div className={`error-notice is-${failure.kind}`} role="alert">
      <strong>{failure.title}</strong>
      <p>{failure.message}</p>
      <p className="notice-guidance">{failure.guidance}</p>
      {failure.violations.length > 0 ? (
        <ul className="notice-violations">
          {failure.violations.map((violation) => (
            <li key={`${violation.field}:${violation.message}`}>
              <code>{violation.field}</code>
              <span>{violation.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {failure.requestId ? <code className="notice-request-id">request ID · {failure.requestId}</code> : null}
      {showLogin || showRetry ? (
        <div className="notice-actions">
          {showLogin ? (
            <button type="button" onClick={onLogin}>
              다시 로그인
            </button>
          ) : null}
          {showRetry ? (
            <button type="button" onClick={onRetry}>
              다시 시도
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
