# day-by-day TOEIC

하루에 한 세트씩 토익 필수 단어와 문장을 학습하는 웹앱이다. 매일 정해진 콘텐츠(단어 10개, 문장 5개)를 단어 퀴즈·빈칸 채우기·문장 조합 세 가지 방식으로 풀고, 달력에서 진도를 확인하고, 오답과 지난 학습을 복습할 수 있다.

## 시작하기

```bash
npm install
npm run dev       # http://localhost:3000
```

### 테스트 / 데이터 검증 / 빌드

```bash
npm test               # vitest 유닛 테스트
npm run validate-data  # public/data 스키마·정합성 검증
npm run build           # production 빌드
npx tsc --noEmit        # 타입 체크
npx eslint .            # 린트
```

## 학습 콘텐츠 추가하기

콘텐츠는 `public/data/`에 정적 JSON으로 둔다. 앱은 반드시 `lib/contentRepo.ts`(`fetchIndex`, `fetchDay`)를 통해서만 읽는다 — localStorage나 fetch를 직접 호출하는 코드를 새로 추가하지 않는다.

```
public/data/
  index.json        # 날짜 → title 목록 (전체 날짜의 인덱스)
  days/
    2026-08-04.json # 날짜별 학습 콘텐츠 1일치
    ...
```

### `index.json`

```json
{
  "days": [
    { "date": "2026-08-04", "title": "Day 1 — 계약과 협상" }
  ]
}
```

`days[].date`는 `days/` 아래 같은 이름의 파일과 반드시 짝을 이뤄야 한다(`npm run validate-data`가 양방향으로 검사한다).

### `days/YYYY-MM-DD.json`

```json
{
  "date": "2026-08-04",
  "title": "Day 1 — 계약과 협상",
  "words": [
    {
      "id": "w-negotiate",
      "word": "negotiate",
      "pos": "v.",
      "meaning": "협상하다",
      "example": "We need to negotiate the terms of the contract.",
      "exampleKo": "우리는 계약 조건을 협상해야 한다."
    }
  ],
  "sentences": [
    {
      "id": "s-0804-1",
      "text": "The manager will negotiate the contract next week.",
      "ko": "매니저가 다음 주에 계약을 협상할 것이다.",
      "blankWord": "negotiate",
      "distractors": ["recruit", "renovate", "relocate"]
    }
  ]
}
```

- `words`는 정확히 10개, `sentences`는 정확히 5개여야 한다.
- `words[].id`, `sentences[].id`는 **전체 데이터셋을 통틀어** 고유해야 한다(하루 안에서만이 아니라 모든 날짜 파일에 걸쳐 유일해야 함).
- `sentences[].distractors`는 정확히 3개여야 한다.

위 항목들은 `scripts/validate-data.mjs`가 자동으로 검사한다(`npm run validate-data`). 하지만 검증 스크립트가 **잡아주지 않는** 규칙들이 있고, 이는 리뷰 과정에서 실제로 문제가 됐던 것들이므로 콘텐츠를 작성할 때 직접 지켜야 한다.

- **`blankWord`는 `text` 안에 정확히 대소문자까지 일치하는 단독 토큰으로 정확히 1번 등장해야 하고, 문장 맨 앞 단어여서는 안 된다.** 빈칸 처리와 검증 모두 대소문자를 구분하는 완전 일치로 동작하기 때문에, `blankWord`가 문장 첫 단어라서 대문자로 시작하면(`Negotiate`처럼) 소문자 `blankWord`("negotiate")와 일치하지 않아 검증이 실패한다.
- **오답(distractor)은 빈칸에 넣었을 때 명백히 틀려야 한다.** 정답 외의 어떤 보기를 넣어도 문법적으로나 의미적으로 말이 되는 문장이 되면 안 된다.
- **동시에 오답은 그럴듯해야 한다.** 실제로 쓰이는 비즈니스 영어 단어여야 하고, 철자·발음·의미 중 하나로 정답과 헷갈릴 만해야 한다. 보자마자 답이 아님을 알 수 있는 단어는 학습 효과가 없다.
- **문장 조합(arrange) 모드는 `text`를 단어 단위로 흩었다가 원문 그대로 재조립하는 것을 정답으로 판정한다.** 따라서 다른 어순으로 배열해도 문법적으로 성립하는 문장은 피한다(정답이 여러 개가 되어버린다).

## 프로젝트 구조

```
app/            Next.js App Router 페이지 (홈, 달력, 학습, 복습, 오답노트, 통계)
components/     화면에서 재사용하는 UI 컴포넌트 (달력, 퀴즈 카드, 세션 진행 등)
lib/            도메인 로직 — 콘텐츠/진도 저장소, 날짜 유틸, 퀴즈 생성, 채점
public/data/    학습 콘텐츠 (JSON, 위 스키마 참고)
scripts/        `validate-data.mjs` 등 저장소 정합성 검사 스크립트
tests/          vitest 유닛 테스트 (lib 위주)
```

## 데이터 저장 방식

학습 진도(완료 기록, 오답노트, 복습 기록)는 브라우저 `localStorage`에만 저장된다. 서버나 별도 DB는 없다.

- `lib/contentRepo.ts` — 학습 콘텐츠를 읽는 유일한 창구(`fetchIndex`, `fetchDay`). 지금은 `public/data`의 정적 JSON을 fetch하지만, 나중에 백엔드 API로 교체한다면 이 파일만 바꾸면 된다.
- `lib/progressRepo.ts` — 진도를 읽고 쓰는 유일한 창구(`getDayRecords`, `saveDayRecord`, `getWrongNotes`, `addWrongNote`, `resolveWrongNote`, `getReviewRecords`, `addReviewRecord`, `calcStreak`). 지금은 `localStorage`를 감싸고 있지만, 서버 동기화가 필요해지면 이 파일이 그 접점이 된다.
