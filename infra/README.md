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

```bash
docker compose --env-file .env.versions -f compose.yml --profile database-ha --profile cache up -d
```

reader를 켰을 때 애플리케이션에 `DB_READER_URL=jdbc:postgresql://localhost:5434/appdb`를 전달한다. reader profile을 끄거나 URL을 비우면 모든 트랜잭션이 writer를 사용한다.

Keycloak issuer는 `http://localhost:8180/realms/template`이다. 포함된 client secret과 모든 비밀번호는 로컬 전용이며 운영에 복사하지 않는다.

데이터 초기화가 정말 필요한 경우에만 사용자가 명시적으로 named volume을 제거한다. 일반적인 `down`은 볼륨을 보존한다.
