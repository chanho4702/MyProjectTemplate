# Architecture Decision Records

ADR은 중요한 기술 결정을 **왜 그렇게 했는지** 코드와 함께 남기는 기록이다. 나중에 구현이 바뀌더라도 당시의 문제, 선택지와 포기한 조건을 확인할 수 있게 한다.

## 상태

- `Proposed`: 검토 중이며 아직 기준이 아니다.
- `Accepted`: 현재 코드와 문서가 따라야 하는 기준이다.
- `Superseded`: 더 새로운 ADR이 대체했다. 삭제하지 않고 대체 ADR을 연결한다.
- `Deprecated`: 새 코드에는 적용하지 않지만 호환성 때문에 남아 있다.

## 작성 규칙

1. 파일명은 `NNNN-short-title.md` 형식을 사용한다.
2. 문제, 결정, 결과, 대안과 검증 방법을 반드시 기록한다.
3. 보장하지 않는 범위를 명시한다.
4. 기존 결정을 바꿀 때 이전 ADR을 수정해 역사를 지우지 않고 새 ADR로 대체한다.
5. 코드와 설정을 바꾸는 ADR은 같은 PR의 테스트와 사용자 문서를 연결한다.

## 목록

| ADR | 상태 | 결정 |
|---|---|---|
| [0001](0001-modular-platform-boundaries.md) | Accepted | 기능별 starter와 adapter 경계를 유지한다 |
| [0002](0002-frontend-runtime-boundary.md) | Accepted | 서비스 프론트는 Gateway와 런타임 설정을 경계로 사용한다 |
