# 검증 기록

이 문서는 템플릿이 보장한다고 말할 수 있는 범위와 아직 검증하지 않은 범위를 분리한다. 날짜와 환경이 달라지면 같은 절차를 다시 실행한다.

## 2026-08-15 로컬 검증

환경: Windows, JDK 21, Docker Desktop, Node.js 기반 구성기.

| 대상 | 결과 | 확인 내용 |
|---|---|---|
| Gradle 전체 프로젝트 | 통과 | 모든 starter, `sample-service`, `gateway-service` 테스트 |
| 구성 마법사 | 통과 | 프로덕션 빌드, 서버 렌더 테스트, `npm audit` 취약점 0건 |
| Compose | 통과 | 모든 profile을 함께 적용한 구성 해석 |
| PostgreSQL 복제 | 통과 | writer의 `pg_is_in_recovery() = false`, reader는 `true`, 생성 행 복제 확인 |
| DB 읽기/쓰기 라우팅 | 통과 | 쓰기는 writer, `@Transactional(readOnly=true)` 조회는 reader에서 수행 |
| writer 중단 시 읽기 | 통과 | writer 컨테이너 중단 중에도 기존 행의 read-only API가 성공 |
| 게이트웨이 | 통과 | 게이트웨이 경유 샘플 API 200, 요청 ID 전달 및 응답 헤더 단일화 |
| Redis/Kafka/Elasticsearch 이미지 | 정적 확인 | 정확한 이미지 태그와 Compose 구성 확인, 기능별 통합 부하는 미실행 |

## 아직 보장하지 않는 것

- 특정 TPS, 지연 시간 또는 가용성 수치
- Kafka broker 장애, consumer 재처리, outbox 원자성
- Elasticsearch 대량 색인과 shard 재배치
- Redis failover와 cache stampede 제어
- Kubernetes 다중 AZ 배포, HPA/PDB, backup/restore

성능 수치는 [처리량과 가용성 검증](capacity-testing.md)의 조건을 기록한 실측 결과가 생긴 뒤에만 추가한다.

## 2026-08-16 부하 시나리오와 회귀 검증

| 대상 | 결과 | 확인 내용 |
|---|---|---|
| Gradle 전체 프로젝트 | 통과 | JDK 21로 전체 starter와 서비스 테스트 재실행 |
| 구성 마법사 | 통과 | 프로덕션 빌드와 서버 렌더 테스트 재실행 |
| Compose | 통과 | 기본 구성과 모든 profile 구성 해석 |
| knee point 시나리오 | 단위 검증 | 증가 TPS 단계, 회복 단계, VU 상한 계산 |
| spike 시나리오 | 단위 검증 | baseline→3배 spike→baseline 복구 단계 |
| soak 시나리오 | 단위 검증 | 명시적 목표 TPS와 기본 4시간 지속 설정 |
| 실행 안전장치 | 단위 검증 | 비로컬 대상 opt-in, Git SHA·환경·사양·데이터셋·결과 경로 필수화 |
| 결과 계약 | 단위 검증 | 메타데이터, 입력값과 k6 원본 summary를 JSON에 보존 |
| 결과 리포트 | 단위 검증 | JSON 검증, 핵심 지표·threshold·비보장 문구 Markdown 출력 |
| 관측성 profile | 정적 검증 | localhost 전용 Prometheus/Grafana와 구성기 profile 연결 |
| Grafana dashboard | 단위 검증 | 요청률, 오류율, p95/p99, CPU, JVM heap, DB pool query 계약 |

이 검증은 k6 설정 계산을 확인한 것이며 실제 부하 결과가 아니다. 특정 TPS, 지연 시간 또는 가용성 수치를 추가로 보장하지 않는다.

## 2026-08-16 로컬 탐색 실측

이 절은 공식 C1/C2 기준선이 아니라 실행 하네스와 장애 시나리오를 확인한 **로컬 탐색 결과**다.

### 실행 환경

| 항목 | 값 |
|---|---|
| 기준 코드 | `a32a97979d71c2f7300d7def3dceae920acece45` |
| 작업 트리 | 문서와 p99 summary 보완이 포함된 dirty 상태, spike 실행 시 diff hash `0f600242bdbaefd94fbea6e070bbd6aa028f755a` |
| OS·CPU | Windows, AMD Ryzen 5 7530U, 논리 프로세서 12개 |
| 메모리 | 약 29.8 GiB |
| 애플리케이션 | sample-service 직접 호출, Gradle `bootRun`, JDK 21, DB pool 최대 10 |
| 부하 발생기 | Docker Desktop 25.0.3, k6 v2.2.0 |
| k6 이미지 | `grafana/k6@sha256:5221b620a4f874faff6e32ba597aa667c058391fe4898b1c6f6377f062c6cdec` |
| 데이터셋 | item 1건, `GET /api/v1/items` 읽기 요청 |
| 의존성 | PostgreSQL 17.6 writer+streaming reader, Prometheus 3.13.1, Grafana 13.1.0 |
| 알려진 간섭 | 같은 PC에서 다른 프로젝트 컨테이너가 실행 중이었고 8080 포트 충돌로 Gateway는 측정에서 제외 |

