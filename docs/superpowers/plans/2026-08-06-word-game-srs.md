# 단어 게임 + 간격 반복 전환 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 날짜별 커리큘럼 앱을 단어 맞추기 게임 + 간격 반복(spaced repetition) 앱으로 전환한다. 접속하면 바로 문제가 나오고, 틀린 항목은 앱이 알아서 며칠 뒤 다시 낸다.

**Architecture:** 간격 반복 규칙(`lib/srs.ts`)과 한 판 구성(`lib/queue.ts`)을 순수 함수로 만들고 유닛 테스트한다. 상태는 `lib/srsRepo.ts`가 localStorage에 저장한다. 화면은 게임(`/`), 내 단어장(`/vocab`), 통계(`/stats`) 세 개로 줄인다. 기존 콘텐츠 데이터와 `lib/quiz.ts`의 문항 생성 로직은 그대로 재사용한다.

**Tech Stack:** Next.js 16.3 (App Router) + React 19.2 + TypeScript + Tailwind CSS 4 + Vitest. 새 런타임 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-08-06-word-game-srs-design.md`

## Global Constraints

- 새 의존성 추가 금지. 상태 관리 라이브러리 금지 (React 기본 훅만). 차트 라이브러리 금지
- `public/data/` 아래 시드 콘텐츠는 **변경 금지** — 14일치, 단어 140개, 문장 70개 완성본
- `lib/quiz.ts`, `lib/contentRepo.ts`, `lib/date.ts`는 **변경 금지**
- `buildWordQuiz(words, pool, rng)`는 pool이 서로 다른 오답 뜻 3개를 못 주면 **예외를 던진다**. 항상 전체 140단어를 `pool`로 넘길 것
- 카드 신원은 `(type, itemId)` 쌍. 한 문장은 `blank`·`arrange` 두 카드를 가진다
- 간격: 틀림 → box 0, 내일 / box 0·신규 맞힘 → box 1, +3일 / box 1 → box 2, +7일 / box 2 → box 3, +14일 / box 3 맞힘 → 졸업
- 한 판 20문항 고정. 복습(dueDate ≤ 오늘) 먼저, 남는 자리를 신규로, 최종 셔플
- 채점은 **첫 시도만**. 판 끝에 재도전 단계 없음
- SRS 갱신과 세션 기록은 **판이 끝날 때 한 번에** 저장. 중간 이탈 시 아무것도 기록하지 않음
- 판을 시작할 때 계산한 `todayStr()`을 그 판 내내 사용 (자정 경과 대응)
- 모든 사용자 노출 문구는 한국어
- 데이터 접근은 `lib/contentRepo.ts` / `lib/srsRepo.ts`만 통한다 — 화면에서 직접 `fetch`·`localStorage` 금지
- UI 태스크(Task 5~8) 구현자는 코드 작성 전에 `frontend-design` 스킬을 로드할 것
- v1 기록(`ddt.dayRecords`, `ddt.wrongNotes`, `ddt.reviewRecords`)은 마이그레이션하지 않고 방치한다

## 파일 구조

```
app/
  page.tsx              # 게임 (전면 교체) — Task 6
  vocab/page.tsx        # 내 단어장 (신규) — Task 7
  stats/page.tsx        # 통계 (개편) — Task 8
components/
  GameRunner.tsx        # 한 판 진행 (신규) — Task 6
  QuizCard.tsx          # explanation prop 추가 — Task 5
  ArrangeCard.tsx       # ko 표시 추가 — Task 5
  Nav.tsx               # 링크 3개로 — Task 8
lib/
  types.ts              # SrsCard/Box/SessionRecord 추가 — Task 1
  srs.ts                # 간격 반복 규칙 (순수) — Task 2
  queue.ts              # 한 판 구성 (순수) — Task 3
  srsRepo.ts            # localStorage 저장 — Task 4
  session.ts            # scoreOf 유지, 변경 없음
  quiz.ts, contentRepo.ts, date.ts   # 변경 금지
tests/
  srs.test.ts           # Task 2
  queue.test.ts         # Task 3
  srsRepo.test.ts       # Task 4
  quiz.test.ts, date.test.ts, session.test.ts   # 유지
```

**Task 9에서 삭제:** `app/calendar/`, `app/learn/`, `app/review/`, `app/notes/`, `components/MonthCalendar.tsx`, `components/SessionRunner.tsx`, `components/WordBrowse.tsx`, `lib/progressRepo.ts`, `tests/progressRepo.test.ts`

**삭제를 마지막에 두는 이유:** 옛 화면들이 `lib/progressRepo.ts`를 참조하므로 먼저 지우면 빌드가 깨진다. Task 8까지는 옛 화면이 존재하되 네비게이션에서만 빠지고, Task 9에서 한꺼번에 정리한다. 덕분에 모든 태스크 경계에서 `npm run build`가 통과한다.

---

### Task 1: 타입 추가

**Files:**
- Modify: `lib/types.ts`

**Interfaces:**
- Consumes: 기존 `QuizType`(`'word' | 'blank' | 'arrange'`)
- Produces (Task 2~8 전부가 사용):

```ts
export type Box = 0 | 1 | 2 | 3;

export interface SrsCard {
  itemId: string;      // 'w-negotiate' 또는 's-0804-1'
  type: QuizType;
  sourceDate: string;  // 이 항목이 든 day 파일의 날짜 (원문 조회용)
  box: Box;
  dueDate: string;     // YYYY-MM-DD, 이 날부터 출제 대상
}

export interface MasteredItem {
  itemId: string;
  type: QuizType;
  masteredAt: string;  // ISO
}

export interface SessionRecord {
  finishedAt: string;  // ISO
  date: string;        // YYYY-MM-DD (로컬)
  correct: number;
  total: number;
}
```

- [ ] **Step 1: 타입 추가**

`lib/types.ts` 파일 끝에 위 네 선언을 그대로 추가한다. 기존 `Word`, `Sentence`, `DayContent`, `DayIndexEntry`, `QuizType`은 손대지 않는다. `DayRecord`, `WrongNote`, `ReviewRecord`도 **아직 지우지 않는다** — 옛 화면들이 여전히 참조하며 Task 9에서 함께 정리한다.

- [ ] **Step 2: 타입 확인**

Run: `npx tsc --noEmit`
Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add lib/types.ts
git commit -m "feat: add SRS card and session types"
```

---

### Task 2: 간격 반복 규칙 (`lib/srs.ts`)

**Files:**
- Create: `lib/srs.ts`
- Test: `tests/srs.test.ts`

**Interfaces:**
- Consumes: `SrsCard`, `Box`, `QuizType` (Task 1), `addDays` (`lib/date.ts`)
- Produces:

```ts
export interface CardIdentity {
  itemId: string;
  type: QuizType;
  sourceDate: string;
}

// 졸업했으면 card가 null이고 mastered가 true
export interface SrsUpdate {
  card: SrsCard | null;
  mastered: boolean;
}

export function cardKey(type: QuizType, itemId: string): string;   // `${type}:${itemId}`
export function nextState(
  current: SrsCard | null,   // null = 아직 카드가 없는 신규 항목
  correct: boolean,
  today: string,            // YYYY-MM-DD
  identity: CardIdentity,
): SrsUpdate;
export const DUE_DAYS: Record<Box, number>;   // { 0: 1, 1: 3, 2: 7, 3: 14 }
```

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/srs.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { cardKey, nextState, DUE_DAYS } from '@/lib/srs';
import type { SrsCard, Box } from '@/lib/types';

const TODAY = '2026-08-06';
const id = { itemId: 'w-negotiate', type: 'word' as const, sourceDate: '2026-08-04' };
const card = (box: Box, dueDate = TODAY): SrsCard => ({ ...id, box, dueDate });

describe('cardKey', () => {
  it('joins type and itemId', () => {
    expect(cardKey('blank', 's-0804-1')).toBe('blank:s-0804-1');
  });
  it('distinguishes the two cards of one sentence', () => {
    expect(cardKey('blank', 's-0804-1')).not.toBe(cardKey('arrange', 's-0804-1'));
  });
});

describe('DUE_DAYS', () => {
  it('matches the spec intervals', () => {
    expect(DUE_DAYS).toEqual({ 0: 1, 1: 3, 2: 7, 3: 14 });
  });
});

describe('nextState — correct answers', () => {
  it('new item answered right starts at box 1, due in 3 days', () => {
    const r = nextState(null, true, TODAY, id);
    expect(r.mastered).toBe(false);
    expect(r.card).toEqual({ ...id, box: 1, dueDate: '2026-08-09' });
  });
  it('box 0 -> box 1, due in 3 days', () => {
    const r = nextState(card(0), true, TODAY, id);
    expect(r.card).toEqual({ ...id, box: 1, dueDate: '2026-08-09' });
  });
  it('box 1 -> box 2, due in 7 days', () => {
    const r = nextState(card(1), true, TODAY, id);
    expect(r.card).toEqual({ ...id, box: 2, dueDate: '2026-08-13' });
  });
  it('box 2 -> box 3, due in 14 days', () => {
    const r = nextState(card(2), true, TODAY, id);
    expect(r.card).toEqual({ ...id, box: 3, dueDate: '2026-08-20' });
  });
  it('box 3 answered right graduates', () => {
    const r = nextState(card(3), true, TODAY, id);
    expect(r.mastered).toBe(true);
    expect(r.card).toBeNull();
  });
});

describe('nextState — wrong answers', () => {
  it('new item answered wrong lands in box 0, due tomorrow', () => {
    const r = nextState(null, false, TODAY, id);
    expect(r.mastered).toBe(false);
    expect(r.card).toEqual({ ...id, box: 0, dueDate: '2026-08-07' });
  });
  it('resets to box 0 from every box', () => {
    for (const b of [0, 1, 2, 3] as Box[]) {
      const r = nextState(card(b, '2026-07-01'), false, TODAY, id);
      expect(r.card).toEqual({ ...id, box: 0, dueDate: '2026-08-07' });
      expect(r.mastered).toBe(false);
    }
  });
});

