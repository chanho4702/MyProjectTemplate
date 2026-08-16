# 버전과 업그레이드 정책

이 문서는 템플릿의 버전을 언제, 어떤 증거로 올리는지 정한다. 최신 버전을 무조건 따라가기보다 지원 기간, 보안 수정, 호환성과 재현성을 함께 본다.

## 1. 버전 기준선

| 영역 | 기준 |
|---|---|
| Java | LTS를 사용하고 Gradle toolchain으로 고정 |
| Spring Boot / Cloud | 공식 호환 조합을 함께 갱신 |
| Node.js | Active LTS 또는 Maintenance LTS 범위 |
| React / Vite / OIDC / OpenAPI 도구 | 정확한 버전을 lockfile에 기록 |
| Docker image | `.env.versions`의 정확한 tag, 검증 보고서는 가능하면 digest 기록 |
| GitHub Actions | major tag를 사용하되 Dependabot과 릴리스 노트를 검토 |

현재 실제 기준선은 루트 `build.gradle`, 각 `package.json`, `pnpm-lock.yaml`, `package-lock.json`과 `infra/.env.versions`가 정본이다.

## 2. 변경 주기

- 보안 패치: 영향과 공개 수준에 따라 가장 먼저 검토한다.
- patch/minor: Dependabot PR 또는 월별 유지보수에서 묶어 검증한다.
- major: 별도 변경 단위로 진행하고 migration 문서와 rollback 지점을 만든다.
- Java/Spring/Node 기준선: 분기마다 지원 상태를 검토하되 이유 없이 올리지 않는다.

## 3. 업그레이드 절차

1. 공식 릴리스 노트와 지원 매트릭스를 확인한다.
2. 한 PR에서 변경할 생태계 범위를 정한다. 예: Spring Boot와 호환 Spring Cloud.
3. lockfile과 이미지 tag를 갱신한다.
4. deprecated API와 설정 키를 검색한다.
5. 아래 자동 검증을 전부 실행한다.
6. DB migration, 인증, 이벤트 또는 성능에 영향이 있으면 통합/부하 검증을 추가한다.
7. README와 검증 기록에 새 기준선과 아직 확인하지 않은 범위를 적는다.

```bash
./gradlew test
docker compose --env-file infra/.env.versions -f infra/compose.yml config
cd tools/configurator && npm test
cd ../../load-tests && npm test
cd .. && pnpm frontend:check
```

## 4. 호환성 판정

다음 중 하나라도 확인되지 않으면 업그레이드를 완료로 표시하지 않는다.

- 애플리케이션과 starter 단위 테스트 통과
- local/dev/prod 설정 key가 모두 해석됨
- Compose profile 구성 검증 통과
- 프론트 typecheck, 단위 테스트와 production build 통과
- OpenAPI generated type drift와 OIDC 비활성/갱신/callback 계약 통과
- 공개 API 또는 생성 설정이 바뀌면 이전 예제와 migration 설명 제공
- 성능 영향이 예상되면 같은 환경과 데이터로 전후 비교

## 5. 롤백

- 업그레이드 전 마지막 통과 commit을 기록한다.
- DB schema처럼 되돌리기 어려운 변경은 애플리케이션 버전 롤백과 별도로 계획한다.
- lockfile과 이미지 버전을 함께 되돌린다.
- 롤백 뒤 같은 smoke와 핵심 계약 테스트를 다시 실행한다.

## 6. 버전 표기 원칙

- `latest` tag를 검증 근거로 사용하지 않는다.
- 부하 결과에는 Git SHA, 이미지 digest, 실행 환경과 데이터셋을 함께 기록한다.
- 지원 종료 버전을 계속 사용한다면 이유, 완화책과 제거 기한을 문서화한다.
- 버전 번호만 바꾸고 검증하지 않은 상태를 완료라고 기록하지 않는다.
