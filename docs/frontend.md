# 서비스 프론트엔드 처음부터 실행하기

이 문서는 React를 처음 접하는 사람도 `apps/web` 화면을 실행하고 Gateway 연결을 확인하도록 단계별로 설명한다. 현재 제공 범위는 **sample API 조회·생성, 로딩·빈 화면·오류 안내와 런타임 환경 설정**이다. OIDC 로그인, OpenAPI 자동 생성과 E2E는 후속 작업이다.

## 1. 무엇이 실행되나

```mermaid
flowchart LR
    B[Browser :5173] -->|/api| V[Vite local proxy]
    V --> G[Gateway :8080]
    G --> S[sample-service :8081]
    S --> W[(PostgreSQL writer :5432)]
    S -. readOnly .-> R[(PostgreSQL reader :5434)]
```

브라우저는 sample-service `:8081`을 직접 호출하지 않는다. `/api` 요청은 Gateway를 지나가며, 로컬에서는 Vite proxy가 브라우저의 CORS 문제 없이 `:8080`으로 전달한다.

## 2. 먼저 준비할 것

- Node.js 22.13 이상
- pnpm 11.10.0
- PostgreSQL writer
- sample-service `:8081`
- Gateway `:8080`

PowerShell에서 확인한다.

```powershell
cd D:\MyProjectTemplate
node --version
pnpm --version
Invoke-RestMethod http://localhost:8081/actuator/health
Invoke-RestMethod http://localhost:8080/actuator/health
```

Node만 있고 pnpm 명령이 없다면 Node에 포함된 Corepack으로 준비한다.

```powershell
corepack enable
corepack prepare pnpm@11.10.0 --activate
pnpm --version
```

## 3. 백엔드 실행

### 터미널 A — PostgreSQL

```powershell
cd D:\MyProjectTemplate
docker compose --env-file infra/.env.versions -f infra/compose.yml up -d --wait postgres
```

### 터미널 B — sample-service

```powershell
cd D:\MyProjectTemplate
$env:JAVA_HOME='C:\Program Files\Java\jdk-21'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
./gradlew :services:sample-service:bootRun --args='--spring.profiles.active=local'
```

### 터미널 C — Gateway

```powershell
cd D:\MyProjectTemplate
$env:JAVA_HOME='C:\Program Files\Java\jdk-21'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
./gradlew :services:gateway-service:bootRun
```

다른 터미널에서 Gateway API가 성공하는지 먼저 확인한다.

```powershell
Invoke-RestMethod http://localhost:8080/api/v1/items
```

이 명령이 실패하면 프론트엔드를 켜도 같은 API가 실패하므로 먼저 백엔드를 해결한다.

## 4. 프론트 의존성 설치

### 최초 한 번 또는 lockfile 변경 뒤

```powershell
cd D:\MyProjectTemplate
pnpm install --frozen-lockfile
```

루트 `pnpm-workspace.yaml`은 다음을 한 workspace로 관리한다.

- `apps/web`: 실제 브라우저 SPA
- `packages/api-client`: Gateway URL, request ID와 Problem Detail 해석

`tools/configurator`는 기존 npm lockfile과 배포 흐름을 유지하기 때문에 이 pnpm workspace에 포함하지 않는다.

## 5. 개발 서버 실행

### 터미널 D

```powershell
cd D:\MyProjectTemplate
pnpm web:dev
```

정상 로그에 `http://localhost:5173`이 표시된다. 브라우저에서 <http://localhost:5173>을 연다.

화면에서 확인할 것:

1. 상단 환경 표시가 `LOCAL`이다.
2. 요청 경로에 브라우저 → Gateway → sample-service → PostgreSQL이 보인다.
3. `저장된 항목`이 로딩 뒤 목록 또는 빈 화면으로 바뀐다.
4. 새 항목 이름을 입력하고 `writer DB에 저장`을 누른다.
5. 생성한 항목이 목록 첫 줄에 보인다.

## 6. 화면 상태의 뜻

| 화면 | 의미 | 다음 확인 |
|---|---|---|
| `요청 중` | GET 또는 갱신 요청 진행 중 | 잠시 기다림 |
| 빈 목록 | API는 성공했지만 데이터가 0건 | 항목 하나 생성 |
| `확인 필요` | Gateway 또는 서비스 요청 실패 | 오류의 request ID와 백엔드 health 확인 |
| 생성 성공 | POST가 writer DB에 저장됨 | 목록 첫 줄 확인 |
| 설정 오류 | `app-config.json`을 읽거나 검증하지 못함 | JSON 문법과 환경 값 확인 |

