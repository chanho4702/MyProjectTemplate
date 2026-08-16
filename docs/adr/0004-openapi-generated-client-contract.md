# ADR 0004 — OpenAPI 기준 명세에서 프론트 타입을 생성하고 drift를 차단한다

- 상태: Accepted
- 결정일: 2026-08-16

## 문제

백엔드 DTO와 프론트 TypeScript interface를 따로 손으로 관리하면 endpoint, status와 필수 필드가 조용히 달라진다. 실행 중인 서버에서만 명세를 받아 생성하면 CI 재현성과 변경 검토가 어려워질 수 있다.

## 결정

- `contracts/openapi/sample-service.yaml`을 sample API의 version-controlled 기준 명세로 둔다.
- OpenAPI 3.1 문서에 Gateway path, HTTP status, 요청·응답 schema와 Bearer 인증을 기록한다.
- `openapi-typescript` 7.13.0으로 runtime code가 없는 TypeScript 타입을 생성한다.
- generated 파일은 Git에 포함하지만 직접 수정하지 않는다.
- `packages/api-client`는 generated component type을 사용하면서 fetch, request ID, 인증과 Problem Detail 해석을 별도 유지한다.
- `pnpm api:check`의 generator `--check`로 명세와 committed generated 파일의 차이를 CI에서 실패시킨다.
- backend controller 계약 테스트가 200/201/400 status와 주요 JSON 필드를 확인한다.

## 결과

한 PR에서 API 명세, backend 구현, 생성 타입과 화면의 compile-time 차이를 확인할 수 있다. generator는 개발 의존성이며 production browser bundle에 포함되지 않는다. 다만 생성 타입은 runtime 응답을 검증하지 않으므로 end-to-end 계약 시험을 완전히 대신하지 않는다.

## 검토한 대안

### TypeScript interface를 계속 손으로 작성

작지만 backend 계약과 자동 연결되지 않아 drift를 막지 못한다.

### 실행 중 Spring 서버의 `/v3/api-docs`에서만 생성

annotation에서 자동화하기 쉽지만 generator 전에 DB와 애플리케이션을 기동해야 하고, 의도한 공개 계약의 코드 리뷰 경계가 약해진다. 후속으로 backend-generated 문서와 기준 명세를 비교할 수는 있다.

### 전체 fetch client 코드 자동 생성

현재 endpoint가 작고 request ID, token provider와 Problem Detail 정책이 공통 경계이므로 타입만 생성한다. endpoint 수가 커질 때 `openapi-fetch` 같은 runtime client를 별도 평가한다.

## 검증

- `pnpm api:generate` 재생성
- `pnpm api:check` drift 검사
- API client TypeScript와 unit test
- sample controller HTTP contract test
- CI frontend와 backend job

## 보장하지 않는 범위

- runtime JSON schema validation
- 모든 Gateway/ingress 오류 본문의 동일 형식
- API 계약만으로 성능·가용성이 보장된다는 주장

