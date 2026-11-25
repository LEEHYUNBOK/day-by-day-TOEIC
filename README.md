# 데일리 CS

면접 질문을 매일 공부하고, 설명해 보며 이해도를 기록하는 로컬 앱이다.

## 실행

```bash
npm install
npm run dev       # http://127.0.0.1:3000
```

## 질문 가져오기

```bash
npm run import -- "<RESUME 경로>"
```

## 채점

Claude Code에서 `/채점`을 실행한다.

## 데이터

모든 기록은 프로젝트 루트의 `data/` 폴더에 파일로 저장된다. 서버나 외부 DB는 없다. 녹음 파일(`data/**/*.webm`)은 git에서 제외된다.

## 테스트 / 빌드

```bash
npm test
npm run build
npm run lint
```
