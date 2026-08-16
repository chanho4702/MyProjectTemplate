"use client";

import { useMemo, useState } from "react";

type DeploymentTarget = "vm" | "kubernetes" | "managed-container";
type Availability = "99" | "99.9" | "99.95" | "99.99";
type EnvironmentName = "local" | "dev" | "prod";
type FrontendMode = "none" | "spa" | "ssr";
type BooleanFeature = "redis" | "kafka" | "elasticsearch" | "oidc" | "observability";

interface TemplateConfig {
  $schema: string;
  project: {
    name: string;
    basePackage: string;
  };
  runtime: {
    java: 21;
    springBoot: string;
    deploymentTarget: DeploymentTarget;
  };
  capacity: {
    targetTps: number;
    availabilityTarget: Availability;
    peakConcurrency: number;
  };
  frontend: {
    mode: FrontendMode;
  };
  features: {
    database: "postgresql";
    readWriteSplit: boolean;
    redis: boolean;
    kafka: boolean;
    elasticsearch: boolean;
    oidc: boolean;
    observability: boolean;
  };
  environments: EnvironmentName[];
}

const INITIAL_CONFIG: TemplateConfig = {
  $schema: "./config/template-config.schema.json",
  project: { name: "acme-platform", basePackage: "com.acme.platform" },
  runtime: { java: 21, springBoot: "3.5.16", deploymentTarget: "kubernetes" },
  capacity: { targetTps: 300, availabilityTarget: "99.9", peakConcurrency: 500 },
  frontend: { mode: "spa" },
  features: {
    database: "postgresql",
    readWriteSplit: true,
    redis: true,
    kafka: true,
    elasticsearch: false,
    oidc: true,
    observability: true,
  },
  environments: ["local", "dev", "prod"],
};

const FEATURE_CATALOG: Array<{
  key: BooleanFeature;
  title: string;
  label: string;
  description: string;
}> = [
  { key: "redis", title: "Redis", label: "캐시 · TTL · 멱등성", description: "반복 조회와 짧은 수명의 조정 데이터를 빠르게 처리합니다." },
  { key: "kafka", title: "Kafka", label: "비동기 도메인 이벤트", description: "서비스 간 결합도를 낮추고 durable event 흐름을 만듭니다." },
  { key: "elasticsearch", title: "Elasticsearch", label: "전문 검색 · 색인", description: "원본 DB와 분리된 검색 전용 read model을 구성합니다." },
  { key: "oidc", title: "OIDC", label: "표준 JWT 인증", description: "Keycloak 또는 관리형 IdP로 교체 가능한 인증 경계입니다." },
  { key: "observability", title: "Observability", label: "metrics · traces · logs", description: "용량과 장애 원인을 숫자로 확인하기 위한 필수 계측입니다." },
];

const ENVIRONMENTS: Array<{ key: EnvironmentName; title: string; note: string }> = [
  { key: "local", title: "Local", note: "Compose와 개발용 자격증명" },
  { key: "dev", title: "Dev", note: "팀 통합과 QA용 격리 환경" },
  { key: "prod", title: "Prod", note: "불변 이미지와 외부 Secret" },
];

const FRONTEND_MODES: Array<{ key: FrontendMode; title: string; note: string }> = [
  { key: "none", title: "프론트 없음", note: "API와 Gateway만 구성" },
  { key: "spa", title: "React SPA", note: "현재 제공되는 apps/web" },
  { key: "ssr", title: "SSR", note: "SEO 요구가 있을 때 후속 adapter" },
];

