import { useActionState, useCallback, useEffect, useState, useSyncExternalStore } from "react";

import type { ApiClient, Item } from "@myprojecttemplate/api-client";
import type { AuthClient, AuthSnapshot } from "./auth-client";
import { AccessNotice, EmptyState, FailureNotice, LoadingState } from "./feedback";
import type { RequestFailure } from "./request-failure";
import { isAbortFailure, toRequestFailure } from "./request-failure";
import type { RuntimeConfig } from "./runtime-config";

interface AppProps {
  apiClient: ApiClient;
  authClient: AuthClient;
  runtimeConfig: RuntimeConfig;
}

type ItemsState =
  | { status: "blocked"; items: Item[] }
  | { status: "loading"; items: Item[] }
  | { status: "ready"; items: Item[] }
  | { status: "error"; items: Item[]; failure: RequestFailure };

type CreateState =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "invalid"; message: string }
  | { kind: "failed"; failure: RequestFailure };

const INITIAL_CREATE_STATE: CreateState = { kind: "idle" };
const CONNECTION_NODES = [
  ["01", "브라우저", "현재 화면"],
  ["02", "Gateway", "/api"],
  ["03", "sample-service", ":8081"],
  ["04", "PostgreSQL", "writer / reader"],
] as const;
const ITEM_DATE_FORMAT = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });

function ConnectionPath({ active, failed, authRequired }: { active: boolean; failed: boolean; authRequired: boolean }) {
  const stateLabel = authRequired ? "로그인 필요" : failed ? "확인 필요" : active ? "요청 중" : "대기";

  return (
    <section className={`service-path ${active ? "is-active" : ""} ${failed ? "has-failure" : ""}`} aria-label="API 요청 경로">
      <div className="path-heading">
        <div>
          <p className="kicker">LIVE REQUEST PATH</p>
          <h2>요청이 지나가는 네 단계</h2>
        </div>
        <span className="path-state">{stateLabel}</span>
      </div>
      <div className="path-track" role="list">
        {CONNECTION_NODES.map(([code, title, detail]) => (
          <div className="path-node" role="listitem" key={code}>
            <span>{code}</span>
            <strong>{title}</strong>
            <small>{detail}</small>
          </div>
        ))}
        <span className="path-pulse" aria-hidden="true" />
      </div>
    </section>
  );
}

function AuthControl({ authClient, snapshot }: { authClient: AuthClient; snapshot: AuthSnapshot }) {
  if (snapshot.status === "disabled") return null;

  if (snapshot.status === "authenticated") {
    return (
      <div className="auth-control is-authenticated">
        <span>OIDC</span>
        <strong>{snapshot.displayName}</strong>
        <button type="button" onClick={() => void authClient.logout()}>로그아웃</button>
      </div>
    );
  }

  if (snapshot.status === "error") {
    return (
      <div className="auth-control is-error" role="alert" aria-label={`인증 오류: ${snapshot.message}`}>
        <span>AUTH</span>
        <strong>인증 확인 필요</strong>
        <button type="button" onClick={() => void authClient.login()}>다시 로그인</button>
      </div>
    );
  }

  return (
    <div className="auth-control">
      <span>OIDC</span>
      <strong>로그인 전</strong>
      <button type="button" onClick={() => void authClient.login()}>로그인</button>
    </div>
  );
}

function ItemList({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        symbol="＋"
        title="아직 저장된 항목이 없습니다."
        description="오른쪽 입력칸에서 첫 항목을 만들면 Gateway와 writer DB 흐름을 확인할 수 있습니다."
      />
    );
  }

  return (
    <ol className="item-list">
      {items.map((item, index) => (
        <li key={item.id}>
          <span className="item-index">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>{item.name}</strong>
            <small>{ITEM_DATE_FORMAT.format(new Date(item.createdAt))}</small>
          </div>
          <code>{item.id.slice(0, 8)}</code>
        </li>
      ))}
    </ol>
  );
}

function CreateItemForm({
  apiClient,
  onCreated,
  onLogin,
  authRequired,
}: {
  apiClient: ApiClient;
  onCreated: (item: Item) => void;
  onLogin: () => void;
  authRequired: boolean;
}) {
  const action = useCallback(
    async (_previous: CreateState, formData: FormData): Promise<CreateState> => {
      const name = String(formData.get("name") ?? "").trim();
      if (!name) return { kind: "invalid", message: "항목 이름을 입력하세요." };
      if (name.length > 120) return { kind: "invalid", message: "항목 이름은 120자 이하여야 합니다." };

      try {
        const item = await apiClient.createItem(name);
        onCreated(item);
        return { kind: "success", message: `${item.name} 항목을 writer DB에 저장했습니다.` };
      } catch (error) {
        return { kind: "failed", failure: toRequestFailure(error) };
      }
    },
    [apiClient, onCreated],
  );
  const [state, formAction, isPending] = useActionState(action, INITIAL_CREATE_STATE);
  const inlineMessage = state.kind === "success" || state.kind === "invalid" ? state.message : "";

  return (
    <form className="create-form" action={formAction}>
      <div className="form-heading">
        <div>
          <p className="kicker">WRITE CHECK</p>
          <h2>새 항목 만들기</h2>
        </div>
        <span>POST</span>
      </div>
      <label htmlFor="item-name">항목 이름</label>
      <input id="item-name" name="name" maxLength={120} placeholder="예: first-item" autoComplete="off" disabled={isPending || authRequired} />
      <button type="submit" disabled={isPending || authRequired}>
        <span>{authRequired ? "로그인 후 사용 가능" : isPending ? "저장 중" : "writer DB에 저장"}</span>
        <strong aria-hidden="true">→</strong>
      </button>
      <p className={`form-message is-${state.kind}`} aria-live="polite">{inlineMessage}</p>
      {state.kind === "failed" ? <FailureNotice failure={state.failure} onLogin={onLogin} /> : null}
      <p className="form-note">POST 요청은 reader가 아니라 항상 writer를 사용합니다.</p>
    </form>
  );
}