### 짧은 knee probe

10→25→50→100 TPS를 단계당 30초, 회복 30초로 실행했다.

| 지표 | 결과 |
|---|---:|
| 요청 수 | 5,849 |
| 전체 평균 요청률 | 38.99 req/s |
| 오류율 | 0% |
| p50 | 5.76 ms |
| p95 | 9.84 ms |
| 최대 지연 | 61.1 ms |
| dropped iteration | 0 |

이 실행은 단계가 짧고 최고 100 TPS까지만 시험했으므로 knee point를 결정하지 않는다. 첫 결과에서 k6 summary의 p99 숫자가 누락되는 문제를 발견했고, `summaryTrendStats`에 p99를 명시한 뒤 계약 테스트를 추가했다.

### 3배 spike probe

50 TPS baseline에서 150 TPS까지 올린 뒤 50 TPS로 복구했다. 총 실행 시간은 5분 30초다.

| 지표 | 결과 |
|---|---:|
| 요청 수 | 22,499 |
| 전체 평균 요청률 | 68.18 req/s |
| 오류율 | 0% |
| p50 | 6.63 ms |
| p95 | 12.28 ms |
| p99 | 24.07 ms |
| 최대 지연 | 495.4 ms |
| dropped iteration | 0 |
| 초기 threshold | 모두 PASS |

이 결과는 1건 데이터의 단순 조회를 단일 로컬 서비스에 직접 보낸 결과다. 실제 서비스 payload나 Gateway 경유 성능으로 일반화하지 않는다.

### reader 중단과 복구

20 TPS를 90초 유지하면서 reader 컨테이너를 약 17초 중단한 뒤 재시작했다.

| 지표 | 결과 |
|---|---:|
| 요청 수 | 1,713 |
| 전체 평균 요청률 | 19.03 req/s |
| 오류율 | 15.879% |
| p50 | 9.08 ms |
| p95 | 3,020.2 ms |
| p99 | 3,024.16 ms |
| 최대 지연 | 3,036.21 ms |
| dropped iteration | 88 |
| 초기 threshold | FAIL |
| reader 재시작 후 health/API | `UP`, 조회 성공 |

현재 구현은 reader URL이 비어 있을 때 시작 시 writer로 fallback하지만, 실행 중 reader 연결 장애를 writer로 자동 전환하지 않는다. 단일 reader를 중단한 동안 HikariCP connection timeout 약 3초가 지연에 반영됐고 목표 TPS도 유지하지 못했다. 운영 가용성은 관리형 reader endpoint 또는 DB proxy와 함께 별도로 검증해야 한다.

### 10분 soak 사전 점검

정식 4시간 soak 전에 50 TPS를 10분 유지했다.

| 지표 | 결과 |
|---|---:|
| 요청 수 | 30,001 |
| 요청 처리율 | 50.00 req/s |
| 오류율 | 0.007% — 연결 timeout 2건 |
| p50 | 6.99 ms |
| p95 | 11.66 ms |
| p99 | 30.02 ms |
| 최대 지연 | 245.12 ms |
| dropped iteration | 0 |
| 초기 threshold | PASS |
| process CPU 관찰 최대 | 약 2.17% |
| DB active / pending 관찰 최대 | 1 / 0 |
| heap 관찰 처음 / 마지막 / 최대 | 약 64.67 / 209.13 / 209.16 MiB |

두 요청은 Docker의 `host.docker.internal:8081` 연결 단계에서 I/O timeout이 발생했다. 기본 오류율 임계치 0.1% 이내였지만 무오류 실행은 아니다.

heap 사용량은 10분 구간에서 증가했지만, JVM이 확보한 메모리를 즉시 반환하지 않는 정상 동작과 누수를 이 길이의 실행만으로 구분할 수 없다. 정식 4시간 soak에서 GC 이후 바닥값, old generation, GC pause와 시간별 기울기를 다시 확인해야 한다.

### 앱 인스턴스 하나 제거

`capacity-ha` profile의 로컬 Nginx proxy 앞에 sample-service 두 개를 `8081`, `8083`으로 실행했다. 50 TPS를 90초 유지하고 시작 약 25초 뒤 `8083` Java 프로세스를 정확한 listening PID로 확인해 중단했다.

