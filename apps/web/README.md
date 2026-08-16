# 서비스 프론트엔드

React 19 + Vite + TypeScript로 만든 Gateway 연결 확인용 SPA다. 실행과 환경 설정은 [프론트엔드 단계별 가이드](../../docs/frontend.md)를 따른다.

```powershell
cd D:\MyProjectTemplate
pnpm install --frozen-lockfile
pnpm web:dev
```

브라우저에서 <http://localhost:5173>을 연다. 로컬 Vite proxy가 `/api`를 Gateway `http://localhost:8080`으로 전달한다.

이 화면은 OIDC 로그인이나 OpenAPI 생성 client를 아직 제공하지 않는다. 현재 `packages/api-client`는 sample API 계약을 타입과 테스트로 고정하는 수동 client이며 후속 OpenAPI 생성의 교체 경계다.
