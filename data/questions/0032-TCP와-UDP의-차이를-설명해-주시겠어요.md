---
id: 0032-TCP와-UDP의-차이를-설명해-주시겠어요
topic: "네트워크 · API · 분산"
kind: concept
source: mock
from: "미리디 기술 스크리닝 음성 모의면접 — CS 전체"
parent: null
created: 2026-11-25
---
TCP와 UDP의 차이를 설명해 주시겠어요?

## 참고 답안
TCP는 **연결형**으로 3-way handshake로 연결을 맺고 순서 보장·재전송·흐름 제어를 합니다. UDP는 **비연결형**으로 보장이 없는 대신 빠르고 오버헤드가 작습니다. 실시간 스트리밍·게임처럼 **늦은 데이터가 무의미한** 곳에 UDP를 씁니다.
