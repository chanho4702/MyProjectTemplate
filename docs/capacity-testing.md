# 처리량과 가용성 검증

## 왜 고정 TPS 표를 제공하지 않는가

동일한 코드도 쿼리 형태, 데이터 크기, 캐시 적중률, 네트워크, JVM heap, 외부 API에 따라 처리량이 크게 달라진다. 따라서 아키텍처 설명의 숫자는 계획 입력이며 보장값이 아니다.

## 테스트 단계

1. smoke: 1~5 TPS로 계약과 오류율 확인
2. baseline: 단일 인스턴스의 knee point 탐색
3. target: 목표 TPS를 30분 유지
4. spike: 30초 내 3배 상승 후 복구 확인
5. soak: 4~12시간 동안 leak과 lag 확인
6. failover: 앱 인스턴스, reader, broker 중 하나를 제거

`knee.js`, `spike.js`, `soak.js`는 실제 성능 등급을 부여하지 않는다. 입력한 단계와 SLO를 재현하고 결과 JSON을 남기는 실행 하네스다.

## 실행 전 필수 메타데이터

세 시나리오는 다음 값을 빠뜨리면 시작하지 않는다.

| 환경변수 | 의미 | 예시 |
|---|---|---|
| `GIT_SHA` | 테스트한 코드의 전체 Git SHA | `0123456789ab...` |
| `TEST_ENVIRONMENT` | 환경 이름 | `local`, `dev-c2` |
| `INSTANCE_PROFILE` | 앱 인스턴스와 JVM 사양 | `1 app, 2 vCPU, 2 GiB heap` |
| `DATASET_DESCRIPTION` | 데이터 크기와 요청 조합 | `10k items, read-only` |
| `RESULT_FILE` | 결과 JSON 경로 | `load-tests/results/knee-local.json` |

이미지로 실행했다면 `IMAGE_DIGEST`, DB·Redis·Kafka 구성을 구분해야 한다면 `DEPENDENCY_PROFILE`도 전달한다. 결과 파일은 Git에 포함하지 않고 실험 아티팩트 저장소나 CI artifact에 보관한다.

localhost가 아닌 대상을 부하 테스트할 때는 소유·허용 범위를 확인한 뒤 `ALLOW_NON_LOCAL=true`를 명시해야 한다.

## Knee point 탐색

`KNEE_RATES`는 낮은 값부터 엄격히 증가하는 TPS 목록이다. 각 단계를 유지하면서 p95/p99, 오류율, dropped iteration과 CPU·GC·DB pool 포화를 함께 비교한다.

```bash
mkdir -p load-tests/results
k6 run \
  -e KNEE_RATES=25,50,75,100 \
  -e STAGE_DURATION=2m \
  -e GIT_SHA="$(git rev-parse HEAD)" \
  -e TEST_ENVIRONMENT=local \
  -e INSTANCE_PROFILE="1 app, 2 vCPU, 2 GiB heap" \
  -e DATASET_DESCRIPTION="10k items, read-only" \
  -e RESULT_FILE=load-tests/results/knee-local.json \
  load-tests/knee.js
```

처음으로 SLO를 벗어나거나 자원이 지속 포화되는 단계의 직전 값을 해당 환경의 후보 기준선으로 본다. 다른 환경의 보장값으로 재사용하지 않는다.

## Spike와 복구

기본 spike 배수는 3이며, `SPIKE_MULTIPLIER`로 명시적으로 바꿀 수 있다. 30초 상승, 30초 유지, 30초 하강 후 baseline 복구 구간을 확인한다.

```bash
k6 run \
  -e BASELINE_TPS=40 \
  -e GIT_SHA="$(git rev-parse HEAD)" \
  -e TEST_ENVIRONMENT=local \
  -e INSTANCE_PROFILE="1 app, 2 vCPU, 2 GiB heap" \
  -e DATASET_DESCRIPTION="10k items, read-only" \
  -e RESULT_FILE=load-tests/results/spike-local.json \
  load-tests/spike.js
```

## Soak

기본 지속 시간은 4시간이다. `DURATION`은 단일 k6 duration 형식으로 지정하며 운영 예상 데이터 크기에서 heap, connection, lag가 시간에 따라 누적되는지 관찰한다.

```bash
k6 run \
  -e TARGET_TPS=75 \
  -e DURATION=4h \
  -e GIT_SHA="$(git rev-parse HEAD)" \
  -e TEST_ENVIRONMENT=local \
  -e INSTANCE_PROFILE="1 app, 2 vCPU, 2 GiB heap" \
  -e DATASET_DESCRIPTION="10k items, read-only" \
  -e RESULT_FILE=load-tests/results/soak-local.json \
  load-tests/soak.js
```

## SLO 입력

기본 threshold는 기존 capacity 시나리오와 같은 `오류율 < 0.1%`, `p95 < 300ms`, `p99 < 800ms`, `dropped iteration = 0`이다. 이는 제품 보장이 아니라 저장소의 초기 테스트 입력이다. 서비스 SLO가 정해지면 `MAX_ERROR_RATE`, `P95_MS`, `P99_MS`로 덮어쓰고 결과 파일에 실제 입력값을 남긴다.

## Prometheus와 Grafana

로컬 서비스의 요청률, 5xx 비율, p95/p99, process CPU, JVM heap과 HikariCP 상태를 같은 시간축에서 확인한다.

```bash
docker compose --env-file infra/.env.versions -f infra/compose.yml \
  --profile observability up -d
```

- Prometheus: <http://localhost:9090>
- Grafana: <http://localhost:3001>
- 로컬 기본 계정: `admin` / `grafana-local-password`
- Dashboard: `MyProjectTemplate / MyProjectTemplate Service Capacity`

Prometheus는 호스트의 Gateway `:8080`과 sample-service `:8081`을 수집한다. 부하 실행 전에 서비스의 `/actuator/prometheus`가 응답하고 Grafana의 `Targets up`이 `1`인지 확인한다. 이 Compose profile과 계정은 로컬 전용이며 운영 배포 구성이 아니다.

## 결과 기록 필수값

- Git SHA와 이미지 digest
- CPU, 메모리, JVM, 인스턴스 수
- DB 사양, pool 크기, 데이터 행 수
- Redis cache hit ratio
- Kafka partition 수와 consumer 수
- 요청 조합과 payload 크기
- TPS, p50/p95/p99/max, 오류율
- 장애 주입 시 복구 시간과 손실 여부

가용성 목표 `99.9%`는 월 약 43분의 error budget을 의미하지만, 단일 부하 테스트 성공만으로 달성되는 것이 아니다. 배포, 백업 복구, 장애 대응까지 포함해 판단한다.

## Markdown 결과 리포트

k6가 생성한 JSON을 사람이 검토할 수 있는 Markdown으로 변환한다.

```bash
node load-tests/report.js \
  --input load-tests/results/spike-local.json \
  --output load-tests/results/spike-local.md
```

리포트에는 Git SHA, 환경, 인스턴스·데이터셋, 시나리오 입력, 핵심 k6 지표와 threshold 결과가 포함된다. `PASS`는 해당 실행의 threshold 계약 통과일 뿐, 다른 환경의 처리량이나 가용성을 인증하지 않는다.

## 시나리오 계약 테스트

실제 부하를 만들지 않고 단계 계산, 안전장치, 메타데이터, 대시보드와 결과 리포트 구성을 검증한다.

```bash
cd load-tests
npm test
```
