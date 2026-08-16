# 로컬 인프라

이 Compose는 개발과 기능 검증 전용이다. 운영 topology를 표현하지 않는다.

| profile | 서비스 | 용도 |
|---|---|---|
| 기본 | PostgreSQL writer | 모든 서비스의 로컬 DB |
| `database-ha` | PostgreSQL streaming reader | `readOnly` 라우팅 검증 |
| `cache` | Redis | cache/TTL 검증 |
| `messaging` | Kafka KRaft | 이벤트 발행·소비 검증 |
| `search` | Elasticsearch | 색인·검색 검증 |
| `identity` | Keycloak | 표준 OIDC/JWT 로컬 검증 |
| `observability` | Prometheus + Grafana | 서비스 지연·오류·JVM·DB pool 관찰 |
| `capacity-ha` | 로컬 Nginx capacity proxy | `:8081`, `:8083` 두 sample-service의 인스턴스 제거 실험 |

```bash
docker compose --env-file .env.versions -f compose.yml --profile database-ha --profile cache up -d
```

reader를 켰을 때 애플리케이션에 `DB_READER_URL=jdbc:postgresql://localhost:5434/appdb`를 전달한다. reader profile을 끄거나 URL을 비우면 모든 트랜잭션이 writer를 사용한다.

Keycloak issuer는 `http://localhost:8180/realms/template`이다. 포함된 client secret과 모든 비밀번호는 로컬 전용이며 운영에 복사하지 않는다.

관측성 profile은 호스트에서 실행 중인 Gateway `:8080`과 sample-service `:8081`의 `/actuator/prometheus`를 수집한다.

```bash
docker compose --env-file .env.versions -f compose.yml --profile observability up -d
```

- Prometheus: <http://localhost:9090>
- Grafana: <http://localhost:3001> (`admin` / `grafana-local-password`)
- Dashboard: `MyProjectTemplate / MyProjectTemplate Service Capacity`

포트와 기본 계정은 localhost 개발 전용이다. 운영에서는 외부 인증, TLS, 별도 Secret과 장기 보존 정책을 사용한다.

`capacity-ha`는 운영 load balancer가 아니라 장애 실험 전용 로컬 proxy다. sample-service를 `8081`과 `8083`에서 각각 실행한 뒤 `http://localhost:8084`로 요청한다.

```bash
docker compose --env-file .env.versions -f compose.yml --profile capacity-ha up -d capacity-proxy
```

Nginx access log에는 선택된 upstream 주소와 상태가 남는다. 인스턴스 하나를 중단했을 때 다른 upstream으로 재시도되는지 확인할 수 있다.

데이터 초기화가 정말 필요한 경우에만 사용자가 명시적으로 named volume을 제거한다. 일반적인 `down`은 볼륨을 보존한다.
