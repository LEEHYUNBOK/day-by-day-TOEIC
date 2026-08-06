# day-by-day TOEIC — 단어 게임 + 간격 반복 전환 설계

- 작성일: 2026-08-06
- 상태: 사용자 승인 완료 (구현 전)
- 선행 스펙: `2026-08-04-toeic-daily-frontend-design.md` (v1, 구현 완료)

## 1. 왜 바꾸는가

v1은 **날짜별 커리큘럼**으로 만들었다. 8월 6일에 접속하면 Day 3 콘텐츠를 단어 10개 + 문장 5개로 한 번 훑고 끝나는 구조다. 틀린 문제는 오답노트에 쌓이지만, 다시 풀려면 사용자가 직접 복습 탭을 눌러야 한다.

실제로 원하는 것은 다르다:

1. **단어 맞추기 게임이 앱의 중심**이다. 접속하면 바로 문제가 나와야 한다.
2. **틀린 단어는 알아서 며칠 뒤 다시 나와야 한다.** 사용자가 복습을 기억하고 챙기는 게 아니라, 앱이 일정을 관리한다.
3. **처음 접속한 사람에게 빈 대시보드를 보여주지 않는다.** 기록이 없으면 보여줄 게 없고, 기록은 브라우저에 저장된 것을 읽는다.

즉 날짜 커리큘럼을 버리고 **간격 반복 큐(spaced repetition)** 로 대체한다.

## 2. 유지 / 폐기

**유지**
- 14일치 시드 콘텐츠 (`public/data/`) — 그대로. 단어 140개, 문장 70개
- `lib/quiz.ts` — 문항 생성 로직 전부 (`buildWordQuiz`, `buildBlankQuiz`, `buildArrangeQuiz`, `shuffle`)
- `lib/contentRepo.ts` — 콘텐츠 조회
- `lib/date.ts`, `lib/types.ts` — 확장은 하되 유지
- `components/QuizCard.tsx`, `ArrangeCard.tsx` — 문항 UI
- `/stats` — 성격만 조정

**폐기**
- `/calendar` (`app/calendar/page.tsx`), `components/MonthCalendar.tsx`
- `/learn/[date]` 및 그 결과 페이지, `components/SessionRunner.tsx`
- `/review` (`app/review/page.tsx`) — 큐가 복습을 대신한다
- `/notes` (`app/notes/page.tsx`) — `/vocab`으로 대체
- `components/WordBrowse.tsx` — 단어 훑기 단계가 없어진다
- `lib/session.ts`의 `scoreOf`는 유지 (결과 화면에서 계속 필요)

## 3. 데이터 모델

### 3.1 새 저장소 — `ddt.srs`

```ts
export type Box = 0 | 1 | 2 | 3;

export interface SrsCard {
  itemId: string;        // 'w-negotiate' 또는 's-0804-1'
  type: QuizType;        // 'word' | 'blank' | 'arrange'
  sourceDate: string;    // 이 항목이 든 day 파일의 날짜 (원문 조회용)
  box: Box;              // 0=신규 또는 직전 오답
  dueDate: string;       // YYYY-MM-DD, 이 날부터 출제 대상
}
```

`localStorage` 키 `ddt.srs`에 `SrsCard[]`로 저장한다. `(type, itemId)`가 카드의 신원이다 — 한 문장이 `blank`와 `arrange` 두 카드를 가질 수 있다.

**졸업한 카드는 배열에서 제거한다.** 대신 졸업 수를 세기 위해 별도 카운터를 두지 않고, `ddt.mastered`에 졸업한 `(type, itemId)` 목록을 저장한다 — 통계에 필요하고, 이미 졸업한 항목이 신규로 다시 나오는 것을 막는다.

### 3.2 세션 기록 — `ddt.sessions`

```ts
export interface SessionRecord {
  finishedAt: string;  // ISO
  date: string;        // YYYY-MM-DD (로컬)
  correct: number;
  total: number;
}
```

스트릭과 통계는 이 배열에서 계산한다. v1의 `DayRecord`(날짜별 커리큘럼 완료)를 대체한다.

### 3.3 폐기되는 타입

`DayRecord`, `WrongNote`, `ReviewRecord`와 대응하는 `localStorage` 키 (`ddt.dayRecords`, `ddt.wrongNotes`, `ddt.reviewRecords`)는 더 쓰지 않는다. **마이그레이션하지 않는다** — 기존 기록은 개발자 본인의 테스트 데이터 몇 건이고, 구조가 달라 옮기는 코드가 옮기는 값보다 비싸다. 낡은 키는 읽지도 지우지도 않고 그대로 방치한다.