| 지표 | 결과 |
|---|---:|
| 요청 수 | 4,500 |
| 요청 처리율 | 50.00 req/s |
| 오류율 | 0% |
| p50 | 12.52 ms |
| p95 | 40.65 ms |
| p99 | 101.80 ms |
| 최대 지연 | 219.07 ms |
| dropped iteration | 0 |
| 초기 threshold | PASS |
| `8081` 직접 성공 로그 | 3,771건 |
| 중단 전 `8083` 성공 로그 | 708건 |
| `8083` 실패 후 `8081` 재시도 성공 | 21건 |
| 최종 proxy 5xx | 0건 |
| 제거한 `8083` 재기동 후 | health `UP`, proxy 조회 성공 |

결과 metadata의 작업 트리 diff hash는 `b75e35a6e50e6bcc3e6cc351c2068bc720cee393`이다. Nginx 로그의 `upstream_status=502, 200`은 첫 upstream 연결은 실패했지만 두 번째 upstream 응답으로 최종 HTTP 200이 반환됐다는 뜻이다.

이 검증은 멱등 GET, 단일 PC, 로컬 Nginx round-robin 조건에서만 유효하다. POST 자동 재시도, Kubernetes Service/readiness, managed load balancer와 다중 AZ 동작을 증명하지 않는다.

### 이 실측으로 아직 말할 수 없는 것

- 깨끗한 Git 커밋을 기준으로 반복 실행한 공식 기준선
- 4시간 이상 soak에서의 heap·GC 안정성 — 10분 사전 점검만 완료
- 10,000건 이상 데이터와 현실적인 요청 조합의 성능
- Gateway를 경유한 end-to-end 지연
- Kubernetes 또는 managed load balancer에서 앱 인스턴스를 제거한 뒤의 가용성 — 로컬 Nginx 실험만 완료
- C1 또는 C2 등급 충족

로컬 원본 결과는 `load-tests/results/`에 생성되며 Git에는 포함하지 않는다. 재현 절차는 [처리량과 가용성 단계별 가이드](capacity-testing.md)를 따른다.

## 2026-08-16 서비스 프론트엔드 기반 검증

이 검증은 `1c52d5593c71a189b0df5c16c664eced808c55d9` 위에 프론트 변경을 적용한 작업 트리에서 실행했다. 성능 기준선이 아니라 빌드와 연결 계약 검증이다.

| 대상 | 결과 | 확인 내용 |
|---|---|---|
| pnpm frozen install | 통과 | Node workspace의 lockfile 재현 |
| 공통 API client | 통과 | TypeScript, GET/POST, Problem Detail, validation, request ID 4개 테스트 |
| React SPA | 통과 | TypeScript, runtime config, 로딩·목록·오류 화면 7개 테스트 |
| production build | 통과 | Vite 8.2.1, JS 약 201.76 kB / gzip 63.95 kB, CSS 약 13.53 kB / gzip 4.00 kB |
| 구성 마법사 | 통과 | `none/spa/ssr` 선택을 포함한 production build와 server render |
| 실제 local 연결 | 통과 | Vite `:5173` → proxy → Gateway `:8082` → sample-service `:8081` → PostgreSQL GET/POST/재조회 |
| 의존성 취약점 | 통과 | pnpm production audit와 구성기 npm production audit에서 알려진 취약점 0건 |

로컬 `8080`은 다른 Docker/WSL process가 사용 중이라 Gateway를 `8082`로 실행하고 `GATEWAY_PROXY_TARGET`으로 Vite proxy를 맞췄다. 통합 확인 중 `frontend-qa-20260816` 항목 1건을 로컬 DB에 생성했다.

연결 가능한 인앱/외부 브라우저가 없어 자동 스크린샷 기반 시각 QA는 실행하지 못했다. 반응형 breakpoint, keyboard focus, `prefers-reduced-motion`과 상태별 컴포넌트는 코드와 단위 테스트로 확인했지만 실제 브라우저의 데스크톱·모바일 픽셀 검토는 후속 확인이 필요하다.

아직 검증하지 않은 범위:

- OIDC 로그인·token 갱신·로그아웃
- OpenAPI 생성 client와 백엔드 schema drift 검출
- 실제 브라우저 E2E
- 독립 프론트 컨테이너와 운영 ingress
- SSR adapter

## 2026-08-16 선택형 OIDC와 OpenAPI 계약 검증

이 검증은 `ed75b86f3f1cbe0aef5a5c03eeb6a87696803114` 위 작업 트리에 선택형 인증과 API 계약 변경을 적용해 실행했다. 실제 사용자 트래픽의 보안 인증이나 성능 기준선이 아니라 코드·설정·생성물 계약 검증이다.

