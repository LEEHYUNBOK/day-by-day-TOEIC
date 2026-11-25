---
id: 0024-Transactional이-적용되지-않는-경우가-있나요
topic: "Java · Spring"
kind: concept
source: mock
from: "미리디 기술 스크리닝 음성 모의면접 — CS 전체"
parent: null
created: 2026-11-25
---
@Transactional이 적용되지 않는 경우가 있나요?

## 참고 답안
프록시 기반이라 **같은 클래스 안에서 자기 메서드를 직접 호출**하면 프록시를 안 거쳐 트랜잭션이 안 걸립니다. `private` 메서드도 마찬가지입니다.