function deriveRecommendation(config: TemplateConfig) {
  const tps = config.capacity.targetTps;
  const strictAvailability = ["99.95", "99.99"].includes(config.capacity.availabilityTarget);
  const replicas = config.capacity.availabilityTarget === "99" ? 1 : strictAvailability ? 3 : 2;
  const vcpu = tps > 1500 ? 4 : tps > 300 ? 2 : 1;
  const profiles = [
    config.features.readWriteSplit ? "database-ha" : null,
    config.features.redis ? "cache" : null,
    config.features.kafka ? "messaging" : null,
    config.features.elasticsearch ? "search" : null,
    config.features.oidc ? "identity" : null,
    config.features.observability ? "observability" : null,
  ].filter((profile): profile is string => Boolean(profile));
  const profileArgs = profiles.map((profile) => `--profile ${profile}`).join(" ");
  const composeCommand = `docker compose --env-file infra/.env.versions -f infra/compose.yml ${profileArgs} up -d`.replace(/\s+/g, " ");

  const warnings: string[] = [];
  if (tps >= 1000) warnings.push("1,000 TPS 이상은 DB query mix와 데이터 크기를 반영한 단계 상승 테스트가 필요합니다.");
  if (config.capacity.availabilityTarget === "99.99") warnings.push("99.99%는 multi-AZ만으로 보장되지 않습니다. 배포·복구·의존 서비스 error budget을 함께 설계하세요.");
  if (config.features.readWriteSplit) warnings.push("reader는 eventual consistency입니다. 쓰기 직후 최신 조회와 금액·재고 판정은 writer를 사용하세요.");
  if (!config.features.observability) warnings.push("관측성을 끄면 처리 한계와 장애 원인을 인증할 수 없습니다. 운영계에서는 켜는 것을 권장합니다.");
  if (config.runtime.deploymentTarget === "vm" && strictAvailability) warnings.push("높은 가용성 목표에서 VM 배포를 선택하면 LB, 장애 감지, 자동 복구를 별도로 구현해야 합니다.");
  if (config.frontend.mode === "ssr") warnings.push("SSR adapter는 아직 생성되지 않습니다. 실제 SEO와 서버 렌더 요구를 확인한 뒤 별도 구현하세요.");

  return {
    replicas,
    vcpu,
    profiles,
    composeCommand,
    databaseLabel: config.features.readWriteSplit ? "Writer + reader endpoint" : "Single writer",
    warnings,
  };
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? "is-on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    >
      <span className="toggle-knob" />
    </button>
  );
}

