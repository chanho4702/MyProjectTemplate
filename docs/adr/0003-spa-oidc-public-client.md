# ADR 0003 — SPA OIDC는 공개 client와 Authorization Code + PKCE를 사용한다

- 상태: Accepted
- 결정일: 2026-08-16

## 문제

브라우저 SPA가 보호된 Gateway API를 호출하려면 사용자의 OIDC 세션과 access token이 필요하다. 그러나 브라우저 bundle이나 런타임 JSON에 client secret을 넣을 수 없고, local 연결 검증에서는 인증 인프라 없이도 실행할 수 있어야 한다. token 만료, callback 오류와 미로그인을 일반 네트워크 장애와도 구분해야 한다.

## 결정

- 인증은 `app-config.json`의 `auth.enabled`로 선택하며 기본값은 false다.
- false일 때 `oidc-client-ts` module을 동적으로 import하지 않고 로그인 UI와 Bearer header도 만들지 않는다.
- true일 때 SPA는 공개 OIDC client의 Authorization Code flow와 S256 PKCE를 사용한다.
- client secret과 resource owner password flow를 사용하지 않는다.
- login callback은 같은 origin의 `/oidc/callback`, IdP sign-out state를 완료하는 callback은 `/oidc/logout-callback`, 최종 복귀는 `/`를 기본으로 한다.
- interaction state와 user/token은 `sessionStorage`에 두고 `localStorage`는 사용하지 않는다.
- 만료 전 자동 silent renew를 사용하고, API 직전에 만료가 확인되면 한 번 갱신한다.
- 갱신이 실패하면 세션을 제거하고 다시 로그인을 안내한다. 401 응답이나 POST 요청을 자동 반복하지 않는다.
- API client는 token을 직접 소유하지 않고 `accessTokenProvider`에서 필요한 시점에 받는다.
- 인증이 켜진 미로그인 상태에서는 화면이 보호 API를 먼저 호출하지 않는다.
- Gateway resource server가 외부 요청의 JWT issuer와 서명을 검증한다. local sample-service permit-all은 Gateway 통합 점검용이며 운영 내부 우회 방어를 뜻하지 않는다.

## 결과

기존 비인증 local 흐름이 유지되고 인증을 고른 배포에서만 OIDC code가 별도 chunk로 로드된다. 로그인·갱신·로그아웃의 브라우저 상태와 API Bearer header 경계가 분리된다. 반면 SPA 실행 중 JavaScript가 token을 다루므로 XSS 방어와 dependency 관리가 운영 보안 조건이 된다.

## 검토한 대안

### SPA에 client secret 저장

브라우저 사용자가 값을 읽을 수 있어 secret이 아니므로 금지한다.

### implicit flow

Authorization Code + PKCE보다 token 노출과 현대 보안 권고 측면에서 불리하므로 사용하지 않는다.

### 처음부터 BFF와 HTTP-only cookie 사용

token을 브라우저 JavaScript에서 제거할 수 있지만 서버 세션, CSRF, scaling과 운영 Secret 요구가 추가된다. 고위험 서비스나 cookie 요구가 확정될 때 별도 adapter와 ADR로 추가한다.

### 모든 local 실행에서 인증 강제

빠른 DB·Gateway 연결 검증에 불필요한 Keycloak 의존성이 생기므로 기본값으로 선택하지 않는다.

## 검증

- 인증 비활성 상태에서 manager factory가 호출되지 않는 단위 테스트
- runtime authority, callback, scope와 client secret 거부 테스트
- callback 완료, expired token 갱신과 session 오류 테스트
- Bearer header API client 테스트
- 미로그인 상태에서 보호 API를 호출하지 않는 React 테스트
- local Keycloak 공개 client와 exact redirect 설정
- 환경별 실제 browser/IdP/Gateway smoke

## 보장하지 않는 범위

- HTTP-only cookie BFF, CSRF 방어 또는 token exchange
- 운영 IdP의 MFA, 가입·복구·사용자 lifecycle 정책
- sessionStorage가 XSS로부터 token을 완전히 보호한다는 보장
- Gateway를 우회하는 내부 호출의 네트워크 차단
