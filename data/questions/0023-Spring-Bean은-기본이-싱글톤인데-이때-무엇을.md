---
id: 0023-Spring-Bean은-기본이-싱글톤인데-이때-무엇을
topic: "Java · Spring"
kind: concept
source: mock
from: "미리디 기술 스크리닝 음성 모의면접 — CS 전체"
parent: null
created: 2026-11-25
---
Spring Bean은 기본이 싱글톤인데, 이때 무엇을 조심해야 하나요?

## 참고 답안
모든 요청이 **같은 인스턴스**를 쓰므로 **필드에 상태를 두면 안 됩니다**. 두는 순간 요청 간에 값이 섞이는 경쟁 상태가 됩니다.