export function Configurator() {
  const [config, setConfig] = useState<TemplateConfig>(INITIAL_CONFIG);
  const [notice, setNotice] = useState("");
  const recommendation = useMemo(() => deriveRecommendation(config), [config]);
  const configJson = useMemo(() => JSON.stringify(config, null, 2), [config]);

  const setBooleanFeature = (key: BooleanFeature, value: boolean) => {
    setConfig((current) => ({ ...current, features: { ...current.features, [key]: value } }));
  };

  const toggleEnvironment = (environment: EnvironmentName) => {
    setConfig((current) => {
      const exists = current.environments.includes(environment);
      if (exists && current.environments.length === 1) return current;
      const environments = exists
        ? current.environments.filter((item) => item !== environment)
        : [...current.environments, environment];
      return { ...current, environments };
    });
  };

  const downloadConfig = () => {
    const blob = new Blob([configJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "template-config.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("template-config.json을 내려받았습니다.");
  };

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(recommendation.composeCommand);
      setNotice("로컬 인프라 명령을 복사했습니다.");
    } catch {
      setNotice("복사할 수 없습니다. 명령을 직접 선택해 주세요.");
    }
  };

  return (
    <main className="workbench">
      <header className="masthead">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden>MP</span>
          <div>
            <p className="eyebrow">MSA PLATFORM TEMPLATE</p>
            <p className="brand-name">Architecture Console</p>
          </div>
        </div>
        <div className="baseline">
          <span>BASELINE</span>
          <strong>Java 21 · Boot 3.5</strong>
        </div>
      </header>

      <section className="intro">
        <div>
          <p className="section-code">CONFIGURATION / 01</p>
          <h1>필요한 만큼만<br /><em>조립하세요.</em></h1>
        </div>
        <p className="intro-copy">
          목표 부하와 운영 조건을 입력하면 필요한 데이터 계층과 실행 profile을 계산합니다.
          표시되는 사양은 출발점이며, 최종 처리량은 같은 저장소의 부하 테스트로 인증합니다.
        </p>
      </section>

      <div className="console-grid">
        <form className="control-panel" onSubmit={(event) => event.preventDefault()}>
          <fieldset className="control-section identity-section">
            <legend><span>01</span> 프로젝트 식별자</legend>
            <div className="field-grid">
              <label>
                <span>프로젝트 이름</span>
                <input
                  value={config.project.name}
                  pattern="[a-z][a-z0-9-]{2,39}"
                  onChange={(event) => setConfig((current) => ({ ...current, project: { ...current.project, name: event.target.value } }))}
                />
                <small>kebab-case · 이미지와 리소스 prefix</small>
              </label>
              <label>
                <span>기본 패키지</span>
                <input
                  value={config.project.basePackage}
                  onChange={(event) => setConfig((current) => ({ ...current, project: { ...current.project, basePackage: event.target.value } }))}
                />
                <small>예: com.company.platform</small>
              </label>
            </div>
          </fieldset>

          <fieldset className="control-section">
            <legend><span>02</span> 처리량과 가용성</legend>
            <div className="capacity-grid">
              <label className="range-field">
                <span>목표 TPS <output>{config.capacity.targetTps.toLocaleString()}</output></span>
                <input
                  type="range"
                  min="10"
                  max="5000"
                  step="10"
                  value={Math.min(config.capacity.targetTps, 5000)}
                  onChange={(event) => setConfig((current) => ({ ...current, capacity: { ...current.capacity, targetTps: Number(event.target.value) } }))}
                />
                <small>보장값이 아닌 부하 시험 목표</small>
              </label>
              <label>
                <span>Peak 동시 요청</span>
                <input
                  type="number"
                  min="1"
                  max="10000000"
                  value={config.capacity.peakConcurrency}
                  onChange={(event) => setConfig((current) => ({ ...current, capacity: { ...current.capacity, peakConcurrency: Number(event.target.value) } }))}
                />
              </label>
              <label>
                <span>가용성 목표</span>
                <select
                  value={config.capacity.availabilityTarget}
                  onChange={(event) => setConfig((current) => ({ ...current, capacity: { ...current.capacity, availabilityTarget: event.target.value as Availability } }))}
                >
                  <option value="99">99% · 개발/내부 도구</option>
                  <option value="99.9">99.9% · 일반 서비스</option>
                  <option value="99.95">99.95% · 중요 서비스</option>
                  <option value="99.99">99.99% · 별도 검증 필수</option>
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset className="control-section">
            <legend><span>03</span> 데이터와 플랫폼 기능</legend>
            <article className="database-card">
              <div>
                <p className="feature-title">PostgreSQL</p>
                <p>기본 영속 저장소 · Flyway · connection pool</p>
              </div>
              <div className="split-control">
                <span>읽기/쓰기 분리</span>
                <Toggle
                  checked={config.features.readWriteSplit}
                  label="PostgreSQL 읽기 쓰기 분리"
                  onChange={() => setConfig((current) => ({ ...current, features: { ...current.features, readWriteSplit: !current.features.readWriteSplit } }))}
                />
              </div>
            </article>
            <div className="feature-grid">
              {FEATURE_CATALOG.map((feature) => (
                <article className={`feature-card ${config.features[feature.key] ? "is-selected" : ""}`} key={feature.key}>
                  <div className="feature-card-head">
                    <div>
                      <p className="feature-title">{feature.title}</p>
                      <p className="feature-label">{feature.label}</p>
                    </div>
                    <Toggle
                      checked={config.features[feature.key]}
                      label={`${feature.title} 사용`}
                      onChange={() => setBooleanFeature(feature.key, !config.features[feature.key])}
                    />
                  </div>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </fieldset>

          <fieldset className="control-section">
            <legend><span>04</span> 서비스 프론트엔드</legend>
            <div className="frontend-options">
              {FRONTEND_MODES.map((mode) => (
                <label className={config.frontend.mode === mode.key ? "is-selected" : ""} key={mode.key}>
                  <input
                    type="radio"
                    name="frontend"
                    value={mode.key}
                    checked={config.frontend.mode === mode.key}
                    onChange={() => setConfig((current) => ({ ...current, frontend: { mode: mode.key } }))}
                  />
                  <span><strong>{mode.title}</strong>{mode.note}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="control-section">
            <legend><span>05</span> 배포와 환경</legend>
            <div className="deployment-options">
              {([
                ["vm", "VM / 단일 클러스터"],
                ["managed-container", "관리형 Container"],
                ["kubernetes", "Kubernetes"],
              ] as Array<[DeploymentTarget, string]>).map(([value, label]) => (
                <label className={config.runtime.deploymentTarget === value ? "is-selected" : ""} key={value}>
                  <input
                    type="radio"
                    name="deployment"
                    value={value}
                    checked={config.runtime.deploymentTarget === value}
                    onChange={() => setConfig((current) => ({ ...current, runtime: { ...current.runtime, deploymentTarget: value } }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="environment-row">
              {ENVIRONMENTS.map((environment) => (
                <label key={environment.key}>
                  <input
                    type="checkbox"
                    checked={config.environments.includes(environment.key)}
                    onChange={() => toggleEnvironment(environment.key)}
                  />
                  <span><strong>{environment.title}</strong>{environment.note}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </form>

        <aside className="result-panel">
          <div className="result-sticky">
            <div className="result-heading">
              <div>
                <p className="section-code">LIVE TOPOLOGY</p>
                <h2>권장 시작 구성</h2>
              </div>
              <span className="live-dot">LIVE</span>
            </div>

            <div className="topology" aria-label="선택한 아키텍처 구성">
              <div className="topology-rail" aria-hidden />
              <div className="topology-node is-entry"><span>EDGE</span><strong>Gateway</strong></div>
              {config.frontend.mode !== "none" ? (
                <div className="topology-node is-web"><span>WEB</span><strong>{config.frontend.mode === "spa" ? "React SPA" : "SSR adapter"}</strong></div>
              ) : null}
              <div className="topology-node is-service"><span>APP</span><strong>{recommendation.replicas} replicas</strong></div>
              <div className="topology-branches">
                <div className="topology-node"><span>DATA</span><strong>{recommendation.databaseLabel}</strong></div>
                {config.features.redis ? <div className="topology-node"><span>CACHE</span><strong>Redis</strong></div> : null}
                {config.features.kafka ? <div className="topology-node"><span>EVENT</span><strong>Kafka</strong></div> : null}
                {config.features.elasticsearch ? <div className="topology-node"><span>SEARCH</span><strong>Elasticsearch</strong></div> : null}
              </div>
            </div>

            <dl className="spec-grid">
              <div><dt>APP START</dt><dd>{recommendation.replicas} × {recommendation.vcpu} vCPU</dd></div>
              <div><dt>LOAD TARGET</dt><dd>{config.capacity.targetTps.toLocaleString()} TPS</dd></div>
              <div><dt>AVAILABILITY</dt><dd>{config.capacity.availabilityTarget}%</dd></div>
              <div><dt>PROFILES</dt><dd>{recommendation.profiles.length || 0} selected</dd></div>
            </dl>

            <section className="command-box">
              <div><span>LOCAL COMMAND</span><button type="button" onClick={copyCommand}>복사</button></div>
              <code>{recommendation.composeCommand}</code>
            </section>

            {recommendation.warnings.length > 0 ? (
              <section className="warnings">
                <h3>설계 확인 사항</h3>
                <ul>{recommendation.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              </section>
            ) : null}

            <button className="export-button" type="button" onClick={downloadConfig}>
              <span>설정 파일 내보내기</span>
              <strong>template-config.json ↓</strong>
            </button>
            <p className="notice" aria-live="polite">{notice}</p>
            <p className="capacity-note">사양은 부하 테스트의 시작점입니다. 실제 TPS 보장이 아닙니다.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