## 4. 간격 반복 규칙

`lib/srs.ts`의 순수 함수로 구현한다.

| 현재 상태 | 결과 | 다음 box | 다음 dueDate |
|---|---|---|---|
| 신규 (카드 없음) | 맞힘 | 1 | 오늘 + 3일 |
| 신규 (카드 없음) | 틀림 | 0 | 오늘 + 1일 |
| box 0 | 맞힘 | 1 | 오늘 + 3일 |
| box 1 | 맞힘 | 2 | 오늘 + 7일 |
| box 2 | 맞힘 | 3 | 오늘 + 14일 |
| box 3 | 맞힘 | — | **졸업** (카드 제거, `ddt.mastered`에 추가) |
| box 0~3 | 틀림 | 0 | 오늘 + 1일 |

핵심 성질:
- 틀리면 어느 단계에서든 box 0으로 떨어지고 내일 다시 나온다
- 처음 보는 항목을 맞히면 box 1에서 시작한다 (0을 거치지 않음)
- 졸업까지 최소 4번 맞혀야 한다 (신규 → 1 → 2 → 3 → 졸업)

## 5. 한 판 구성

한 판은 **20문항 고정**이다. `lib/queue.ts`의 순수 함수가 구성한다.

1. `dueDate <= 오늘`인 카드를 모은다. `dueDate` 오름차순(오래 밀린 것 먼저)으로 최대 20개.
2. 20자리가 남으면 **아직 카드가 없고 졸업하지도 않은** 항목으로 채운다. 순서는 day 파일 순서(2026-08-04 → 2026-08-17), 파일 내에서는 단어 전부 → 문장(blank) → 문장(arrange) 순.
3. 최종 20개를 셔플해서 출제한다.

결과:
- 첫 접속: 복습 0개 + 신규 20개 → Day 1의 단어 10개, 문장 5개(blank), 문장 5개(arrange)
- 복습이 20개를 넘는 날: 신규 없음. 밀린 것을 먼저 갚는다
- 남은 신규가 20개 미만이면 있는 만큼만 (전부 졸업하면 복습만, 복습도 없으면 "오늘 할 게 없어요")

`buildWordQuiz`는 오답 보기를 만들 풀이 부족하면 예외를 던진다. 따라서 **항상 전체 140단어를 `pool`로 넘긴다** — 이 규칙은 v1에서 실제 크래시 원인이었다.

## 6. 틀렸을 때 답을 보여주는 방식

"틀리면 답을 알려준다"가 이 앱의 핵심 요구다. 현재 `QuizCard`는 정답 보기에 "✓ 정답" 배지만 붙인다. 부족하다.

- **단어 문항을 틀리면** 정답 표시 아래에 그 단어의 `word`, `pos`, `meaning`, `example`, `exampleKo`를 펼쳐 보여준다.
- **문장 빈칸을 틀리면** 완성된 문장 원문(`text`)과 한글 해석(`ko`)을 보여준다.
- **문장 조합을 틀리면** 이미 정답 문장을 보여주고 있다 (`ArrangeCard`) — 여기에 `ko`를 추가한다.
- 맞혔을 때는 펼치지 않는다. 흐름을 끊지 않는 게 낫다.

`QuizCard`에 선택적 `explanation?: ReactNode` prop을 추가하고, 틀렸을 때만 렌더한다. 컴포넌트가 콘텐츠 타입을 알 필요는 없다.

## 7. 화면

| 경로 | 내용 |
|---|---|
| `/` | **게임.** 접속 즉시 첫 문항. 상단에 진행바와 나가기. 20문항 후 결과 화면 |
| `/vocab` | 내 단어장. `ddt.srs` 카드를 단계·다음 출제일과 함께 표시. 졸업한 항목은 별도 섹션 |
| `/stats` | 🔥 연속 학습, 졸업한 단어 수, 학습 중 개수, 내일 볼 개수, 최근 세션별 정답률 |

`/` 는 클라이언트에서 `ddt.srs`를 읽어야 하므로, 데이터를 불러오는 동안 스피너를 띄우고 그 뒤 첫 문항으로 들어간다. **로딩 중에도 대시보드나 통계를 보여주지 않는다.**

결과 화면에 담을 것:
- 정답률 (첫 시도 기준)
- 틀린 항목 목록 (원문 + 정답)
- 졸업한 항목이 있으면 축하 표시
- **내일 볼 단어 개수** — 다음 접속의 이유를 만든다
- "한 판 더" (남은 항목이 있을 때만) / "통계 보기"

