---
id: 0022-equals를-재정의하면-왜-hashCode도-재정의해
topic: "Java · Spring"
kind: concept
source: mock
from: "미리디 기술 스크리닝 음성 모의면접 — CS 전체"
parent: null
created: 2026-11-25
---
equals를 재정의하면 왜 hashCode도 재정의해야 하나요?

## 참고 답안
**같은 객체는 같은 해시코드**여야 한다는 계약이 있는데, 이걸 어기면 `HashMap`·`HashSet`에서 같은 값인데 다른 버킷으로 가서 **못 찾습니다**.