export function App({ apiClient, authClient, runtimeConfig }: AppProps) {
  const authSnapshot = useSyncExternalStore(authClient.subscribe, authClient.getSnapshot, authClient.getSnapshot);
  const canCallApi = authSnapshot.status === "disabled" || authSnapshot.status === "authenticated";
  const authRequired = !canCallApi;
  const [itemsState, setItemsState] = useState<ItemsState>(() =>
    canCallApi ? { status: "loading", items: [] } : { status: "blocked", items: [] },
  );

  const login = useCallback(() => void authClient.login(), [authClient]);

  const loadItems = useCallback(
    async (signal?: AbortSignal) => {
      setItemsState((current) => ({ status: "loading", items: current.items }));
      try {
        const items = await apiClient.listItems({ signal });
        setItemsState({ status: "ready", items });
      } catch (error) {
        if (signal?.aborted || isAbortFailure(error)) return;
        setItemsState((current) => ({ status: "error", items: current.items, failure: toRequestFailure(error) }));
      }
    },
    [apiClient],
  );

  useEffect(() => {
    if (!canCallApi) {
      setItemsState((current) => ({ status: "blocked", items: current.items }));
      return undefined;
    }
    const controller = new AbortController();
    void loadItems(controller.signal);
    return () => controller.abort();
  }, [canCallApi, loadItems]);

  const handleCreated = useCallback((item: Item) => {
    setItemsState((current) => ({ status: "ready", items: [item, ...current.items] }));
  }, []);

  const isLoading = itemsState.status === "loading";
  const hasFailure = itemsState.status === "error";

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="MyProjectTemplate Service Console 처음으로">
          <span className="brand-symbol" aria-hidden="true">M</span>
          <span><strong>MyProjectTemplate</strong><small>Service Console</small></span>
        </a>
        <div className="header-status">
          <div className="environment-badge">
            <span className={hasFailure ? "is-failed" : ""} aria-hidden="true" />
            {runtimeConfig.environment.toUpperCase()}
          </div>
          <AuthControl authClient={authClient} snapshot={authSnapshot} />
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="kicker">BACKEND CONNECTION FIELD GUIDE</p>
          <h1>서비스가 연결됐는지<br /><em>눈으로 확인하세요.</em></h1>
          <p>
            이 화면은 예쁜 샘플 데이터보다 연결 경계를 먼저 보여줍니다. 조회는 Gateway를 지나 read-only 경로로,
            생성은 writer DB로 향합니다.
          </p>
        </div>
        <aside className="hero-contract" aria-label="현재 API 계약">
          <span>API CONTRACT</span>
          <strong>GET /api/v1/items</strong>
          <strong>POST /api/v1/items</strong>
          <small>{runtimeConfig.apiBaseUrl || "same origin → Vite/Gateway"}</small>
        </aside>
      </section>

      <ConnectionPath active={isLoading} failed={hasFailure} authRequired={authRequired} />

      <div className="workspace-grid">
        <section className="items-panel" aria-busy={isLoading}>
          <div className="panel-heading">
            <div>
              <p className="kicker">READ CHECK</p>
              <h2>저장된 항목</h2>
            </div>
            <div className="panel-actions">
              <span>{itemsState.items.length} records</span>
              <button type="button" onClick={() => void loadItems()} disabled={isLoading}>
                {isLoading ? "불러오는 중" : "다시 불러오기"}
              </button>
            </div>
          </div>

          {authRequired ? <AccessNotice snapshot={authSnapshot} onLogin={login} /> : null}
          {!authRequired && hasFailure ? (
            <FailureNotice failure={itemsState.failure} onRetry={() => void loadItems()} onLogin={login} />
          ) : null}
          {!authRequired && isLoading && itemsState.items.length === 0 ? (
            <LoadingState label="Gateway에서 항목을 불러오고 있습니다." />
          ) : !authRequired ? (
            <ItemList items={itemsState.items} />
          ) : null}
        </section>

        <CreateItemForm apiClient={apiClient} onCreated={handleCreated} onLogin={login} authRequired={authRequired} />
      </div>

      <section className="recovery-guide">
        <p className="kicker">IF THE PATH BREAKS</p>
        <h2>연결이 안 되면 이 순서로 확인하세요.</h2>
        <ol>
          <li><span>01</span><div><strong>PostgreSQL</strong><code>docker compose ... ps</code></div></li>
          <li><span>02</span><div><strong>sample-service</strong><code>http://localhost:8081/actuator/health</code></div></li>
          <li><span>03</span><div><strong>Gateway</strong><code>http://localhost:8080/actuator/health</code></div></li>
          <li><span>04</span><div><strong>이 화면</strong><code>http://localhost:5173</code></div></li>
        </ol>
      </section>

      <footer>
        <p>현재 화면은 local 연결 검증용이며 특정 TPS나 운영 가용성을 보장하지 않습니다.</p>
        <a href="https://github.com/chanho4702/MyProjectTemplate">GitHub 문서 보기 ↗</a>
      </footer>
    </main>
  );
}