describe('nextState — identity and dates', () => {
  it('carries identity from the identity argument, not the old card', () => {
    const stale: SrsCard = { itemId: 'w-old', type: 'blank', sourceDate: '2026-01-01', box: 1, dueDate: TODAY };
    const r = nextState(stale, true, TODAY, id);
    expect(r.card).toMatchObject({ itemId: 'w-negotiate', type: 'word', sourceDate: '2026-08-04' });
  });
  it('computes dueDate from today, crossing a month boundary', () => {
    const r = nextState(card(2), true, '2026-08-31', id);
    expect(r.card!.dueDate).toBe('2026-09-14');
  });
  it('does not mutate the card passed in', () => {
    const original = card(1);
    const snapshot = { ...original };
    nextState(original, true, TODAY, id);
    expect(original).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/srs.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/srs"`

- [ ] **Step 3: 구현** — `lib/srs.ts`

```ts
import type { SrsCard, Box, QuizType } from './types';
import { addDays } from './date';

export interface CardIdentity {
  itemId: string;
  type: QuizType;
  sourceDate: string;
}

export interface SrsUpdate {
  card: SrsCard | null;
  mastered: boolean;
}

/** box에 도달했을 때 며칠 뒤에 다시 낼지 */
export const DUE_DAYS: Record<Box, number> = { 0: 1, 1: 3, 2: 7, 3: 14 };

export function cardKey(type: QuizType, itemId: string): string {
  return `${type}:${itemId}`;
}

/**
 * 한 문항의 답을 반영한 다음 상태를 돌려준다.
 * 틀리면 어느 단계에서든 box 0(내일)로 떨어진다. 맞히면 한 칸 올라가고,
 * box 3에서 맞히면 졸업한다. current가 null이면 아직 카드가 없는 신규 항목이다.
 */
export function nextState(
  current: SrsCard | null,
  correct: boolean,
  today: string,
  identity: CardIdentity,
): SrsUpdate {
  if (!correct) {
    return { card: { ...identity, box: 0, dueDate: addDays(today, DUE_DAYS[0]) }, mastered: false };
  }
  const nextBox = current === null ? 1 : current.box + 1;
  if (nextBox > 3) return { card: null, mastered: true };
  const box = nextBox as Box;
  return { card: { ...identity, box, dueDate: addDays(today, DUE_DAYS[box]) }, mastered: false };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/srs.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: 전체 스위트 + 커밋**

Run: `npm test`
Expected: 기존 22개 + 신규 13개 = 35개 통과

```bash
git add lib/srs.ts tests/srs.test.ts
git commit -m "feat: add spaced repetition scheduling rules"
```

---

### Task 3: 한 판 구성 (`lib/queue.ts`)

**Files:**
- Create: `lib/queue.ts`
- Test: `tests/queue.test.ts`

**Interfaces:**
- Consumes: `SrsCard`, `QuizType` (Task 1), `cardKey`, `CardIdentity` (Task 2), `shuffle` (`lib/quiz.ts`)
- Produces:

```ts
export const SESSION_SIZE = 20;

export function buildQueue(
  cards: SrsCard[],            // 현재 학습 중인 카드 전부
  candidates: CardIdentity[],  // 전체 후보, day 파일 순서로 정렬됨
  masteredKeys: Set<string>,   // cardKey() 형식
  today: string,
  size?: number,               // 기본 SESSION_SIZE
  rng?: () => number,          // 기본 Math.random
): CardIdentity[];
```

규칙:
1. `cards` 중 `dueDate <= today`인 것을 `dueDate` 오름차순으로 최대 `size`개
2. 자리가 남으면 `candidates` 중 **카드도 없고 졸업도 안 한** 항목으로 순서대로 채움
3. 합친 결과를 `shuffle`
4. 후보가 모자라면 `size`보다 적게 반환

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/queue.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { buildQueue, SESSION_SIZE } from '@/lib/queue';
import { cardKey } from '@/lib/srs';
import type { SrsCard, QuizType } from '@/lib/types';

const TODAY = '2026-08-06';
// 셔플을 결정적으로 만들되 정지 상태로 두지 않는 rng
const rng = () => { let i = 0; return () => ((i = (i + 3) % 7) / 7); };

const cand = (itemId: string, type: QuizType = 'word', sourceDate = '2026-08-04') =>
  ({ itemId, type, sourceDate });
const card = (itemId: string, dueDate: string, type: QuizType = 'word'): SrsCard =>
  ({ itemId, type, sourceDate: '2026-08-04', box: 1, dueDate });

const keys = (items: { itemId: string; type: QuizType }[]) =>
  items.map((i) => cardKey(i.type, i.itemId)).sort();

describe('SESSION_SIZE', () => {
  it('is 20', () => expect(SESSION_SIZE).toBe(20));
});

describe('buildQueue — new items only', () => {
  it('takes the first `size` candidates in order when there are no cards', () => {
    const candidates = Array.from({ length: 30 }, (_, i) => cand(`w-${i}`));
    const out = buildQueue([], candidates, new Set(), TODAY, 20, rng());
    expect(out).toHaveLength(20);
    expect(keys(out)).toEqual(keys(candidates.slice(0, 20)));
  });
  it('returns fewer than size when candidates run out', () => {
    const candidates = [cand('w-1'), cand('w-2')];
    const out = buildQueue([], candidates, new Set(), TODAY, 20, rng());
    expect(out).toHaveLength(2);
  });
  it('returns empty when there is nothing to do', () => {
    expect(buildQueue([], [], new Set(), TODAY, 20, rng())).toEqual([]);
  });
});

describe('buildQueue — due cards', () => {
  it('includes cards due today and overdue, excludes future ones', () => {
    const cards = [
      card('w-overdue', '2026-08-01'),
      card('w-today', TODAY),
      card('w-future', '2026-08-20'),
    ];
    const out = buildQueue(cards, [], new Set(), TODAY, 20, rng());
    expect(keys(out)).toEqual(keys([cand('w-overdue'), cand('w-today')]));
  });
  it('prefers the most overdue cards when more are due than fit', () => {
    const cards = [
      card('w-a', '2026-08-05'),
      card('w-b', '2026-08-01'),
      card('w-c', '2026-08-03'),
    ];
    const out = buildQueue(cards, [], new Set(), TODAY, 2, rng());
    expect(keys(out)).toEqual(keys([cand('w-b'), cand('w-c')]));
  });
  it('leaves no room for new items when due cards fill the session', () => {
    const cards = Array.from({ length: 25 }, (_, i) => card(`w-due-${i}`, '2026-08-01'));
    const out = buildQueue(cards, [cand('w-new')], new Set(), TODAY, 20, rng());
    expect(out).toHaveLength(20);
    expect(out.some((i) => i.itemId === 'w-new')).toBe(false);
  });
  it('fills the remainder with new items after due cards', () => {
    const cards = [card('w-due', '2026-08-01')];
    const candidates = [cand('w-new-1'), cand('w-new-2'), cand('w-new-3')];
    const out = buildQueue(cards, candidates, new Set(), TODAY, 3, rng());
    expect(keys(out)).toEqual(keys([cand('w-due'), cand('w-new-1'), cand('w-new-2')]));
  });
});

describe('buildQueue — exclusions', () => {
  it('never offers a candidate that already has a card', () => {
    const cards = [card('w-1', '2026-08-20')];   // 미래 만기 — 복습 대상도 아님
    const out = buildQueue(cards, [cand('w-1'), cand('w-2')], new Set(), TODAY, 20, rng());
    expect(keys(out)).toEqual(keys([cand('w-2')]));
  });
  it('never offers a mastered candidate', () => {
    const mastered = new Set([cardKey('word', 'w-1')]);
    const out = buildQueue([], [cand('w-1'), cand('w-2')], mastered, TODAY, 20, rng());
    expect(keys(out)).toEqual(keys([cand('w-2')]));
  });
  it('treats blank and arrange for one sentence as separate items', () => {
    const cards = [card('s-1', '2026-08-20', 'blank')];
    const candidates = [cand('s-1', 'blank'), cand('s-1', 'arrange')];
    const out = buildQueue(cards, candidates, new Set(), TODAY, 20, rng());
    expect(keys(out)).toEqual(keys([cand('s-1', 'arrange')]));
  });
});

describe('buildQueue — output shape', () => {
  it('does not mutate its inputs', () => {
    const cards = [card('w-1', '2026-08-01')];
    const candidates = [cand('w-2')];
    const cardsSnapshot = JSON.stringify(cards);
    const candSnapshot = JSON.stringify(candidates);
    buildQueue(cards, candidates, new Set(), TODAY, 20, rng());
    expect(JSON.stringify(cards)).toBe(cardsSnapshot);
    expect(JSON.stringify(candidates)).toBe(candSnapshot);
  });
  it('contains no duplicates', () => {
    const cards = [card('w-1', '2026-08-01')];
    const candidates = Array.from({ length: 25 }, (_, i) => cand(`w-${i}`));
    const out = buildQueue(cards, candidates, new Set(), TODAY, 20, rng());
    expect(new Set(keys(out)).size).toBe(out.length);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/queue.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/queue"`

- [ ] **Step 3: 구현** — `lib/queue.ts`

```ts
import type { SrsCard } from './types';
import { cardKey, type CardIdentity } from './srs';
import { shuffle } from './quiz';

/** 한 판의 문항 수 */
export const SESSION_SIZE = 20;

/**
 * 한 판에 낼 항목을 고른다.
 * 밀린 복습을 먼저 갚고(오래 밀린 것부터), 남는 자리를 아직 안 본 항목으로 채운다.
 * 후보가 모자라면 size보다 적게 돌려준다.
 */
export function buildQueue(
  cards: SrsCard[],
  candidates: CardIdentity[],
  masteredKeys: Set<string>,
  today: string,
  size: number = SESSION_SIZE,
  rng: () => number = Math.random,
): CardIdentity[] {
  const due = cards
    .filter((c) => c.dueDate <= today)
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, size)
    .map((c) => ({ itemId: c.itemId, type: c.type, sourceDate: c.sourceDate }));

  const seen = new Set(cards.map((c) => cardKey(c.type, c.itemId)));
  const fresh: CardIdentity[] = [];
  for (const c of candidates) {
    if (due.length + fresh.length >= size) break;
    const key = cardKey(c.type, c.itemId);
    if (seen.has(key) || masteredKeys.has(key)) continue;
    fresh.push(c);
  }

  return shuffle([...due, ...fresh], rng);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/queue.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: 전체 스위트 + 커밋**

Run: `npm test`
Expected: 47개 통과 (22 기존 + 13 srs + 12 queue)

```bash
git add lib/queue.ts tests/queue.test.ts
git commit -m "feat: add session queue builder with review-first ordering"
```

---

### Task 4: 저장소 (`lib/srsRepo.ts`)

**Files:**
- Create: `lib/srsRepo.ts`
- Test: `tests/srsRepo.test.ts`

**Interfaces:**
- Consumes: `SrsCard`, `MasteredItem`, `SessionRecord`, `QuizType` (Task 1), `cardKey`, `nextState`, `CardIdentity`, `SrsUpdate` (Task 2), `addDays` (`lib/date.ts`)
- Produces:

```ts
export function getCards(): SrsCard[];
export function getMastered(): MasteredItem[];
export function getMasteredKeys(): Set<string>;          // cardKey() 형식
export function getSessions(): SessionRecord[];
export function findCard(cards: SrsCard[], type: QuizType, itemId: string): SrsCard | null;

export interface AnsweredItem {
  identity: CardIdentity;
  correct: boolean;
}

/** 한 판의 결과를 한 번에 반영한다. 졸업한 항목 수를 돌려준다. */
export function commitSession(
  answers: AnsweredItem[],
  today: string,
  finishedAt: string,   // ISO
): { masteredCount: number };

export function calcStreak(sessions: SessionRecord[], today: string): number;
export function countDueOn(cards: SrsCard[], date: string): number;
```

localStorage 키: `ddt.srs`(카드 배열), `ddt.mastered`(졸업 배열), `ddt.sessions`(세션 배열). 값이 없거나 파싱 실패면 빈 배열로 동작한다.

`commitSession`이 하는 일 — 한 번의 저장으로 끝내야 한다:
1. 현재 카드·졸업 목록을 읽는다
2. 각 답에 대해 `nextState`를 적용한다. 졸업이면 카드 목록에서 제거하고 `ddt.mastered`에 `{itemId, type, masteredAt: finishedAt}`을 추가한다. 아니면 카드를 갱신하거나 새로 넣는다
3. 세 키를 저장하고, `ddt.sessions`에 `{finishedAt, date: today, correct, total}`을 추가한다

`calcStreak` 규칙: `today`부터 거꾸로 세어 세션 기록이 있는 연속 일수. **오늘 아직 안 했으면 어제부터 센다** (v1과 같은 규칙). 같은 날 여러 판을 해도 1일로 센다.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/srsRepo.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCards, getMastered, getMasteredKeys, getSessions,
  findCard, commitSession, calcStreak, countDueOn,
} from '@/lib/srsRepo';
import { cardKey } from '@/lib/srs';
import type { SrsCard, SessionRecord, QuizType } from '@/lib/types';

const TODAY = '2026-08-06';
const NOW = '2026-08-06T10:00:00.000Z';
const ident = (itemId: string, type: QuizType = 'word') =>
  ({ itemId, type, sourceDate: '2026-08-04' });

beforeEach(() => localStorage.clear());

describe('empty and corrupted storage', () => {
  it('returns empty collections when nothing is stored', () => {
    expect(getCards()).toEqual([]);
    expect(getMastered()).toEqual([]);
    expect(getSessions()).toEqual([]);
    expect(getMasteredKeys().size).toBe(0);
  });
  it('degrades to empty on corrupted JSON for every key', () => {
    localStorage.setItem('ddt.srs', '{broken');
    localStorage.setItem('ddt.mastered', 'nope');
    localStorage.setItem('ddt.sessions', '[[[');
    expect(getCards()).toEqual([]);
    expect(getMastered()).toEqual([]);
    expect(getSessions()).toEqual([]);
  });
});

describe('findCard', () => {
  const cards: SrsCard[] = [
    { itemId: 's-1', type: 'blank', sourceDate: '2026-08-04', box: 1, dueDate: TODAY },
    { itemId: 's-1', type: 'arrange', sourceDate: '2026-08-04', box: 2, dueDate: TODAY },
  ];
  it('matches on both type and itemId', () => {
    expect(findCard(cards, 'arrange', 's-1')!.box).toBe(2);
  });
  it('returns null when absent', () => {
    expect(findCard(cards, 'word', 's-1')).toBeNull();
  });
});

describe('commitSession', () => {
  it('creates cards for new items — right answers land in box 1, wrong in box 0', () => {
    commitSession(
      [{ identity: ident('w-1'), correct: true }, { identity: ident('w-2'), correct: false }],
      TODAY, NOW,
    );
    const cards = getCards();
    expect(cards).toHaveLength(2);
    expect(findCard(cards, 'word', 'w-1')).toMatchObject({ box: 1, dueDate: '2026-08-09' });
    expect(findCard(cards, 'word', 'w-2')).toMatchObject({ box: 0, dueDate: '2026-08-07' });
  });

  it('advances an existing card rather than duplicating it', () => {
    commitSession([{ identity: ident('w-1'), correct: true }], TODAY, NOW);
    commitSession([{ identity: ident('w-1'), correct: true }], '2026-08-09', NOW);
    const cards = getCards();
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ box: 2, dueDate: '2026-08-16' });
  });

  it('graduates a box 3 card: removes it and records it as mastered', () => {
    // box 3까지 올린다: 신규 맞힘(1) -> 2 -> 3
    commitSession([{ identity: ident('w-1'), correct: true }], TODAY, NOW);
    commitSession([{ identity: ident('w-1'), correct: true }], '2026-08-09', NOW);
    commitSession([{ identity: ident('w-1'), correct: true }], '2026-08-16', NOW);
    expect(getCards()[0].box).toBe(3);

    const r = commitSession([{ identity: ident('w-1'), correct: true }], '2026-08-30', NOW);
    expect(r.masteredCount).toBe(1);
    expect(getCards()).toEqual([]);
    expect(getMastered()).toEqual([{ itemId: 'w-1', type: 'word', masteredAt: NOW }]);
    expect(getMasteredKeys().has(cardKey('word', 'w-1'))).toBe(true);
  });

  it('sends a wrong answer back to box 0 from any box', () => {
    commitSession([{ identity: ident('w-1'), correct: true }], TODAY, NOW);
    commitSession([{ identity: ident('w-1'), correct: true }], '2026-08-09', NOW);
    expect(getCards()[0].box).toBe(2);
    commitSession([{ identity: ident('w-1'), correct: false }], '2026-08-16', NOW);
    expect(getCards()[0]).toMatchObject({ box: 0, dueDate: '2026-08-17' });
  });

  it('records one session with the right tally', () => {
    commitSession(
      [
        { identity: ident('w-1'), correct: true },
        { identity: ident('w-2'), correct: true },
        { identity: ident('w-3'), correct: false },
      ],
      TODAY, NOW,
    );
    expect(getSessions()).toEqual([{ finishedAt: NOW, date: TODAY, correct: 2, total: 3 }]);
  });

  it('keeps blank and arrange cards for one sentence separate', () => {
    commitSession(
      [
        { identity: ident('s-1', 'blank'), correct: true },
        { identity: ident('s-1', 'arrange'), correct: false },
      ],
      TODAY, NOW,
    );
    const cards = getCards();
    expect(cards).toHaveLength(2);
    expect(findCard(cards, 'blank', 's-1')!.box).toBe(1);
    expect(findCard(cards, 'arrange', 's-1')!.box).toBe(0);
  });

  it('returns 0 mastered when nobody graduated', () => {
    const r = commitSession([{ identity: ident('w-1'), correct: true }], TODAY, NOW);
    expect(r.masteredCount).toBe(0);
  });

  it('appends sessions rather than replacing them', () => {
    commitSession([{ identity: ident('w-1'), correct: true }], TODAY, NOW);
    commitSession([{ identity: ident('w-2'), correct: true }], '2026-08-07', NOW);
    expect(getSessions()).toHaveLength(2);
  });
});

describe('calcStreak', () => {
  const s = (date: string): SessionRecord =>
    ({ finishedAt: `${date}T10:00:00.000Z`, date, correct: 10, total: 20 });

  it('counts consecutive days ending today', () => {
    expect(calcStreak([s('2026-08-04'), s('2026-08-05'), s(TODAY)], TODAY)).toBe(3);
  });
  it('does not break when today is not done yet', () => {
    expect(calcStreak([s('2026-08-04'), s('2026-08-05')], TODAY)).toBe(2);
  });
  it('stops at a gap', () => {
    expect(calcStreak([s('2026-08-01'), s('2026-08-05')], TODAY)).toBe(1);
  });
  it('counts two sessions on one day as one', () => {
    expect(calcStreak([s(TODAY), s(TODAY)], TODAY)).toBe(1);
  });
  it('is 0 with no sessions', () => {
    expect(calcStreak([], TODAY)).toBe(0);
  });
});

describe('countDueOn', () => {
  const c = (itemId: string, dueDate: string): SrsCard =>
    ({ itemId, type: 'word', sourceDate: '2026-08-04', box: 1, dueDate });
  it('counts cards due on or before the given date', () => {
    const cards = [c('a', '2026-08-05'), c('b', '2026-08-07'), c('c', '2026-08-20')];
    expect(countDueOn(cards, '2026-08-07')).toBe(2);
  });
  it('is 0 when nothing is due', () => {
    expect(countDueOn([c('a', '2026-09-01')], TODAY)).toBe(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/srsRepo.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/srsRepo"`

- [ ] **Step 3: 구현** — `lib/srsRepo.ts`

```ts
import type { SrsCard, MasteredItem, SessionRecord, QuizType } from './types';
import { cardKey, nextState, type CardIdentity } from './srs';
import { addDays } from './date';

const KEYS = {
  cards: 'ddt.srs',
  mastered: 'ddt.mastered',
  sessions: 'ddt.sessions',
} as const;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getCards(): SrsCard[] {
  const v = load<SrsCard[]>(KEYS.cards, []);
  return Array.isArray(v) ? v : [];
}
export function getMastered(): MasteredItem[] {
  const v = load<MasteredItem[]>(KEYS.mastered, []);
  return Array.isArray(v) ? v : [];
}
export function getMasteredKeys(): Set<string> {
  return new Set(getMastered().map((m) => cardKey(m.type, m.itemId)));
}
export function getSessions(): SessionRecord[] {
  const v = load<SessionRecord[]>(KEYS.sessions, []);
  return Array.isArray(v) ? v : [];
}

export function findCard(cards: SrsCard[], type: QuizType, itemId: string): SrsCard | null {
  return cards.find((c) => c.type === type && c.itemId === itemId) ?? null;
}

export interface AnsweredItem {
  identity: CardIdentity;
  correct: boolean;
}

/**
 * 한 판의 결과를 한 번에 반영한다. 문항마다 저장하지 않는 이유는
 * 중간 이탈 시 아무것도 기록하지 않기 위해서다(전부 아니면 전무).
 */
export function commitSession(
  answers: AnsweredItem[],
  today: string,
  finishedAt: string,
): { masteredCount: number } {
  let cards = getCards();
  const mastered = getMastered();
  let masteredCount = 0;

  for (const { identity, correct } of answers) {
    const current = findCard(cards, identity.type, identity.itemId);
    const update = nextState(current, correct, today, identity);
    cards = cards.filter((c) => !(c.type === identity.type && c.itemId === identity.itemId));
    if (update.mastered) {
      mastered.push({ itemId: identity.itemId, type: identity.type, masteredAt: finishedAt });
      masteredCount += 1;
    } else if (update.card) {
      cards.push(update.card);
    }
  }

  save(KEYS.cards, cards);
  save(KEYS.mastered, mastered);
  save(KEYS.sessions, [
    ...getSessions(),
    {
      finishedAt,
      date: today,
      correct: answers.filter((a) => a.correct).length,
      total: answers.length,
    },
  ]);

  return { masteredCount };
}

export function calcStreak(sessions: SessionRecord[], today: string): number {
  const days = new Set(sessions.map((s) => s.date));
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) { streak += 1; cursor = addDays(cursor, -1); }
  return streak;
}

export function countDueOn(cards: SrsCard[], date: string): number {
  return cards.filter((c) => c.dueDate <= date).length;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/srsRepo.test.ts`
Expected: PASS (18 tests)

- [ ] **Step 5: 전체 스위트 + 커밋**

Run: `npm test`
Expected: 65개 통과 (22 기존 + 13 srs + 12 queue + 18 srsRepo)

```bash
git add lib/srsRepo.ts tests/srsRepo.test.ts
git commit -m "feat: add SRS repository with batched session commit"
```

---

### Task 5: 문항 컴포넌트에 해설 추가

**Files:**
- Modify: `components/QuizCard.tsx`, `components/ArrangeCard.tsx`

**Interfaces:**
- Consumes: 기존 `QuizCardProps`(`prompt`, `subPrompt?`, `choices`, `onNext`), `ArrangeCardProps`(`ko`, `tokens`, `answerTokens`, `onNext`)
- Produces:

```ts
// QuizCard.tsx — prop 하나 추가, 나머지는 그대로
interface QuizCardProps {
  prompt: string;
  subPrompt?: string;
  choices: Choice[];
  onNext: (correct: boolean) => void;
  explanation?: ReactNode;   // 틀렸을 때만 렌더된다
}
```

`ArrangeCard`는 새 prop 없이, 오답 시 이미 보여주는 정답 문장 아래에 `ko`(이미 받고 있는 prop)를 함께 표시한다.

**왜 이 태스크가 필요한가:** "틀리면 답을 알려준다"가 이 앱의 핵심 요구다. 현재는 정답 보기에 "✓ 정답" 배지만 붙어서, 단어를 틀렸을 때 뜻·예문을 볼 방법이 없다.

- [ ] **Step 1: `QuizCard`에 `explanation` prop 추가**

`components/QuizCard.tsx`:
- `QuizCardProps`에 `explanation?: ReactNode`를 추가하고 `import type { ReactNode } from 'react'`
- 답을 고른 뒤(`locked === true`) **그리고 틀렸을 때만** "다음" 버튼 위에 `explanation`을 렌더한다. 맞혔을 때는 렌더하지 않는다 — 흐름을 끊지 않는 게 낫다
- 감싸는 컨테이너는 기존 카드 스타일과 맞춘다 (`rounded-2xl`, `border-gray-200 dark:border-gray-800`, 넉넉한 패딩). `explanation`이 없으면 컨테이너 자체를 렌더하지 않는다
- 기존 `prompt`/`subPrompt`/`choices`/`onNext` 동작과 잠금 로직은 **바꾸지 않는다**

- [ ] **Step 2: `ArrangeCard`의 오답 안내에 한글 해석 추가**

`components/ArrangeCard.tsx`: 오답일 때 정답 문장을 보여주는 블록에 `ko`를 한 줄 덧붙인다. 정답 문장과 시각적으로 구분되게(작은 글씨, 흐린 색) 넣는다. props는 바꾸지 않는다.

- [ ] **Step 3: 검증**

Run: `npx tsc --noEmit && npx eslint . && npm test`
Expected: 타입·린트 깨끗, 65개 통과

기존 `/learn/[date]` 화면이 `QuizCard`를 `explanation` 없이 쓰고 있으므로, prop이 선택적임을 실제로 확인한다 — 위 `tsc`가 통과하면 확인된 것이다.

- [ ] **Step 4: 커밋**

```bash
git add components/QuizCard.tsx components/ArrangeCard.tsx
git commit -m "feat: show explanation on wrong answers"
```

---

### Task 6: 게임 화면 (`/`)

**Files:**
- Create: `components/GameRunner.tsx`
- Modify: `app/page.tsx` (전면 교체)

**Interfaces:**
- Consumes: `buildQueue`, `SESSION_SIZE` (Task 3); `getCards`, `getMasteredKeys`, `commitSession`, `countDueOn`, `AnsweredItem` (Task 4); `cardKey`, `CardIdentity` (Task 2); `QuizCard`(`explanation` 포함), `ArrangeCard` (Task 5); `buildWordQuiz`, `buildBlankQuiz`, `buildArrangeQuiz`, `QuizItem` (`lib/quiz.ts`); `fetchIndex`, `fetchDay` (`lib/contentRepo.ts`); `todayStr`, `addDays` (`lib/date.ts`); `scoreOf` (`lib/session.ts`)
- Produces: 없음 (말단 화면)

**이 태스크가 앱의 중심이다.** 접속하면 로딩 스피너 하나만 지나 곧바로 첫 문항이 뜬다. 대시보드도, 시작 화면도 없다.

#### 후보 목록 만들기

`app/page.tsx`가 마운트될 때:

1. `fetchIndex()`로 14일 목록을, `Promise.all`로 각 날짜의 `fetchDay()`를 불러온다
2. **전체 후보를 day 파일 순서로** 평탄화한다. 한 날짜 안에서는 단어 전부 → 문장(blank) → 문장(arrange) 순:
   - 단어 `w`: `{ itemId: w.id, type: 'word', sourceDate: day.date }`
   - 문장 `s`: `{ itemId: s.id, type: 'blank', sourceDate: day.date }`, 이어서 `{ itemId: s.id, type: 'arrange', sourceDate: day.date }`
3. `fullWordPool` = 전체 14일의 모든 `Word` 배열 (140개). `buildWordQuiz`의 `pool` 인자로 항상 이걸 넘긴다 — 안 그러면 예외가 난다
4. `today = todayStr()`를 **한 번 계산해서** 그 판 내내 쓴다
5. `buildQueue(getCards(), candidates, getMasteredKeys(), today)`로 최대 20개를 얻는다
6. 각 `CardIdentity`를 실제 문항으로 바꾼다. `sourceDate`로 그 날짜의 `DayContent`를 찾고, `itemId`로 원문을 찾은 뒤 타입에 맞는 빌더를 호출한다:
   - `word` → `buildWordQuiz([word], fullWordPool)[0]`
   - `blank` → `buildBlankQuiz([sentence])[0]`
   - `arrange` → `buildArrangeQuiz([sentence])[0]`
   원문을 못 찾은 항목은 조용히 건너뛴다 (콘텐츠가 지워진 경우)
7. 큐가 비면 `GameRunner` 대신 "할 일 없음" 화면을 렌더한다: "오늘 할 게 없어요" + `countDueOn(getCards(), addDays(today, 1))`로 계산한 "내일 N개 볼 예정이에요" + 통계 링크

#### `GameRunner` 상태 기계

```tsx
'use client';
// props: {
//   items: { identity: CardIdentity; quiz: QuizItem; word?: Word; sentence?: Sentence }[];
//   today: string;
//   dueTomorrowBefore: number;  // 판 시작 시점의 "내일 볼 개수" (결과 화면 표시용 기준)
// }
type Phase = 'quiz' | 'result';
```

- `idx`(현재 문항), `answers: AnsweredItem[]`, `phase`로 구성한다
- 문항을 답하면 `answers`에 하나 쌓고 `idx`를 올린다. 마지막이면 `phase`를 `'result'`로 바꾸고 **커밋한다**
- **커밋은 여기서 딱 한 번:** `commitSession(finalAnswers, today, new Date().toISOString())`. 반환된 `masteredCount`를 결과 화면에 쓴다
- **스테일 상태 함정:** `answers`를 `setState` 한 뒤 같은 핸들러에서 읽으면 마지막 답이 빠진다. 지역 변수로 최종 배열을 만들어 `setAnswers`와 커밋에 **같은 값**을 쓴다. v1에서 실제로 이 버그가 났다
- 문항 렌더: `quiz.type`으로 분기해 `QuizCard`(word·blank) 또는 `ArrangeCard`(arrange). `key`는 `cardKey(identity.type, identity.itemId)` — 문항마다 달라져 내부 상태가 초기화된다
- 상단: 진행바(`(idx+1)/items.length` — 마지막 문항에서 100%가 되도록)와 문항 번호, 나가기 버튼(`/`로 다시 들어오면 큐를 새로 구성)

#### 틀렸을 때 보여줄 해설 (`explanation`)

- `word` 문항 → 그 단어의 `word`, `pos`, `meaning`, `example`, `exampleKo`
- `blank` 문항 → 빈칸이 채워진 완성 문장 `text`와 해석 `ko`
- `arrange` 문항 → `ArrangeCard`가 이미 처리한다 (Task 5)

#### 결과 화면

- 정답률: `Math.round(correct / total * 100)`
- 틀린 항목 목록: 단어면 `word — meaning`, 문장이면 `text`
- `masteredCount > 0`이면 졸업 축하 표시
- **"내일 볼 단어 N개"** — 커밋 후에 `countDueOn(getCards(), addDays(today, 1))`로 다시 계산한다. 이번 판에서 틀린 항목이 내일로 잡히므로 커밋 전 값과 다르다
- 버튼: 남은 항목이 있으면 "한 판 더"(페이지를 다시 마운트해 큐를 재구성), 그리고 "통계 보기"

- [ ] **Step 1: `frontend-design` 스킬 로드**

이 화면이 앱의 얼굴이다. 코드 작성 전에 스킬을 읽고 따른다. 시각 언어는 기존 컴포넌트(`rounded-2xl` 카드, `min-h-14` 버튼, `max-w-xl` 컬럼)와 맞춘다.

- [ ] **Step 2: `components/GameRunner.tsx` 구현**

위 상태 기계대로. 스테일 상태 함정을 반드시 피한다.

- [ ] **Step 3: `app/page.tsx` 전면 교체**

위 후보 목록 만들기대로. 로딩 중 스피너, 큐가 비면 "할 일 없음" 화면, 그 외에는 `<GameRunner />`. **로딩 중이나 그 후에도 대시보드·통계를 보여주지 않는다.**

- [ ] **Step 4: 검증 — 실제로 한 판 돌려본다**

Run: `npx tsc --noEmit && npx eslint . && npm test` (65개 통과)

그리고 `npm run dev`로 실제 확인:
- `/`에 접속 → 스피너 후 바로 첫 문항이 뜨는지 (대시보드가 안 보이는지)
- 20문항이 나오는지, 첫 판이 Day 1 콘텐츠(단어 10 + 빈칸 5 + 조합 5)인지
- 단어를 **일부러 틀려서** 뜻·품사·예문·해석이 펼쳐지는지
- **마지막 문항을 틀리고** 결과 화면과 `localStorage`의 `ddt.srs`에 그 항목이 box 0으로 들어갔는지 (스테일 상태 함정)
- 판을 끝낸 뒤 `ddt.srs`에 20개 카드, `ddt.sessions`에 1건이 있는지
- 맞힌 항목의 `dueDate`가 오늘+3일, 틀린 항목이 오늘+1일인지
- 중간에 나가면 `ddt.srs`·`ddt.sessions`가 **비어 있는지** (전부 아니면 전무)
- 결과 화면의 "내일 볼 단어 N개"가 실제 틀린 개수와 맞는지

- [ ] **Step 5: 커밋**

```bash
git add components/GameRunner.tsx app/page.tsx
git commit -m "feat: replace home with the word game"
```

---

### Task 7: 내 단어장 (`/vocab`)

**Files:**
- Create: `app/vocab/page.tsx`

**Interfaces:**
- Consumes: `getCards`, `getMastered` (Task 4); `fetchIndex`, `fetchDay` (`lib/contentRepo.ts`); `todayStr` (`lib/date.ts`); `SrsCard`, `MasteredItem` (Task 1)
- Produces: 없음 (말단 화면)

`ddt.srs`에 뭐가 들어 있고 언제 다시 나오는지 보여주는 화면이다. v1의 오답노트를 대체한다. **여기서는 문제를 풀지 않는다** — 복습은 게임이 알아서 낸다.

구성:
- **학습 중** 섹션: `getCards()`를 `dueDate` 오름차순으로. 각 행에 원문(단어면 `word` + `meaning`, 문장이면 `text`), 단계(box), 다음 출제일. `dueDate <= 오늘`인 항목은 "오늘 복습 예정"으로 강조
- 단계 표시는 숫자 대신 사람이 읽을 수 있게: box 0 → "새로 배움", 1 → "익히는 중", 2 → "거의 외움", 3 → "마지막 확인"
- **졸업** 섹션: `getMastered()`를 `masteredAt` 최신순으로, 원문과 함께
- 원문 조회: `fetchIndex()` → 각 날짜 `fetchDay()`를 **날짜당 한 번만**. 카드의 `sourceDate`로 찾고 `itemId`로 항목을 찾는다
- 원문을 못 찾은 카드는 "삭제된 콘텐츠"로 표시한다 (크래시나 조용한 누락 금지)
- 비어 있으면: "아직 학습한 단어가 없어요" + 홈(게임)으로 가는 링크

- [ ] **Step 1: `frontend-design` 스킬 로드**

- [ ] **Step 2: `app/vocab/page.tsx` 구현**

기존 화면들의 로딩 가드 패턴(`cancelled` 플래그 + 스피너)과 카드 스타일을 따른다.

- [ ] **Step 3: 검증**

Run: `npx tsc --noEmit && npx eslint . && npm test`

`npm run dev`로:
- 한 판 끝낸 뒤 `/vocab`에 20개가 뜨는지, 맞힌 것과 틀린 것의 단계·다음 날짜가 다른지
- `localStorage`를 비우고 → 빈 상태 문구가 뜨는지
- 졸업 섹션 확인: DevTools로 `ddt.mastered`에 항목을 하나 넣고 새로고침해 렌더되는지

- [ ] **Step 4: 커밋**

```bash
git add app/vocab
git commit -m "feat: add vocabulary list page"
```

---

### Task 8: 통계 개편 + 네비게이션 정리

**Files:**
- Modify: `app/stats/page.tsx` (전면 교체), `components/Nav.tsx`, `app/layout.tsx`, `app/vocab/page.tsx`

**Interfaces:**
- Consumes: `getCards`, `getMastered`, `getSessions`, `calcStreak`, `countDueOn` (Task 4); `todayStr`, `addDays` (`lib/date.ts`)
- Produces: 없음

현재 `/stats`는 v1의 `getDayRecords`/`getReviewRecords`를 읽는다. 새 저장소로 갈아탄다.

**`/stats` 구성:**
- 요약 타일: 🔥 연속 학습(`calcStreak(getSessions(), todayStr())`), 졸업한 단어(`getMastered().length`), 학습 중(`getCards().length`), 오늘 복습 예정(`countDueOn(cards, today)`), 내일 예정(`countDueOn(cards, addDays(today, 1))`)
- 단계별 분포: box 0~3에 각각 몇 개인지. **막대는 `div`에 CSS width 퍼센트로** 그린다 — 차트 라이브러리 금지
- 세션 기록: `getSessions()` 최신순으로 일시·정답률
- 기록이 없으면 한국어 빈 상태 + 홈(게임) 링크. 0으로 나누지 않도록 주의한다

**네비게이션 위치를 옮긴다.** 스펙 §7은 게임 진행 중 네비를 숨기라고 한다. 게임이 `/`에 있으므로 v1처럼 경로 prefix로는 구분할 수 없다. 공유 상태를 만드는 대신 **`<Nav />`를 레이아웃에서 빼고 네비가 필요한 페이지에서 직접 렌더한다**:

- `app/layout.tsx`에서 `<Nav />`를 제거한다
- `app/vocab/page.tsx`와 `app/stats/page.tsx`가 각자 최상단에 `<Nav />`를 렌더한다
- 게임 페이지(`/`)는 렌더하지 않는다 → 몰입형 화면이 된다
- `components/Nav.tsx`의 `usePathname()` 기반 `/learn` 숨김 로직은 이제 불필요하므로 **지운다**. 링크는 3개로: `/`(홈), `/vocab`(단어장), `/stats`(통계). 활성 표시·호버·컬럼 정렬은 현재 구현을 유지한다

이 시점에 옛 화면들(`/calendar`, `/review`, `/notes`, `/learn/*`)은 네비를 잃지만, Task 9에서 삭제되므로 문제되지 않는다.

- [ ] **Step 1: `frontend-design` 스킬 로드**

막대 그래프를 그리게 되므로 `dataviz` 스킬도 함께 읽는다.

- [ ] **Step 2: `app/stats/page.tsx` 전면 교체**

- [ ] **Step 3: 네비게이션 이동 + 링크 3개로**

위 "네비게이션 위치를 옮긴다"대로 네 파일을 손본다: `Nav.tsx`(링크 3개, `/learn` 숨김 로직 제거), `app/layout.tsx`(`<Nav />` 제거), `app/vocab/page.tsx`와 `app/stats/page.tsx`(각자 `<Nav />` 렌더).

- [ ] **Step 4: 검증**

Run: `npx tsc --noEmit && npx eslint . && npm test && npm run build`
Expected: 전부 통과. 빌드는 이 시점에 옛 라우트들까지 포함해 성공해야 한다

`npm run dev`로: 한 판 끝낸 뒤 `/stats`의 숫자들이 `ddt.srs`/`ddt.sessions` 실제 내용과 맞는지. `localStorage` 비우고 빈 상태도 확인

- [ ] **Step 5: 커밋**

```bash
git add app/stats/page.tsx components/Nav.tsx app/layout.tsx app/vocab/page.tsx
git commit -m "feat: rebuild stats on SRS data and move nav out of the game screen"
```

---

### Task 9: 옛 화면 삭제 + README + 최종 QA

**Files:**
- Delete: `app/calendar/`, `app/learn/`, `app/review/`, `app/notes/`, `components/MonthCalendar.tsx`, `components/SessionRunner.tsx`, `components/WordBrowse.tsx`, `lib/progressRepo.ts`, `tests/progressRepo.test.ts`
- Modify: `lib/types.ts` (`DayRecord`, `WrongNote`, `ReviewRecord` 제거), `README.md`

**Interfaces:**
- Consumes: 이전 태스크 전부
- Produces: 없음 (마무리)

- [ ] **Step 1: 옛 화면·모듈 삭제**

위 목록을 지운다. `lib/session.ts`는 **남긴다** (`scoreOf`를 결과 화면이 쓴다면 계속 필요하고, 테스트도 있다).

- [ ] **Step 2: 죽은 타입 제거**

`lib/types.ts`에서 `DayRecord`, `WrongNote`, `ReviewRecord`를 지운다. 이제 참조하는 곳이 없어야 한다 — `npx tsc --noEmit`으로 확인한다. 남은 참조가 있으면 그 파일이 삭제 목록에서 빠졌다는 뜻이다.

- [ ] **Step 3: 남은 참조 확인**

Task 8에서 네비를 이미 페이지별 렌더로 옮겼으므로 `Nav.tsx`는 손댈 게 없다. 삭제한 화면들이 참조했던 것 중 남은 게 없는지 확인한다:

Run: `grep -rn "MonthCalendar\|SessionRunner\|WordBrowse\|progressRepo\|DayRecord\|WrongNote\|ReviewRecord" app components lib tests`
Expected: 아무것도 안 나온다. 나오면 그 파일이 삭제 목록에서 빠졌거나 Step 2가 덜 된 것이다

- [ ] **Step 4: README 갱신**

`README.md`의 앱 설명과 화면 목록을 새 구조로 바꾼다:
- 앱이 무엇인지 (간격 반복 단어 게임)
- 실행·테스트·데이터 검증·빌드 명령 (변경 없음)
- **콘텐츠 추가 방법 섹션은 그대로 유지한다** — 스키마와 작성 규칙은 여전히 유효하다
- 화면 설명을 3개로 (게임 / 단어장 / 통계)
- 간격 반복 규칙 표 (1→3→7→14일, 졸업)
- 진도는 브라우저 `localStorage`(`ddt.srs`, `ddt.mastered`, `ddt.sessions`)에 저장되고, 백엔드를 붙일 때는 `lib/contentRepo.ts`와 `lib/srsRepo.ts`만 교체하면 된다는 설명
- v1 키(`ddt.dayRecords` 등)는 더 쓰지 않으며 마이그레이션하지 않는다는 한 줄

- [ ] **Step 5: 전체 검증**

Run: `npm test && npm run validate-data && npx tsc --noEmit && npx eslint . && npm run build`
Expected: **테스트 57개 통과** — Task 8까지 65개였고(기존 22 + srs 13 + queue 12 + srsRepo 18), 이 태스크에서 `tests/progressRepo.test.ts`의 8개를 삭제하므로 65 − 8 = 57이다. 데이터 14일 통과, 빌드 성공. 라우트는 `/`, `/vocab`, `/stats` 세 개여야 한다

- [ ] **Step 6: 수동 QA 체크리스트**

`npm run dev`로 `localStorage`를 비운 상태부터:
- `/` 접속 → 스피너 후 바로 문항. 대시보드 없음
- 20문항 완주, 일부 일부러 틀림 → 결과에 정답률·틀린 목록·"내일 볼 단어 N개"
- `/vocab` → 20개가 단계·다음 날짜와 함께. 맞힌 것은 3일 후, 틀린 것은 내일
- `/stats` → 연속 1일, 학습 중 20, 졸업 0, 내일 예정 = 틀린 개수
- `/` 다시 접속 → 오늘 복습 예정이 없으므로 **신규 20개**가 나옴 (Day 1 소진 후 Day 2)
- DevTools로 `ddt.srs`의 카드 하나를 box 3 + `dueDate`를 오늘로 바꾸고 → 한 판에서 그걸 맞히면 졸업 처리되고 `/vocab` 졸업 섹션·`/stats` 졸업 수에 반영되는지
- 판 중간에 나가기 → 아무것도 기록되지 않는지
- 삭제된 라우트(`/calendar`, `/review`, `/notes`, `/learn/2026-08-04`) 접속 → 404
- 다크 모드, 모바일 폭에서 세 화면 확인

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "refactor: remove date-curriculum screens and document the new flow"
```
