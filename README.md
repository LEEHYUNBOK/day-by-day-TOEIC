# day-by-day TOEIC

토익 필수 단어·문장을 간격 반복(spaced repetition)으로 익히는 단어 게임이다. 접속하면 대기 화면 없이 바로 문제가 나오고, 한 판은 20문항이다. 틀린 문항은 내일 다시 나오고, 맞힌 문항은 3일 → 7일 → 14일 간격으로 점점 뜸하게 나오다가 마지막 단계에서 한 번 더 맞히면 졸업한다.

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

## 화면

- **`/` (게임)** — 앱의 메인. 오늘 복습할 항목과 새 항목을 섞어 20문항짜리 판을 만들어 곧바로 출제한다. 오늘 낼 게 없으면 "오늘 할 게 없어요"와 내일 예정 개수를 보여준다. 판 중간에 나가면 아무것도 기록되지 않는다.
- **`/vocab` (단어장)** — 학습 중인 카드를 단계·다음 복습일과 함께 보여주고, 졸업한 항목을 따로 모아 보여준다.
- **`/stats` (통계)** — 연속 학습일, 졸업 수, 학습 중 개수, 단계별 분포, 세션 기록(최신순)을 보여준다.

## 간격 반복 규칙

정답/오답에 따라 카드가 상자(box) 사이를 이동한다 (`lib/srs.ts`).

| 현재 상태 | 결과 | 다음 상태 |
| --- | --- | --- |
| 신규 또는 임의 단계 | 오답 | box 0, 내일 재출제 |
| 신규 또는 box 0 | 정답 | box 1, 3일 후 |
| box 1 | 정답 | box 2, 7일 후 |
| box 2 | 정답 | box 3, 14일 후 |
| box 3 | 정답 | 졸업 (더 이상 출제 안 함) |

## 프로젝트 구조

```
app/            Next.js App Router 페이지 (게임, 단어장, 통계)
components/     화면에서 재사용하는 UI 컴포넌트 (게임 진행, 퀴즈 카드 등)
lib/            도메인 로직 — 콘텐츠/SRS 저장소, 날짜 유틸, 퀴즈 생성, 큐 구성
public/data/    학습 콘텐츠 (JSON, 위 스키마 참고)
scripts/        `validate-data.mjs` 등 저장소 정합성 검사 스크립트
tests/          vitest 유닛 테스트 (lib 위주)
```

## 데이터 저장 방식

학습 진도는 브라우저 `localStorage`에만 저장된다. 서버나 별도 DB는 없다.

- `lib/contentRepo.ts` — 학습 콘텐츠를 읽는 유일한 창구(`fetchIndex`, `fetchDay`). 지금은 `public/data`의 정적 JSON을 fetch하지만, 나중에 백엔드 API로 교체한다면 이 파일만 바꾸면 된다.
- `lib/srsRepo.ts` — SRS 진도를 읽고 쓰는 유일한 창구(`getCards`, `getMastered`, `getSessions`, `commitSession`, `calcStreak`, `countDueOn`). 지금은 `localStorage`를 감싸고 있지만, 서버 동기화가 필요해지면 이 파일이 그 접점이 된다.
- 쓰는 키는 `ddt.srs`(학습 중인 카드), `ddt.mastered`(졸업한 항목), `ddt.sessions`(세션 기록) 세 개다.
- v1(날짜별 커리큘럼)에서 쓰던 `ddt.dayRecords`, `ddt.wrongNotes`, `ddt.reviewRecords` 키는 더 이상 쓰지 않으며, 마이그레이션도 하지 않는다.
