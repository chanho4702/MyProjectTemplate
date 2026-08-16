# ADR 0002 — 서비스 프론트엔드의 Gateway와 런타임 설정 경계

- 상태: Accepted
- 결정일: 2026-08-16

## 문제

SPA가 각 백엔드 서비스 주소를 직접 알면 서비스 분리와 배포 변경이 브라우저에 노출된다. API 주소를 Vite 빌드 시점에만 고정하면 local/dev/prod마다 이미지를 다시 만들어야 하고 운영 Secret을 번들에 넣을 위험도 있다.

## 결정

- `apps/web`은 브라우저용 SPA이며 백엔드 서비스가 아니라 Gateway API만 호출한다.
- 로컬 개발은 Vite의 `/api` proxy가 Gateway `http://localhost:8080`으로 전달한다.
- 배포 환경은 `app-config.json`을 시작 시 읽어 API base URL과 환경 이름을 결정한다.
- 기본 API base URL은 빈 문자열, 즉 같은 origin이다. 운영에서는 load balancer 또는 ingress가 `/api`를 Gateway로 전달하는 구성을 우선한다.
- 프론트 번들에 client secret이나 운영 자격증명을 넣지 않는다.
- BFF는 쿠키 세션, token exchange 또는 서버 전용 Secret이라는 실제 요구가 생길 때 별도 adapter로 추가한다.
- `packages/api-client`가 HTTP와 Problem Detail 해석을 담당하고 화면 컴포넌트는 URL 조합과 오류 JSON 구조를 알지 않는다.

## 결과

같은 프론트 이미지를 환경별 런타임 설정과 함께 사용할 수 있고, 브라우저가 내부 서비스 주소에 결합되지 않는다. 첫 화면 전에 작은 설정 파일 요청이 하나 추가되므로 실패 화면과 검증이 필요하다.

## 검토한 대안

### `VITE_API_BASE_URL`만 사용

단순하지만 값이 빌드 산출물에 포함되어 환경마다 다시 빌드해야 하므로 기본 전략으로 선택하지 않았다.

### 브라우저가 sample-service 직접 호출

로컬 연결은 쉽지만 CORS, 인증, 서비스 주소와 라우팅 정책이 브라우저에 노출되므로 선택하지 않았다.

### 처음부터 BFF 추가

현재 샘플은 공개 local API 흐름만 필요하다. 구체적인 세션과 token 보관 요구 없이 서버를 하나 더 추가하지 않는다.

## 검증

- 런타임 설정 parser 단위 테스트
- API client의 성공, validation Problem Detail과 request ID 계약 테스트
- Vite proxy를 통한 Gateway 연동 smoke
- 로딩, 빈 목록, 오류와 생성 성공 화면 테스트

## 보장하지 않는 범위

이 결정만으로 OIDC 로그인, CSRF 방어, token 갱신 또는 운영 CORS 정책이 완성되지는 않는다. 해당 기능은 별도의 보안 결정과 통합 테스트 뒤 활성화한다.
