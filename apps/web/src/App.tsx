import { useActionState, useCallback, useEffect, useState } from "react";

import type { ApiClient, Item } from "@myprojecttemplate/api-client";
import { ApiError } from "@myprojecttemplate/api-client";
import type { RuntimeConfig } from "./runtime-config";

interface AppProps {
  apiClient: ApiClient;
  runtimeConfig: RuntimeConfig;
}

type ItemsState =
  | { status: "loading"; items: Item[] }
  | { status: "ready"; items: Item[] }
  | { status: "error"; items: Item[]; error: DisplayError };

interface DisplayError {
  message: string;
  requestId?: string;
}

interface CreateState {
  kind: "idle" | "success" | "error";
  message: string;
  requestId?: string;
}

const INITIAL_CREATE_STATE: CreateState = { kind: "idle", message: "" };
const CONNECTION_NODES = [
  ["01", "브라우저", "현재 화면"],
  ["02", "Gateway", "/api"],
  ["03", "sample-service", ":8081"],
  ["04", "PostgreSQL", "writer / reader"],
] as const;
const ITEM_DATE_FORMAT = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });

function toDisplayError(error: unknown): DisplayError {
  if (error instanceof ApiError) {
    return { message: error.message, requestId: error.requestId };
  }
  if (error instanceof TypeError) {
    return { message: "Gateway에 연결하지 못했습니다. Gateway와 sample-service가 실행 중인지 확인하세요." };
  }
  return { message: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다." };
}

function ConnectionPath({ active, failed }: { active: boolean; failed: boolean }) {
  const stateLabel = failed ? "확인 필요" : active ? "요청 중" : "대기";

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

function ErrorNotice({ error }: { error: DisplayError }) {
  return (
    <div className="error-notice" role="alert">
      <strong>요청을 완료하지 못했습니다.</strong>
      <p>{error.message}</p>
      {error.requestId ? <code>request ID · {error.requestId}</code> : null}
    </div>
  );
}

function ItemList({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <span aria-hidden="true">＋</span>
        <h3>아직 저장된 항목이 없습니다.</h3>
        <p>오른쪽 입력칸에서 첫 항목을 만들면 Gateway와 writer DB 흐름을 확인할 수 있습니다.</p>
      </div>
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

function CreateItemForm({ apiClient, onCreated }: { apiClient: ApiClient; onCreated: (item: Item) => void }) {
  const action = useCallback(
    async (_previous: CreateState, formData: FormData): Promise<CreateState> => {
      const name = String(formData.get("name") ?? "").trim();
      if (!name) return { kind: "error", message: "항목 이름을 입력하세요." };
      if (name.length > 120) return { kind: "error", message: "항목 이름은 120자 이하여야 합니다." };

      try {
        const item = await apiClient.createItem(name);
        onCreated(item);
        return { kind: "success", message: `‘${item.name}’을 writer DB에 저장했습니다.` };
      } catch (error) {
        const displayError = toDisplayError(error);
        return { kind: "error", ...displayError };
      }
    },
    [apiClient, onCreated],
  );
  const [state, formAction, isPending] = useActionState(action, INITIAL_CREATE_STATE);

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
      <input id="item-name" name="name" maxLength={120} placeholder="예: first-item" autoComplete="off" disabled={isPending} />
      <button type="submit" disabled={isPending}>
        <span>{isPending ? "저장 중" : "writer DB에 저장"}</span>
        <strong aria-hidden="true">→</strong>
      </button>
      <p className={`form-message is-${state.kind}`} aria-live="polite">
        {state.message}
        {state.requestId ? <code> · {state.requestId}</code> : null}
      </p>
      <p className="form-note">POST 요청은 reader가 아니라 항상 writer를 사용합니다.</p>
    </form>
  );
}

export function App({ apiClient, runtimeConfig }: AppProps) {
  const [itemsState, setItemsState] = useState<ItemsState>({ status: "loading", items: [] });

  const loadItems = useCallback(
    async (signal?: AbortSignal) => {
      setItemsState((current) => ({ status: "loading", items: current.items }));
      try {
        const items = await apiClient.listItems({ signal });
        setItemsState({ status: "ready", items });
      } catch (error) {
        if (signal?.aborted) return;
        setItemsState((current) => ({ status: "error", items: current.items, error: toDisplayError(error) }));
      }
    },
    [apiClient],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadItems(controller.signal);
    return () => controller.abort();
  }, [loadItems]);

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
        <div className="environment-badge">
          <span className={hasFailure ? "is-failed" : ""} aria-hidden="true" />
          {runtimeConfig.environment.toUpperCase()}
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

      <ConnectionPath active={isLoading} failed={hasFailure} />

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

          {hasFailure ? <ErrorNotice error={itemsState.error} /> : null}
          {isLoading && itemsState.items.length === 0 ? (
            <div className="loading-state" role="status">
              <span aria-hidden="true" />
              <p>Gateway에서 항목을 불러오고 있습니다.</p>
            </div>
          ) : (
            <ItemList items={itemsState.items} />
          )}
        </section>

        <CreateItemForm apiClient={apiClient} onCreated={handleCreated} />
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