네비게이션은 3개(홈·단어장·통계)로 줄인다. 게임 진행 중에는 v1처럼 숨긴다.

## 8. 채점

- 문항별 **첫 시도**만 SRS 상태 갱신과 정답률에 반영한다 (v1과 동일)
- v1의 "세션 끝 재도전" 단계는 **없앤다**. 틀린 항목은 내일 다시 나오므로 같은 판에서 또 물어볼 이유가 없다. 이게 간격 반복의 요점이다.
- **SRS 갱신은 한 판이 끝나는 순간 한 번에 적용한다.** 문항을 풀 때마다 저장하지 않는다. 진행 중에는 답안을 메모리에만 쌓아두고, 마지막 문항을 넘기는 시점에 20개 카드의 box/dueDate를 계산해 한 번에 저장한다.
- 한 판을 끝내면 `SessionRecord` 하나를 기록한다. 중간에 나가면 아무것도 기록하지 않는다 — 세션 기록도, SRS 갱신도 없다 (전부 아니면 전무). 이 규칙이 위의 일괄 저장과 같은 이야기다.

## 9. 파일 구조 변경

```
app/
  page.tsx              # 게임 (전면 교체)
  vocab/page.tsx        # 내 단어장 (신규)
  stats/page.tsx        # 통계 (개편)
components/
  GameRunner.tsx        # 한 판 진행 (신규, SessionRunner 대체)
  QuizCard.tsx          # explanation prop 추가
  ArrangeCard.tsx       # ko 표시 추가
  Nav.tsx               # 링크 3개로
lib/
  srs.ts                # 간격 반복 규칙 (신규, 순수 함수)
  queue.ts              # 한 판 구성 (신규, 순수 함수)
  srsRepo.ts            # ddt.srs / ddt.mastered / ddt.sessions (신규)
  types.ts              # SrsCard, Box, SessionRecord 추가; DayRecord/WrongNote/ReviewRecord 제거
  quiz.ts               # 변경 없음
  contentRepo.ts        # 변경 없음
  date.ts               # 변경 없음
  session.ts            # scoreOf만 남김
  progressRepo.ts       # 삭제 (srsRepo가 대체)
tests/
  srs.test.ts           # 신규
  queue.test.ts         # 신규
  srsRepo.test.ts       # 신규 (progressRepo.test.ts 대체)
  quiz.test.ts, date.test.ts, session.test.ts  # 유지
```

삭제: `app/calendar/`, `app/learn/`, `app/review/`, `app/notes/`, `components/MonthCalendar.tsx`, `components/SessionRunner.tsx`, `components/WordBrowse.tsx`, `lib/progressRepo.ts`, `tests/progressRepo.test.ts`

## 10. 엣지 케이스

- **모든 항목 졸업 + 복습 없음** → "오늘 할 게 없어요. 내일 N개 볼 예정이에요" + 통계 링크
- **복습만 있고 신규 소진** → 복습만으로 한 판 (20개 미만이면 있는 만큼)
- **저장소가 깨진 경우** → 빈 값으로 시작 (v1의 `load()` 패턴 유지)
- **한 판 중 이탈** → 아무것도 기록하지 않는다. 다시 들어오면 큐를 새로 구성한다
- **날짜가 바뀌는 자정 경과** → 판을 시작할 때 계산한 `todayStr()`을 그 판 내내 쓴다. 판 중간에 날짜가 바뀌어도 일관되게 동작한다
- **`ddt.mastered`에 있는 항목** → 신규 후보에서 제외한다

## 11. 테스트

- `lib/srs.ts` — 표 4의 모든 전이를 유닛 테스트. 특히 "틀리면 어느 box에서든 0/내일"과 "box 3 맞힘 → 졸업"
- `lib/queue.ts` — 복습 우선, 20개 상한, 신규 순서, 셔플 후에도 원소 보존, 복습 20개 초과 시 신규 0개, 후보 소진 시 20개 미만
- `lib/srsRepo.ts` — 저장/조회, 졸업 시 카드 제거 + mastered 추가, 깨진 저장소 처리
- 화면은 수동 확인 (v1과 동일하게 E2E는 두지 않는다)

## 12. 이번 범위 아님

- 로그인 / 서버 저장 — `srsRepo`와 `contentRepo`가 여전히 교체 지점이다
- 듣기(TTS), 토익 모의고사
- 간격 조정 UI (사용자가 1→3→7→14를 바꾸는 기능)
- v1 기록 마이그레이션 (3.3 참조)
