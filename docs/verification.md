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