오류에 request ID가 표시되면 Gateway와 sample-service 로그에서 같은 값을 검색해 한 요청의 흐름을 찾는다.

## 7. local/dev/prod API 설정

프론트는 시작할 때 `apps/web/public/app-config.json`을 읽는다.

```json
{
  "environment": "local",
  "apiBaseUrl": ""
}
```

`apiBaseUrl`이 빈 값이면 브라우저와 같은 origin의 `/api`를 사용한다.

- local 개발: Vite proxy가 `/api`를 `http://localhost:8080`으로 전달
- dev: `app-config.dev.example.json`처럼 같은 origin ingress를 우선 사용. 별도 Gateway HTTPS URL이면 해당 Gateway의 명시적 CORS 정책 필요
- prod: 같은 origin ingress 권장. 외부 URL이면 HTTPS 사용

prod 설정은 `localhost`, 평문 HTTP, URL 안의 사용자 이름 또는 비밀번호를 거부한다. client secret, access token과 운영 비밀번호는 이 JSON이나 프론트 번들에 넣지 않는다.

배포에서는 빌드 산출물의 `app-config.json`을 환경별 설정으로 교체하거나 mount한다. 이렇게 하면 같은 불변 프론트 이미지를 dev/prod에서 다시 빌드하지 않고 사용할 수 있다.

## 8. production build 확인

```powershell
cd D:\MyProjectTemplate
pnpm web:build
```

결과는 `apps/web/dist`에 생성된다. 로컬에서 산출물을 미리 보려면:

```powershell
pnpm --filter @myprojecttemplate/web preview
```

브라우저에서 <http://localhost:4173>을 연다. 이 저장소의 preview 설정도 로컬 `/api`를 Gateway `:8080`으로 전달한다. 실제 운영에서는 Vite preview server를 사용하지 않고 정적 파일 서버/CDN과 Gateway routing을 구성한다.

## 9. 자동 검증

프론트 전체 검사:

```powershell
cd D:\MyProjectTemplate
pnpm frontend:check
```

이 명령은 다음을 순서대로 실행한다.

1. 공통 API client TypeScript 검사
2. API 성공·생성·Problem Detail·request ID 테스트
3. 웹 TypeScript 검사
4. 로딩·목록·오류 안내 컴포넌트 테스트
5. production build

## 10. 자주 생기는 문제

| 증상 | 확인 | 해결 |
|---|---|---|
| `pnpm` 명령 없음 | `corepack --version` | Corepack으로 pnpm 11.10.0 활성화 |
| 5173 포트 사용 중 | `Get-NetTCPConnection -LocalPort 5173` | 기존 Vite를 종료한 뒤 재실행 |
| 화면은 열리지만 `확인 필요` | Gateway health | `:8080` Gateway와 `:8081` 서비스 실행 |
| Gateway만 8082 사용 | Vite proxy 대상 | 아래처럼 현재 터미널의 `GATEWAY_PROXY_TARGET`을 설정하고 `pnpm web:dev` 실행 |
| 설정 오류 화면 | `public/app-config.json` | JSON 문법, environment와 URL 안전 규칙 확인 |
| POST validation 오류 | 이름 길이와 공백 | 1~120자의 이름 입력 |
| production에서 localhost 거부 | prod `apiBaseUrl` | 같은 origin 또는 실제 HTTPS Gateway 사용 |

Gateway 기본 포트 `8080`이 충돌해 `8082`로 실행했다면 프론트 터미널에서 다음처럼 로컬 proxy 대상만 바꾼다.

```powershell
$env:GATEWAY_PROXY_TARGET='http://localhost:8082'
pnpm web:dev
```

이 환경변수는 Vite 개발/미리보기 서버의 로컬 proxy에만 사용되며 브라우저 production bundle에 포함되지 않는다.

## 11. 종료

프론트 터미널 D에서 `Ctrl+C`를 누른다. 그다음 Gateway와 sample-service 터미널에서 각각 `Ctrl+C`를 누르고, 마지막에 Docker를 내린다.

```powershell
docker compose --env-file infra/.env.versions -f infra/compose.yml down
```

`down`은 DB volume을 보존한다. 데이터를 정말 삭제하려는 경우가 아니면 `down -v`를 사용하지 않는다.

## 아직 구현하지 않은 것

- OIDC 로그인·갱신·로그아웃
- Gateway/BFF token 처리 결정
- OpenAPI에서 TypeScript client 자동 생성
- 브라우저 E2E와 백엔드 계약 검증
- 프론트 독립 컨테이너와 운영 ingress 예제
- SSR adapter

이 항목은 구현과 테스트가 추가된 뒤에만 완료로 표시한다.