| 대상 | 결과 | 확인 내용 |
|---|---|---|
| 전체 backend | 통과 | Java 21 `./gradlew test`, sample controller의 GET 200·POST 201·validation 400 계약 포함 |
| OpenAPI drift | 통과 | OpenAPI 3.1.2 명세에서 `openapi-typescript` 7.13.0 생성, `--check` 일치 |
| API client | 통과 | TypeScript와 GET/POST·Problem Detail·request ID·Bearer token 5개 테스트 |
| React SPA | 통과 | runtime config, OIDC 비활성·login/logout callback·silent renew, 미로그인 차단과 기존 화면 총 17개 테스트 |
| production build | 통과 | main JS 210.14 kB / gzip 66.41 kB, OIDC 별도 chunk 67.50 kB / gzip 17.04 kB, CSS 15.00 kB / gzip 4.30 kB |
| Keycloak realm | 통과 | Keycloak 26.4.2 임시 fresh import, issuer discovery, 공개 `template-spa`, Standard Flow, S256 PKCE, login/logout exact redirect와 `local-user` 확인 |
| Compose | 통과 | 기본 구성과 database-ha/cache/messaging/search/identity/observability 전체 profile config |
| 구성 마법사 | 통과 | production build와 server render 1개 테스트 |
| 부하 계약 | 통과 | 15개 Node 계약 테스트 |
| 의존성 취약점 | 통과 | pnpm production audit와 구성기 npm production audit에서 알려진 취약점 0건 |

Keycloak 검증은 기존 Compose DB를 건드리지 않도록 `18180`의 임시 컨테이너에서 수행하고 컨테이너를 제거했다. realm JSON이 fresh import에서 실제 해석된다는 사실을 확인한 것이며, 기존 realm에는 Keycloak의 `IGNORE_EXISTING` 정책 때문에 새 client가 자동 덮어써지지 않는다. 기존 realm 사용자는 [OIDC 인증 가이드](authentication.md)의 Admin Console 확인 절차를 따라야 한다.

연결 가능한 인앱/외부 브라우저가 없어 실제 `local-user` 로그인 클릭, callback 화면과 로그아웃의 브라우저 E2E·스크린샷은 실행하지 못했다. 다음 항목은 후속 환경 검증으로 남는다.

- 실제 브라우저 → Keycloak → SPA callback → Gateway JWT 검증의 end-to-end smoke
- dev/prod IdP의 HTTPS, exact redirect, MFA와 사용자 lifecycle 정책
- BFF/HTTP-only cookie와 CSRF adapter
- 프론트 독립 컨테이너와 운영 ingress/CORS

## 2026-08-19 공통 상태 처리와 브라우저 E2E 검증

이 검증은 `ad87cd0` 위 작업 트리에서 공통 실패 해석기, 공통 상태 컴포넌트와 Playwright E2E를 적용해 실행했다. 성능 기준선이 아니라 화면 상태 계약 검증이다.

환경: Windows 11, Node.js 24.16.0, pnpm 11.10.0, Playwright 1.62.1, Chromium 151.0.7922.34.

| 대상 | 결과 | 확인 내용 |
|---|---|---|
| API client | 통과 | TypeScript와 GET/POST·Problem Detail·request ID·Bearer token 5개 테스트 |
| 실패 해석 | 통과 | 401/403/404/409/422/429/5xx 분류, violation 전달, fetch TypeError, abort 판별 13개 테스트 |
| 상태 컴포넌트 | 통과 | 로딩·빈 상태·권한 안내·실패 알림의 role과 행동 버튼 8개 테스트 |
| React SPA | 통과 | runtime config, OIDC, 재시도 복구, 401 재로그인, violation 표시를 포함한 총 42개 테스트 |
| 브라우저 E2E | 통과 | Chromium 12개 시나리오: 로딩·빈 목록·목록 순서·5xx 복구·연결 실패·403·생성 성공·validation·빈 입력·인증 켬 미호출·OIDC 이동·설정 실패 |
| production build | 통과 | main JS 213.91 kB / gzip 67.60 kB, OIDC 별도 chunk 67.50 kB / gzip 17.04 kB, CSS 16.13 kB / gzip 4.52 kB |

E2E는 `vite build` 산출물을 `vite preview`로 띄우고 실제 Chromium에서 연다. `/api/v1/items`와 `/app-config.json` 응답은 브라우저 단계에서 stub으로 대체하므로 Gateway, sample-service, PostgreSQL, Keycloak을 띄우지 않아도 항상 같은 결과가 나온다. 이 방식은 화면 상태 계약을 검증하지만 Gateway routing, CORS, 실제 OIDC redirect는 검증하지 않는다.

`vite preview`의 기본 host가 IPv6 `localhost`로만 바인딩되는 환경이 있어 preview host를 `127.0.0.1`로 고정했다.

아직 검증하지 않은 범위:

- 실제 Gateway·Keycloak을 함께 띄우는 통합 E2E
- Chromium 외 브라우저와 모바일 viewport
- 시각 회귀(스크린샷 비교)
- 프론트 독립 컨테이너와 운영 ingress/CORS
