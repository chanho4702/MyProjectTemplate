# 서비스 프론트엔드

React 19 + Vite + TypeScript로 만든 Gateway 연결 확인용 SPA다. 실행과 환경 설정은 [프론트엔드 단계별 가이드](../../docs/frontend.md)를 따른다. 선택형 로그인은 [OIDC 가이드](../../docs/authentication.md), API 변경은 [OpenAPI 계약 가이드](../../docs/api-contracts.md)에 있다.

```powershell
cd D:\MyProjectTemplate
pnpm install --frozen-lockfile
pnpm web:dev
```

브라우저에서 <http://localhost:5173>을 연다. 로컬 Vite proxy가 `/api`를 Gateway `http://localhost:8080`으로 전달한다.

기본 인증은 꺼져 있다. `auth.enabled=true`이면 공개 OIDC client의 Authorization Code + PKCE 로그인·갱신·로그아웃을 사용하고 API client가 Bearer token을 Gateway에 보낸다. `packages/api-client`의 요청 코드는 request ID와 오류 정책을 유지하고, DTO 타입은 `contracts/openapi/sample-service.yaml`에서 자동 생성한다.
