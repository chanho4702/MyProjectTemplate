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
