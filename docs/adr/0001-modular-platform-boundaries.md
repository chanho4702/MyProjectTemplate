# ADR 0001 — 기능별 platform starter 경계

- 상태: Accepted
- 결정일: 2026-08-16

## 문제

재사용 템플릿이 Redis, Kafka, 검색과 보안을 한 의존성으로 묶으면 사용하지 않는 인프라까지 서비스에 들어간다. 서로 다른 전달 보장과 장애 의미도 하나의 모호한 인터페이스에 섞인다.

## 결정

- Web, Data JPA, Redis, Kafka, Search, Security와 Observability를 독립 starter로 유지한다.
- 외부 인프라 adapter는 해당 starter 의존성과 `platform.<feature>.enabled=true`가 함께 있을 때만 활성화한다.
- 공통 starter에는 특정 제품의 비즈니스 도메인 타입을 넣지 않는다.
- Redis cache, Kafka event, 검색 gateway처럼 의미가 다른 포트를 분리한다.
- 모든 기능을 한 번에 포함하는 `starter-all`은 만들지 않는다.

## 결과

서비스는 필요한 기능만 선택할 수 있고, adapter를 교체해도 비즈니스 코드의 포트를 유지할 수 있다. 대신 서비스마다 의존성과 활성화 설정을 명시해야 하며 조합별 계약 테스트가 필요하다.

## 검토한 대안

### 하나의 통합 starter

초기 설정은 짧아지지만 불필요한 SDK, 자동 설정과 운영 인프라가 함께 들어가므로 선택하지 않았다.

### 하나의 범용 메시지 인터페이스

Redis Streams, Kafka와 cloud queue의 재처리·순서·보존 의미가 달라 안전한 대체가 아니므로 선택하지 않았다.

## 검증

- starter 단위 테스트
- starter를 선택적으로 포함한 sample-service 빌드
- 구성 마법사와 서비스 생성기의 의존성 선택 결과

## 보장하지 않는 범위

starter 경계는 Redis failover, Kafka 무손실 처리나 검색 성능을 자동으로 보장하지 않는다. 각 adapter는 실제 인프라와 장애 조건에서 별도로 검증한다.
