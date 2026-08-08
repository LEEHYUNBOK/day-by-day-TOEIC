# 컴퓨팅 사이언스 트랙 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 토익과 별도 트랙으로 컴퓨팅 사이언스 지식 카드를 하루 10장 자기채점 방식으로 공부할 수 있게 한다.

**Architecture:** `QuizType`에 `'cs'`를 더하고 `TRACK: Record<QuizType, Track>` 매핑으로 트랙을 파생시킨다. 카드·졸업 저장소는 두 트랙이 공유하고(`cardKey`가 타입을 포함하므로 충돌하지 않는다), 세션 기록만 `track`을 명시적으로 갖는다. 간격 반복 규칙(`lib/srs.ts`)과 판 구성(`lib/queue.ts`)은 무엇을 외우는지 모르도록 만들어져 있어 한 줄도 바뀌지 않는다.

**Tech Stack:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript, Tailwind CSS 4.3.3, Vitest(jsdom), Supabase(Postgres + PostgREST + RLS)

**스펙:** `docs/superpowers/specs/2026-08-09-cs-knowledge-design.md`

## Global Constraints

- **수정 금지:** `lib/srs.ts`의 `DUE_DAYS`·`nextState`, `lib/queue.ts`의 `buildQueue`, `lib/quiz.ts` 전체, `lib/contentRepo.ts`의 `fetchContent`·`toBundle`, `lib/queue.ts`의 `SESSION_SIZE`(값 10). 이 파일들에 **추가**는 허용되나 기존 함수의 동작을 바꾸는 것은 금지다.
- **네 상태를 절대 합치지 않는다:** `loading` / `error`(조회 실패) / `no-content`(콘텐츠 없음) / `empty`(오늘 낼 게 없음). v1에서 오프라인일 때 "오늘 할 게 없어요"라고 거짓말하고 스트릭이 조용히 깨진 버그가 이 구분에서 나왔다.
- **용어:** 자기채점 결과를 "정답률"로 부르지 않는다. **"알았음 비율"**을 쓴다. 토익의 "정답률"은 그대로 둔다.
- **all-or-nothing:** `commitSession`은 카드·졸업·세션 세 번의 저장을 루프가 끝난 뒤에 한 번씩 한다. 루프 안에서 저장하면 중간 실패 시 일부만 갱신된다.
- **죽은 카드 필터:** DB에서 지워진 항목을 가리키는 SRS 카드는 큐 구성 전에 걸러낸다. 걸러내지 않으면 판 한 자리를 조용히 잡아먹고 `/cs`는 "할 게 없어요", `/stats`는 "예정 N개"라는 모순이 생긴다.
- **정렬 테스트 픽스처는 `id`와 `seq`를 역방향으로 둔다:** `{ id: 10, seq: 2 }, { id: 20, seq: 1 }`. 같은 방향이면 "`seq`로 정렬한다"를 증명하지 못한다.
- **DB:** RLS를 켜고 **SELECT 정책만** 만든다. INSERT/UPDATE/DELETE 정책을 만들지 않는다.
- **`SUPABASE_SERVICE_ROLE_KEY`는 `scripts/` 안에서만 쓴다.** 클라이언트 코드에 절대 넣지 않는다.
- **`seq`는 1부터.** `ingest.mjs`가 `seq: i + 1`을 쓰므로 같은 규칙을 지킨다.
- **박스 라벨 4개 그대로:** `기초 단계` / `익히는 중` / `거의 외움` / `마지막 확인`.
- **UI 문구는 모두 한국어.** 기존 화면의 어투(`~어요`)를 따른다.
- **시각 토큰은 기존 것을 쓴다:** `rounded-2xl` 카드, `border-gray-200 dark:border-gray-800` 경계선, 주색 `blue-600`/`dark:blue-400`, 배경 `bg-zinc-50 dark:bg-black`, 최대폭 `max-w-xl`, 간격은 4px 배수. 그림자를 쓰지 않는다. 웹폰트를 추가하지 않는다.
- **모든 명령은 포어그라운드로 실행한다.** `next dev`나 브라우저를 백그라운드로 띄우지 않는다. 이전 세션에서 유령 프로세스로 두 번 멈췄다.
- **커밋은 각 태스크 끝에 한 번.** `main`에서 직접 작업하며, 커밋은 승인되어 있다. **푸시와 배포는 하지 않는다** — 사용자에게 별도로 확인받는다.

---

## 파일 구조

**새로 만드는 파일**

| 경로 | 책임 |
|---|---|
| `~/Desktop/proposs/supabase/migrations/012_cs_content.sql` | `cs_sets`·`cs_cards` 테이블과 SELECT 전용 RLS. **다른 저장소다.** |
| `lib/stats.ts` | 트랙별 통계 집계(순수 함수). 화면에서 분리해 테스트 가능하게 둔다. |
| `scripts/ingest-cs.mjs` | CS 카드 입력. 검증 + PostgREST 삽입. |
| `scripts/ingest-cs.d.mts` | `validateCsInput` 타입 선언(테스트가 import 한다). |
| `content/cs/cs-01.json` ~ `cs-05.json` | 시드 콘텐츠 5세트 50장. 사용자가 검토할 대상이므로 커밋한다. |
| `components/CsRunner.tsx` | 자기채점 러너. 질문 → 답 공개 → 알았음/몰랐음. |
| `app/cs/page.tsx` | CS 판 화면. 네 상태와 죽은 카드 필터. |
| `tests/stats.test.ts` | `trackStats` 테스트. |
| `tests/ingestCs.test.ts` | `validateCsInput` 테스트. |

**수정하는 파일**

| 경로 | 변경 |
|---|---|
| `lib/types.ts` | `Track` 추가, `QuizType`에 `'cs'` 추가, `CsCard` 추가, `SessionRecord.track` 추가 |
| `lib/date.ts` | `formatMonthDay` 를 `app/page.tsx` 에서 옮겨 받는다 |
| `lib/srs.ts` | `TRACK` 매핑 추가 |
| `lib/queue.ts` | `CS_SESSION_SIZE = 10` 추가 |
| `lib/srsRepo.ts` | `getSessions` 하위호환, `commitSession`에 `track` 인자 |
| `lib/contentRepo.ts` | `RawCsCard`·`CsBundle`·`toCsBundle`·`fetchCsContent` 추가 |
| `scripts/ingest.mjs` | `loadEnv`·`rest`에 `export` 붙이기 |
| `scripts/ingest.d.mts` | `loadEnv`·`rest` 선언 추가 |
| `package.json` | `ingest:cs` 스크립트 추가 |
| `components/GameRunner.tsx` | `commitSession`에 `'toeic'`, 내일 개수 토익만, 완료 화면에 CS 진입 버튼 |
| `components/Nav.tsx` | `홈`→`토익`, `CS` 항목 추가 |
| `app/page.tsx` | `live` 필터에 토익 트랙 조건 명시, 지역 `formatMonthDay` 를 import 로 교체 |
| `app/vocab/page.tsx` | 토익 트랙만 표시, `TYPE_LABEL`에 `cs` 키 |
| `app/stats/page.tsx` | 스트릭 하나 + 트랙별 두 구역 |
| `tests/srs.test.ts` | `TRACK` 테스트 추가 |
| `tests/queue.test.ts` | `CS_SESSION_SIZE` 테스트 추가 |
| `tests/srsRepo.test.ts` | `track` 관련 테스트 추가, 기존 `commitSession` 호출에 인자 추가 |
| `tests/contentRepo.test.ts` | `toCsBundle` 테스트 추가 |
| `tests/date.test.ts` | `formatMonthDay` 테스트 추가 |

---

### Task 1: 트랙 개념 도입

`QuizType`에 `'cs'`를 더하면 컴파일이 세 곳에서 깨지고, 세 곳이 조용히 틀린다. 이 태스크는 그것들을 한꺼번에 정리해 트리를 초록으로 만든다. CS 화면은 아직 없다.

조용히 틀리는 것들:
1. `GameRunner.tsx:58`의 "내일 볼 단어 N개"가 CS 카드까지 센다
2. `app/vocab/page.tsx`가 CS 카드와 CS 졸업 항목을 단어장에 섞어 보여준다
3. `app/page.tsx`의 `live` 필터가 CS 카드를 우연히 걸러낸다 — `sentenceById.has()`가 false 를 돌려주기 때문이다. 우연에 의존하지 않고 명시한다.

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/srs.ts`
- Modify: `lib/queue.ts:6` 아래
- Modify: `lib/srsRepo.ts:32-35`, `lib/srsRepo.ts:50-84`
- Modify: `components/GameRunner.tsx:56`, `components/GameRunner.tsx:58`
- Modify: `app/page.tsx:67-69`
- Modify: `app/vocab/page.tsx:26`, `app/vocab/page.tsx:64`
- Test: `tests/srs.test.ts`, `tests/queue.test.ts`, `tests/srsRepo.test.ts`

**Interfaces:**
- Produces:
  - `Track = 'toeic' | 'cs'` (`lib/types.ts`)
  - `QuizType = 'word' | 'blank' | 'arrange' | 'cs'` (`lib/types.ts`)
  - `CsCard { id: string; topic: string; question: string; answer: string }` (`lib/types.ts`)
  - `SessionRecord.track: Track` (`lib/types.ts`)
  - `TRACK: Record<QuizType, Track>` (`lib/srs.ts`)
  - `CS_SESSION_SIZE = 10` (`lib/queue.ts`)
  - `commitSession(answers: AnsweredItem[], today: string, finishedAt: string, track: Track): { masteredCount: number }` (`lib/srsRepo.ts`)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/srs.test.ts` 맨 끝에 추가:

```ts
describe('TRACK', () => {
  it('토익 유형 셋을 toeic 으로, cs 를 cs 로 보낸다', () => {
    expect(TRACK.word).toBe('toeic');
    expect(TRACK.blank).toBe('toeic');
    expect(TRACK.arrange).toBe('toeic');
    expect(TRACK.cs).toBe('cs');
  });
  it('모든 QuizType 을 덮는다', () => {
    const types: QuizType[] = ['word', 'blank', 'arrange', 'cs'];
    expect(Object.keys(TRACK).sort()).toEqual([...types].sort());
  });
});
```

`tests/srs.test.ts` 맨 위의 import 에 `TRACK` 을, 타입 import 에 `QuizType` 을 더한다.

`tests/queue.test.ts` 의 `SESSION_SIZE` describe 아래에 추가하고, import 에 `CS_SESSION_SIZE` 를 더한다:

```ts
describe('CS_SESSION_SIZE', () => {
  it('is 10', () => expect(CS_SESSION_SIZE).toBe(10));
});
```

`tests/srsRepo.test.ts` 맨 끝에 추가:

```ts
describe('track', () => {
  it('commitSession 이 넘긴 track 을 기록한다', () => {
    commitSession([{ identity: ident('cs-net-01', 'cs'), correct: true }], TODAY, NOW, 'cs');
    expect(getSessions()).toEqual([
      { finishedAt: NOW, date: TODAY, correct: 1, total: 1, track: 'cs' },
    ]);
  });
  it('track 없이 저장된 기존 기록을 toeic 으로 읽는다', () => {
    localStorage.setItem(
      'ddt.sessions',
      JSON.stringify([{ finishedAt: NOW, date: TODAY, correct: 8, total: 10 }]),
    );
    expect(getSessions()[0].track).toBe('toeic');
  });
  it('CS 세션만 있는 날도 연속으로 센다', () => {
    commitSession([{ identity: ident('cs-net-01', 'cs'), correct: true }], TODAY, NOW, 'cs');
    expect(calcStreak(getSessions(), TODAY)).toBe(1);
  });
  it('두 트랙의 카드가 한 저장소에서 충돌하지 않는다', () => {
    commitSession(
      [
        { identity: ident('x-1', 'word'), correct: true },
        { identity: ident('x-1', 'cs'), correct: true },
      ],
      TODAY, NOW, 'toeic',
    );
    const keys = getCards().map((c) => cardKey(c.type, c.itemId)).sort();
    expect(keys).toEqual(['cs:x-1', 'word:x-1']);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `npm test`
Expected: FAIL. `TRACK`·`CS_SESSION_SIZE` 를 찾을 수 없고, `commitSession` 이 인자 4개를 받지 않는다.

- [ ] **Step 3: 타입을 바꾼다**

`lib/types.ts` — `QuizType` 줄을 바꾸고 아래를 추가/수정한다:

```ts
export interface CsCard {
  id: string;      // 'cs-net-01'
  topic: string;   // '네트워크'
  question: string;
  answer: string;
}
export type QuizType = 'word' | 'blank' | 'arrange' | 'cs';
export type Track = 'toeic' | 'cs';
```

`SessionRecord` 에 필드를 하나 더한다:

```ts
export interface SessionRecord {
  finishedAt: string;  // ISO
  date: string;        // YYYY-MM-DD (로컬)
  correct: number;
  total: number;
  track: Track;
}
```

- [ ] **Step 4: `TRACK` 과 `CS_SESSION_SIZE` 를 추가한다**

`lib/srs.ts` — 타입 import 에 `Track` 을 더하고, `DUE_DAYS` 옆에 추가한다:

```ts
/** 어떤 문제 유형이 어느 트랙에 속하는지. Record 이므로 QuizType 을 늘리면 컴파일이 깨진다. */
export const TRACK: Record<QuizType, Track> = {
  word: 'toeic',
  blank: 'toeic',
  arrange: 'toeic',
  cs: 'cs',
};
```

`lib/queue.ts` — `SESSION_SIZE` 아래에 추가한다. **`SESSION_SIZE` 는 건드리지 않는다.**

```ts
/** CS 한 판의 카드 수 */
export const CS_SESSION_SIZE = 10;
```

- [ ] **Step 5: `srsRepo` 를 고친다**

`lib/srsRepo.ts` — import 에 `Track` 을 더한다. `getSessions` 를 바꾼다:

```ts
/** track 은 CS 트랙이 생기면서 추가된 필드다. 그 전에 쌓인 기록은 전부 토익이다. */
type StoredSession = Omit<SessionRecord, 'track'> & { track?: Track };

export function getSessions(): SessionRecord[] {
  const v = load<StoredSession[]>(KEYS.sessions, []);
  if (!Array.isArray(v)) return [];
  return v.map((s) => ({ ...s, track: s.track ?? 'toeic' }));
}
```

`commitSession` 의 시그니처에 `track` 을 더하고 세션 레코드에 넣는다. **저장 세 줄의 위치는 그대로 루프 밖이다.**

```ts
export function commitSession(
  answers: AnsweredItem[],
  today: string,
  finishedAt: string,
  track: Track,
): { masteredCount: number } {
```

세션 저장 부분:

```ts
  save(KEYS.sessions, [
    ...getSessions(),
    {
      finishedAt,
      date: today,
      correct: answers.filter((a) => a.correct).length,
      total: answers.length,
      track,
    },
  ]);
```

- [ ] **Step 6: 호출부 세 곳을 고친다**

`components/GameRunner.tsx` — import 에 `TRACK` 을 더한다(`@/lib/srs` 에서). 56번 줄:

```ts
    const { masteredCount: mastered } = commitSession(finalAnswers, today, new Date().toISOString(), 'toeic');
```

58번 줄 — "내일 볼 단어"는 토익 카드만 세야 한다:

```ts
    setDueTomorrow(
      countDueOn(getCards().filter((c) => TRACK[c.type] === 'toeic'), addDays(today, 1)),
    );
```

`app/page.tsx:67-69` — 트랙 조건을 명시한다. 우연히 걸러지는 것에 의존하지 않는다:

```ts
        const live = cards.filter(
          (c) =>
            TRACK[c.type] === 'toeic' &&
            (c.type === 'word' ? wordById.has(c.itemId) : sentenceById.has(c.itemId)),
        );
```

import 에 `TRACK` 을 더한다(`@/lib/srs` 에 이미 `cardKey` 를 가져오고 있으면 거기에 붙인다).

`app/vocab/page.tsx:26` — `Record<QuizType, string>` 이므로 키를 채워야 컴파일된다:

```ts
const TYPE_LABEL: Record<QuizType, string> = {
  word: '단어',
  blank: '빈칸 채우기',
  arrange: '문장 조합',
  cs: 'CS',
};
```

`app/vocab/page.tsx:64` — 단어장은 토익만 보여준다. 졸업 항목도 같이 거른다:

```ts
      setState({
        status: 'ready',
        data: {
          cards: getCards().filter((c) => TRACK[c.type] === 'toeic'),
          mastered: getMastered().filter((m) => TRACK[m.type] === 'toeic'),
          bundle,
        },
      });
```

import 에 `TRACK` 을 더한다.

- [ ] **Step 7: 기존 `commitSession` 테스트 호출부를 고친다**

`tests/srsRepo.test.ts` 안의 기존 `commitSession(...)` 호출 전부에 네 번째 인자 `'toeic'` 을 더한다. 기존 테스트가 세션 레코드 전체를 비교하는 곳이 있으면 `track: 'toeic'` 을 기대값에 더한다.

Run: `grep -n "commitSession(" tests/srsRepo.test.ts` 로 전부 찾은 뒤 하나씩 고친다.

- [ ] **Step 8: 테스트와 타입 검사를 통과시킨다**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: 전부 통과. 테스트 수는 기존 86개 + 새로 7개 = 93개.

- [ ] **Step 9: 커밋**

```bash
git add lib/types.ts lib/srs.ts lib/queue.ts lib/srsRepo.ts \
  components/GameRunner.tsx app/page.tsx app/vocab/page.tsx \
  tests/srs.test.ts tests/queue.test.ts tests/srsRepo.test.ts
git commit -m "feat: introduce the track concept for a second study deck"
```

---

### Task 2: DB 스키마

**Files:**
- Create: `~/Desktop/proposs/supabase/migrations/012_cs_content.sql` (**다른 저장소다**)

**Interfaces:**
- Produces: `cs_sets(id, title, seq, created_at)`, `cs_cards(item_id, set_id, seq, topic, question, answer)`

- [ ] **Step 1: 마이그레이션을 쓴다**

`011_toeic_content.sql` 과 같은 형식을 따른다 — 재실행 가능, `bigserial`, `if not exists`, `drop policy if exists` 후 생성.

```sql
-- 컴퓨팅 사이언스 카드. 읽기는 누구나, 쓰기는 service_role 만.
-- 재실행 가능하게 작성한다 (011_toeic_content.sql 과 같은 방식).

create table if not exists cs_sets (
  id         bigserial primary key,
  title      text not null,
  seq        integer not null unique,
  created_at timestamptz not null default now()
);

create table if not exists cs_cards (
  item_id  text primary key,
  set_id   bigint not null references cs_sets(id) on delete cascade,
  seq      integer not null,
  topic    text not null,
  question text not null,
  answer   text not null
);

create index if not exists cs_cards_set on cs_cards (set_id, seq);

-- RLS: SELECT 만 허용한다. INSERT/UPDATE/DELETE 정책을 만들지 않으므로
-- 공개 키로는 쓸 수 없고 service_role 만 RLS 를 우회한다.
alter table cs_sets enable row level security;
alter table cs_cards enable row level security;

drop policy if exists "cs sets readable" on cs_sets;
create policy "cs sets readable" on cs_sets for select using (true);

drop policy if exists "cs cards readable" on cs_cards;
create policy "cs cards readable" on cs_cards for select using (true);
```

- [ ] **Step 2: 마이그레이션을 실행한다**

OURFLIX 저장소 **안에서** 실행한다. `SUPABASE_DB_URL` 을 TOEIC 프로젝트로 가져오지 않는다.

```bash
cd ~/Desktop/proposs
npm run migrate:sql -- supabase/migrations/012_cs_content.sql
```

**주의:** 그 스크립트(`scripts/run-migration.ts`)는 끝에 007번 마이그레이션용 확인 쿼리
(`SELECT … FROM groups`)가 하드코딩되어 있다. 012와 무관한 `groups: 총 N개 …` 줄이
찍히는 것은 정상이다. 그 쿼리가 실패해 `실패(롤백)` 이 찍혀도 **마이그레이션 SQL 은 이미
COMMIT 된 뒤**이므로 그 메시지를 믿지 말고 아래 Step 3·4로 실제 상태를 판단한다.

그 스크립트를 고치지 않는다 — 다른 저장소이고 이 작업의 범위가 아니다.

- [ ] **Step 3: 테이블이 생겼는지 확인한다**

TOEIC 프로젝트의 `.env.local` 의 공개 키로 조회한다. 빈 배열 `[]` 이 와야 한다(테이블은 있고 행은 없음).

```bash
cd ~/Desktop/day-by-day-TOEIC
set -a; . ./.env.local; set +a
K="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-$NEXT_PUBLIC_SUPABASE_ANON_KEY}"
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/cs_cards?select=item_id" \
  -H "apikey: $K" -H "Authorization: Bearer $K"
```

Expected: `[]`

- [ ] **Step 4: 공개 키로 쓸 수 없는지 확인한다**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/cs_cards" \
  -H "apikey: $K" -H "Authorization: Bearer $K" -H "Content-Type: application/json" \
  -d '{"item_id":"probe","set_id":1,"seq":1,"topic":"t","question":"q","answer":"a"}'
```

Expected: `401`. 200이나 201이 오면 RLS 정책이 잘못된 것이므로 멈추고 보고한다.

- [ ] **Step 5: 커밋 (OURFLIX 저장소)**

```bash
cd ~/Desktop/proposs
git add supabase/migrations/012_cs_content.sql
git commit -m "feat: add cs_sets and cs_cards for the day-by-day TOEIC app"
```

**푸시하지 않는다.** 사용자에게 확인받는다 — 다른 저장소이고 배포가 걸릴 수 있다.

---

### Task 3: 콘텐츠 읽기

**Files:**
- Modify: `lib/contentRepo.ts`
- Test: `tests/contentRepo.test.ts`

**Interfaces:**
- Consumes: `CsCard` (Task 1), `RawSet`(기존), `CardIdentity`(기존, `lib/srs.ts`)
- Produces:
  - `RawCsCard { item_id: string; set_id: number; seq: number; topic: string; question: string; answer: string }`
  - `CsBundle { cards: CsCard[]; candidates: CardIdentity[] }`
  - `toCsBundle(sets: RawSet[], cards: RawCsCard[]): CsBundle`
  - `fetchCsContent(): Promise<CsBundle | null>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/contentRepo.test.ts` 맨 끝에 추가한다. 파일 맨 위의 `sets` 픽스처(`{id:10,seq:2}, {id:20,seq:1}`)를 재사용한다 — `id` 와 `seq` 가 역방향이라 "seq 로 정렬한다"를 실제로 증명한다.

```ts
const rawCs = (item_id: string, set_id: number, seq: number): RawCsCard => ({
  item_id, set_id, seq,
  topic: '네트워크',
  question: 'TCP와 UDP의 차이는?',
  answer: 'TCP는 연결을 맺고 순서와 재전송을 보장한다. UDP는 보장하지 않는다.',
});

describe('toCsBundle', () => {
  it('묶음 seq 순으로 정렬한다 (id 순이 아니다)', () => {
    const out = toCsBundle(sets, [rawCs('cs-b', 20, 1), rawCs('cs-a', 10, 1)]);
    expect(out.cards.map((c) => c.id)).toEqual(['cs-b', 'cs-a']);
  });
  it('같은 묶음 안에서는 항목 seq 순으로 정렬한다', () => {
    const out = toCsBundle(sets, [rawCs('cs-2', 10, 2), rawCs('cs-1', 10, 1)]);
    expect(out.cards.map((c) => c.id)).toEqual(['cs-1', 'cs-2']);
  });
  it('모르는 set_id 를 가진 카드를 버린다', () => {
    const out = toCsBundle(sets, [rawCs('cs-1', 10, 1), rawCs('cs-x', 999, 1)]);
    expect(out.cards.map((c) => c.id)).toEqual(['cs-1']);
  });
  it('snake_case 를 앱 타입으로 옮긴다', () => {
    const out = toCsBundle(sets, [rawCs('cs-1', 10, 1)]);
    expect(out.cards[0]).toEqual({
      id: 'cs-1',
      topic: '네트워크',
      question: 'TCP와 UDP의 차이는?',
      answer: 'TCP는 연결을 맺고 순서와 재전송을 보장한다. UDP는 보장하지 않는다.',
    });
  });
  it('candidates 를 정렬된 순서대로 type cs 로 만든다', () => {
    const out = toCsBundle(sets, [rawCs('cs-2', 10, 2), rawCs('cs-1', 10, 1)]);
    expect(out.candidates).toEqual([
      { itemId: 'cs-1', type: 'cs' },
      { itemId: 'cs-2', type: 'cs' },
    ]);
  });
  it('카드가 없으면 빈 번들을 돌려준다', () => {
    expect(toCsBundle(sets, [])).toEqual({ cards: [], candidates: [] });
  });
});
```

import 에 `toCsBundle` 과 타입 `RawCsCard` 를 더한다.

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `npm test -- contentRepo`
Expected: FAIL. `toCsBundle` 이 export 되지 않았다.

- [ ] **Step 3: 구현한다**

`lib/contentRepo.ts` 에 추가한다. **`toBundle` 과 `fetchContent` 는 건드리지 않는다.**

```ts
export interface RawCsCard {
  item_id: string; set_id: number; seq: number;
  topic: string; question: string; answer: string;
}

export interface CsBundle {
  cards: CsCard[];
  candidates: CardIdentity[];   // 묶음 seq -> 항목 seq 순서
}

/** DB 행을 앱 타입으로 옮기고 도입 순서로 정렬한다. 알 수 없는 set_id 를 가진 카드는 버린다. */
export function toCsBundle(sets: RawSet[], cards: RawCsCard[]): CsBundle {
  const seqOf = new Map(sets.map((s) => [s.id, s.seq]));
  const ordered = cards
    .filter((c) => seqOf.has(c.set_id))
    .sort((a, b) => (seqOf.get(a.set_id)! - seqOf.get(b.set_id)!) || (a.seq - b.seq));

  return {
    cards: ordered.map((c) => ({
      id: c.item_id, topic: c.topic, question: c.question, answer: c.answer,
    })),
    candidates: ordered.map((c) => ({ itemId: c.item_id, type: 'cs' as const })),
  };
}

/** CS 콘텐츠를 한 번에 가져온다. 조회 실패는 null (콘텐츠 없음과 구분된다). */
export async function fetchCsContent(): Promise<CsBundle | null> {
  try {
    const sb = getSupabase();
    const [setsRes, cardsRes] = await Promise.all([
      sb.from('cs_sets').select('id,seq'),
      sb.from('cs_cards').select('item_id,set_id,seq,topic,question,answer'),
    ]);
    if (setsRes.error || cardsRes.error) return null;
    return toCsBundle((setsRes.data ?? []) as RawSet[], (cardsRes.data ?? []) as RawCsCard[]);
  } catch {
    return null;
  }
}
```

맨 위 타입 import 에 `CsCard` 를 더한다.

- [ ] **Step 4: 테스트를 통과시킨다**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: 전부 통과. 93 + 6 = 99개.

- [ ] **Step 5: 커밋**

```bash
git add lib/contentRepo.ts tests/contentRepo.test.ts
git commit -m "feat: read CS cards from Supabase"
```

---

### Task 4: 입력 스크립트

**Files:**
- Modify: `scripts/ingest.mjs` (`loadEnv`·`rest` 에 `export` 만 붙인다)
- Modify: `scripts/ingest.d.mts`
- Create: `scripts/ingest-cs.mjs`
- Create: `scripts/ingest-cs.d.mts`
- Modify: `package.json`
- Test: `tests/ingestCs.test.ts`

**Interfaces:**
- Consumes: `loadEnv()`, `rest(env)` (`scripts/ingest.mjs`)
- Produces: `validateCsInput(input: unknown, existingIds: Set<string>): { ok: boolean; errors: string[] }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/ingestCs.test.ts` 를 만든다:

```ts
import { describe, it, expect } from 'vitest';
import { validateCsInput } from '../scripts/ingest-cs.mjs';

const card = (id = 'cs-net-01', over: Record<string, unknown> = {}) => ({
  id,
  topic: '네트워크',
  question: 'TCP와 UDP의 차이는?',
  answer: 'TCP는 연결을 맺고 순서와 재전송을 보장한다. UDP는 보장하지 않아 더 빠르다.',
  ...over,
});
const input = (over: Record<string, unknown> = {}) => ({
  title: 'CS 1일차', cards: [card()], ...over,
});

describe('validateCsInput — 통과', () => {
  it('정상 입력을 통과시킨다', () => {
    expect(validateCsInput(input(), new Set())).toEqual({ ok: true, errors: [] });
  });
});

describe('validateCsInput — 구조', () => {
  it('title 이 없으면 실패한다', () => {
    const r = validateCsInput(input({ title: '' }), new Set());
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/title/);
  });
  it('cards 가 비면 실패한다', () => {
    const r = validateCsInput(input({ cards: [] }), new Set());
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/카드/);
  });
  it('cards 가 배열이 아니면 실패한다', () => {
    expect(validateCsInput(input({ cards: 'nope' }), new Set()).ok).toBe(false);
  });
  it('입력이 객체가 아니면 실패한다', () => {
    expect(validateCsInput(null, new Set()).ok).toBe(false);
  });
});

describe('validateCsInput — 필드', () => {
  for (const field of ['id', 'topic', 'question', 'answer']) {
    it(`${field} 가 없으면 실패한다`, () => {
      const r = validateCsInput(input({ cards: [card('cs-1', { [field]: '' })] }), new Set());
      expect(r.ok).toBe(false);
      expect(r.errors.join()).toMatch(new RegExp(field));
    });
  }
  it('오류를 모두 모아서 돌려준다 (첫 오류에서 멈추지 않는다)', () => {
    const r = validateCsInput(
      input({ cards: [card('cs-1', { topic: '', question: '' })] }),
      new Set(),
    );
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('validateCsInput — 중복', () => {
  it('파일 안의 id 중복을 잡는다', () => {
    const r = validateCsInput(input({ cards: [card('cs-1'), card('cs-1')] }), new Set());
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/cs-1/);
  });
  it('DB 에 이미 있는 id 를 잡는다', () => {
    const r = validateCsInput(input({ cards: [card('cs-1')] }), new Set(['cs-1']));
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/cs-1/);
  });
  it('겹치지 않는 id 는 통과한다', () => {
    expect(validateCsInput(input({ cards: [card('cs-2')] }), new Set(['cs-1'])).ok).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `npm test -- ingestCs`
Expected: FAIL. `scripts/ingest-cs.mjs` 가 없다.

- [ ] **Step 3: `ingest.mjs` 의 헬퍼를 export 한다**

`scripts/ingest.mjs` 의 두 줄에 `export` 만 붙인다. 함수 본문은 바꾸지 않는다.

```js
export function loadEnv() {
```

```js
export function rest(env) {
```

`scripts/ingest.d.mts` 에 선언을 더한다:

```ts
export function validateInput(
  input: unknown,
  existingIds: Set<string>,
): { ok: boolean; errors: string[] };

export function loadEnv(): Record<string, string>;

export function rest(env: Record<string, string>): {
  get(path: string): Promise<unknown>;
  post(path: string, body: unknown, prefer?: string): Promise<unknown>;
  del(path: string): Promise<void>;
};
```

- [ ] **Step 4: `ingest-cs.mjs` 를 만든다**

```js
import { readFileSync } from 'node:fs';
import { loadEnv, rest } from './ingest.mjs';

const CARD_FIELDS = ['id', 'topic', 'question', 'answer'];

export function validateCsInput(input, existingIds) {
  const errors = [];

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['입력이 객체가 아닙니다'] };
  }
  if (typeof input.title !== 'string' || input.title.trim() === '') {
    errors.push('title 이 비어 있습니다');
  }
  if (!Array.isArray(input.cards)) {
    errors.push('cards 가 배열이 아닙니다');
    return { ok: false, errors };
  }
  if (input.cards.length === 0) {
    errors.push('카드가 한 장도 없습니다');
  }

  const seen = new Set();
  input.cards.forEach((card, i) => {
    const at = `cards[${i}]`;
    if (typeof card !== 'object' || card === null) {
      errors.push(`${at} 가 객체가 아닙니다`);
      return;
    }
    for (const f of CARD_FIELDS) {
      if (typeof card[f] !== 'string' || card[f].trim() === '') {
        errors.push(`${at}.${f} 가 비어 있습니다`);
      }
    }
    const id = card.id;
    if (typeof id === 'string' && id.trim() !== '') {
      if (seen.has(id)) errors.push(`${at}.id 가 파일 안에서 중복됩니다: ${id}`);
      seen.add(id);
      if (existingIds.has(id)) errors.push(`${at}.id 가 DB 에 이미 있습니다: ${id}`);
    }
  });

  return { ok: errors.length === 0, errors };
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('사용법: npm run ingest:cs -- <파일 경로>');
    process.exit(1);
  }

  const input = JSON.parse(readFileSync(path, 'utf8'));
  const api = rest(loadEnv());

  const existing = await api.get('/cs_cards?select=item_id');
  const existingIds = new Set(existing.map((r) => r.item_id));

  const { ok, errors } = validateCsInput(input, existingIds);
  if (!ok) {
    console.error('검증 실패:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const sets = await api.get('/cs_sets?select=seq&order=seq.desc&limit=1');
  const nextSeq = sets.length ? sets[0].seq + 1 : 1;

  const [created] = await api.post(
    '/cs_sets', { title: input.title, seq: nextSeq }, 'return=representation',
  );
  const setId = created.id;

  try {
    await api.post('/cs_cards', input.cards.map((c, i) => ({
      item_id: c.id, set_id: setId, seq: i + 1,
      topic: c.topic, question: c.question, answer: c.answer,
    })));
  } catch (e) {
    console.error('카드 삽입 실패, 방금 만든 묶음을 되돌립니다:', e.message);
    try {
      await api.del(`/cs_sets?id=eq.${setId}`);
      console.error('묶음을 지웠습니다.');
    } catch (delErr) {
      console.error('묶음 삭제도 실패했습니다:', delErr.message);
      const left = await api.get(`/cs_cards?select=item_id&set_id=eq.${setId}`);
      console.error(`묶음 ${setId} 이 남아 있습니다. 카드 ${left.length}장.`);
    }
    process.exit(1);
  }

  console.log(`묶음 ${setId} (seq ${nextSeq}) 에 카드 ${input.cards.length}장을 넣었습니다.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
```

`scripts/ingest-cs.d.mts`:

```ts
export function validateCsInput(
  input: unknown,
  existingIds: Set<string>,
): { ok: boolean; errors: string[] };
```

`package.json` 의 `scripts` 에 추가한다:

```json
"ingest:cs": "node scripts/ingest-cs.mjs"
```

- [ ] **Step 5: 테스트를 통과시킨다**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: 전부 통과. 99 + 13 = 112개.

`main()` 이 `import.meta.url` 가드 안에 있으므로 테스트가 import 해도 실행되지 않는다. 실제로 그런지 확인한다 — 테스트가 네트워크를 타면 가드가 잘못된 것이다.

- [ ] **Step 6: 기존 토익 스크립트가 안 깨졌는지 확인한다**

Run: `npm test -- ingest`
Expected: 기존 `validateInput` 테스트 전부 통과. `export` 를 붙인 것 외에는 바뀐 게 없다.

- [ ] **Step 7: 커밋**

```bash
git add scripts/ingest.mjs scripts/ingest.d.mts scripts/ingest-cs.mjs \
  scripts/ingest-cs.d.mts package.json tests/ingestCs.test.ts
git commit -m "feat: add an ingest script for CS cards"
```

---

### Task 5: 시드 콘텐츠 5세트 50장

**Files:**
- Create: `content/cs/cs-01.json` ~ `content/cs/cs-05.json`

**Interfaces:**
- Consumes: `validateCsInput` 형식, `npm run ingest:cs` (Task 4)

**콘텐츠 기준 — 이걸 지키지 않으면 리뷰에서 반려된다**

- 세트당 10장. 한 세트 안에 주제를 섞는다: 자료구조·알고리즘 2, 네트워크 2, 운영체제 2, 데이터베이스 2, 백엔드 실무 2.
- `item_id` 는 `cs-<주제>-<번호>`. 주제 접두는 `cs-ds-`, `cs-net-`, `cs-os-`, `cs-db-`, `cs-be-`. 번호는 주제별로 01부터 이어서 붙인다(5세트에 걸쳐 주제마다 01~10).
- `topic` 은 한국어 표시용: `자료구조`, `알고리즘`, `네트워크`, `운영체제`, `데이터베이스`, `백엔드`.
- `answer` 는 3~4문장. **정의 한 줄로 끝내지 않고 "왜 그런지" 또는 "언제 쓰는지"를 한 문장 포함한다.**
- `question` 은 한 가지만 묻는다. "A와 B의 차이와 각각의 사용 사례는?" 처럼 두 개를 묻지 않는다.
- 확실하지 않은 수치·버전별 동작은 쓰지 않는다. 특정 프레임워크 버전에 종속된 내용은 백엔드 주제에서도 피한다.
- 사실만 쓴다. 애매하면 그 카드를 버리고 다른 주제를 쓴다.

- [ ] **Step 1: 첫 세트를 쓴다**

`content/cs/cs-01.json`:

```json
{
  "title": "CS 1일차",
  "cards": [
    {
      "id": "cs-ds-01",
      "topic": "자료구조",
      "question": "해시테이블의 평균 조회가 O(1)인 이유는?",
      "answer": "키를 해시 함수로 정수로 바꿔 배열의 위치를 직접 계산하기 때문에 원소 수와 무관하게 한 번에 접근한다. 다만 서로 다른 키가 같은 위치로 가는 충돌이 생기면 그 자리의 목록을 훑어야 한다. 그래서 최악에는 O(n)이 되고, 부하율이 높아지면 크기를 늘려 재배치한다."
    }
  ]
}
```

나머지 9장을 같은 형식으로 채운다. `cs-ds-01`, `cs-ds-02`, `cs-net-01`, `cs-net-02`, `cs-os-01`, `cs-os-02`, `cs-db-01`, `cs-db-02`, `cs-be-01`, `cs-be-02`.

- [ ] **Step 2: 첫 세트를 넣는다**

Run: `npm run ingest:cs -- content/cs/cs-01.json`
Expected: `묶음 N (seq 1) 에 카드 10장을 넣었습니다.`

검증에서 막히면 콘텐츠를 고친다. 스크립트를 고치지 않는다.

- [ ] **Step 3: 나머지 네 세트를 쓰고 넣는다**

`item_id` 50개를 미리 못박는다. 추측할 여지를 남기지 않는다.

| 파일 | `title` | `item_id` 10개 |
|---|---|---|
| `cs-01.json` | `CS 1일차` | `cs-ds-01` `cs-ds-02` `cs-net-01` `cs-net-02` `cs-os-01` `cs-os-02` `cs-db-01` `cs-db-02` `cs-be-01` `cs-be-02` |
| `cs-02.json` | `CS 2일차` | `cs-ds-03` `cs-ds-04` `cs-net-03` `cs-net-04` `cs-os-03` `cs-os-04` `cs-db-03` `cs-db-04` `cs-be-03` `cs-be-04` |
| `cs-03.json` | `CS 3일차` | `cs-ds-05` `cs-ds-06` `cs-net-05` `cs-net-06` `cs-os-05` `cs-os-06` `cs-db-05` `cs-db-06` `cs-be-05` `cs-be-06` |
| `cs-04.json` | `CS 4일차` | `cs-ds-07` `cs-ds-08` `cs-net-07` `cs-net-08` `cs-os-07` `cs-os-08` `cs-db-07` `cs-db-08` `cs-be-07` `cs-be-08` |
| `cs-05.json` | `CS 5일차` | `cs-ds-09` `cs-ds-10` `cs-net-09` `cs-net-10` `cs-os-09` `cs-os-10` `cs-db-09` `cs-db-10` `cs-be-09` `cs-be-10` |

`cs-ds-*` 10장은 자료구조와 알고리즘을 섞어 쓴다(`topic` 은 각각 `자료구조` 또는 `알고리즘`).
나머지 접두는 `topic` 이 하나씩 고정된다: `cs-net-*`→`네트워크`, `cs-os-*`→`운영체제`,
`cs-db-*`→`데이터베이스`, `cs-be-*`→`백엔드`.

파일 안의 카드 순서는 위 표의 순서를 그대로 따른다 — `seq` 가 그 순서로 붙는다.

```bash
npm run ingest:cs -- content/cs/cs-02.json
npm run ingest:cs -- content/cs/cs-03.json
npm run ingest:cs -- content/cs/cs-04.json
npm run ingest:cs -- content/cs/cs-05.json
```

- [ ] **Step 4: DB 상태를 확인한다**

```bash
cd ~/Desktop/day-by-day-TOEIC
set -a; . ./.env.local; set +a
K="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-$NEXT_PUBLIC_SUPABASE_ANON_KEY}"
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/cs_cards?select=set_id" \
  -H "apikey: $K" -H "Authorization: Bearer $K" \
  | tr ',' '\n' | grep -o '"set_id":[0-9]*' | sort | uniq -c
```

Expected: 5개 `set_id`, 각각 10장.

- [ ] **Step 5: 커밋**

```bash
git add content/cs
git commit -m "feat: add 50 seed CS cards across five sets"
```

---

### Task 6: CS 화면과 자기채점 러너

이 프로젝트에는 컴포넌트 테스트 기반이 없다(`tests/` 는 `lib/` 와 `scripts/` 만 테스트한다). 새 테스트 기반을 들이지 않는다 — 검증은 `tsc`·`lint`·`build` 와 실제 화면 확인으로 한다. 확인하지 못한 것은 확인하지 못했다고 보고한다.

**Files:**
- Create: `components/CsRunner.tsx`
- Create: `app/cs/page.tsx`
- Modify: `lib/date.ts` (`formatMonthDay` 를 옮겨 받는다)
- Modify: `app/page.tsx:25-28` (지역 `formatMonthDay` 를 지우고 import 한다)
- Test: `tests/date.test.ts`

**Interfaces:**
- Consumes: `fetchCsContent`·`CsBundle` (Task 3), `CS_SESSION_SIZE`·`buildQueue` (Task 1, 기존), `TRACK`·`cardKey` (Task 1), `commitSession(…, 'cs')` (Task 1), `getCards`·`getMasteredKeys`·`countDueOn` (기존), `todayStr`·`addDays` (기존 `lib/date.ts`)
- Produces:
  - `formatMonthDay(dateStr: string): string` (`lib/date.ts`)
  - `CsItem { identity: CardIdentity; card: CsCard }` (`components/CsRunner.tsx` 에서 export)
  - `CsRunner` 컴포넌트, `/cs` 라우트

- [ ] **Step 1: `formatMonthDay` 를 `lib/date.ts` 로 옮긴다**

`formatMonthDay` 는 지금 `app/page.tsx:25-28` 의 **지역 함수**다. `/cs` 도 같은 형식이
필요하므로 옮긴다. 세 줄짜리 함수를 두 화면에 복제하는 것보다 옮기는 편이 낫다.

`lib/date.ts` 맨 끝에 추가한다(본문은 그대로):

```ts
export function formatMonthDay(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}월 ${Number(d)}일`;
}
```

`app/page.tsx` 에서 25~28번 줄의 지역 함수를 지우고, 기존 `@/lib/date` import 에
`formatMonthDay` 를 더한다.

`tests/date.test.ts` 에 추가한다:

```ts
describe('formatMonthDay', () => {
  it('앞의 0을 떼고 한국어로 만든다', () => {
    expect(formatMonthDay('2026-08-09')).toBe('8월 9일');
  });
  it('두 자리 월과 일도 처리한다', () => {
    expect(formatMonthDay('2026-12-25')).toBe('12월 25일');
  });
});
```

import 에 `formatMonthDay` 를 더한다.

Run: `npm test -- date && npx tsc --noEmit`
Expected: 통과. `app/page.tsx` 가 여전히 컴파일된다.

- [ ] **Step 2: `app/cs/page.tsx` 를 만든다**

`app/page.tsx` 의 네 상태 구조를 그대로 따른다. **`error` 와 `empty` 를 합치지 않는다.**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import CsRunner, { type CsItem } from '@/components/CsRunner';
import { fetchCsContent } from '@/lib/contentRepo';
import { getCards, getMasteredKeys, countDueOn } from '@/lib/srsRepo';
import { buildQueue, CS_SESSION_SIZE } from '@/lib/queue';
import { TRACK } from '@/lib/srs';
import { todayStr, addDays, formatMonthDay } from '@/lib/date';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'no-content' }
  | { status: 'empty'; dueTomorrow: number; nextDueDate: string | null }
  | { status: 'ready'; items: CsItem[] };

export default function CsPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [round, setRound] = useState(0);

  const restart = useCallback(() => {
    setState({ status: 'loading' });
    setRound((r) => r + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const bundle = await fetchCsContent();
      if (cancelled) return;

      if (bundle === null) { setState({ status: 'error' }); return; }
      if (bundle.cards.length === 0) { setState({ status: 'no-content' }); return; }

      const cardById = new Map(bundle.cards.map((c) => [c.id, c]));
      const today = todayStr();
      // DB 에서 지워진 카드를 가리키는 SRS 카드는 큐 구성 전에 걸러낸다 —
      // 그렇지 않으면 판 한 자리를 조용히 잡아먹는다.
      const live = getCards().filter(
        (c) => TRACK[c.type] === 'cs' && cardById.has(c.itemId),
      );
      const queue = buildQueue(
        live, bundle.candidates, getMasteredKeys(), today, CS_SESSION_SIZE,
      );

      const items: CsItem[] = [];
      for (const identity of queue) {
        const card = cardById.get(identity.itemId);
        if (card) items.push({ identity, card });
      }

      if (cancelled) return;

      if (items.length === 0) {
        const nextDueDate = live.length > 0
          ? live.reduce((min, c) => (c.dueDate < min ? c.dueDate : min), live[0].dueDate)
          : null;
        setState({
          status: 'empty',
          dueTomorrow: countDueOn(live, addDays(today, 1)),
          nextDueDate,
        });
        return;
      }

      setState({ status: 'ready', items });
    }

    load();
    return () => { cancelled = true; };
  }, [round]);

  if (state.status === 'loading') {
    return (
      <div className="flex flex-1 flex-col">
        <Nav />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
        </div>
      </div>
    );
  }

  if (state.status === 'ready') {
    return <CsRunner items={state.items} onRestart={restart} />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <div className="flex flex-1 flex-col items-center bg-zinc-50 p-4 dark:bg-black">
        <div className="w-full max-w-xl py-8 text-center">
          {state.status === 'error' && (
            <>
              <p className="mb-2 text-xl font-semibold">불러오지 못했어요</p>
              <p className="mb-6 text-gray-500 dark:text-gray-400">
                연결을 확인하고 다시 시도해 주세요
              </p>
              <button
                type="button"
                onClick={restart}
                className="min-h-14 w-full rounded-lg bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
              >
                다시 시도
              </button>
            </>
          )}
          {state.status === 'no-content' && (
            <>
              <p className="mb-2 text-xl font-semibold">아직 CS 카드가 없어요</p>
              <p className="text-gray-500 dark:text-gray-400">카드를 넣으면 바로 나옵니다</p>
            </>
          )}
          {state.status === 'empty' && (
            <>
              <p className="mb-2 text-xl font-semibold">오늘 할 게 없어요</p>
              <p className="mb-6 text-gray-500 dark:text-gray-400">
                {state.nextDueDate === null
                  ? '모든 카드를 다 익혔어요'
                  : state.dueTomorrow > 0
                    ? `내일 ${state.dueTomorrow}장 볼 예정이에요`
                    : `다음 복습은 ${formatMonthDay(state.nextDueDate)}이에요`}
              </p>
              <Link
                href="/stats"
                className="flex min-h-14 w-full items-center justify-center rounded-lg border-2 border-gray-200 text-lg font-medium dark:border-gray-700"
              >
                통계 보기
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `components/CsRunner.tsx` 를 만든다**

`GameRunner` 의 상태 기계를 따르되 상호작용만 다르다. **`answers` 를 지역 변수 `finalAnswers` 로 만들어 `setAnswers` 와 `commitSession` 에 같이 넘긴다** — 상태를 읽어 저장하면 마지막 한 장이 빠진다(`GameRunner` 에서 실제로 났던 문제다).

```tsx
'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { commitSession, getCards, countDueOn, type AnsweredItem } from '@/lib/srsRepo';
import { cardKey, TRACK, type CardIdentity } from '@/lib/srs';
import { todayStr, addDays } from '@/lib/date';
import type { CsCard } from '@/lib/types';

/** `/cs` 화면과 공유하는 항목 모양. 두 곳에 따로 정의하면 어긋난다. */
export interface CsItem { identity: CardIdentity; card: CsCard }

export default function CsRunner({
  items, onRestart,
}: { items: CsItem[]; onRestart: () => void }) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<AnsweredItem[]>([]);
  const [phase, setPhase] = useState<'card' | 'result'>('card');
  const [masteredCount, setMasteredCount] = useState(0);
  const [dueTomorrow, setDueTomorrow] = useState(0);

  const grade = useCallback(
    (knew: boolean) => {
      const finalAnswers = [...answers, { identity: items[idx].identity, correct: knew }];
      setAnswers(finalAnswers);

      if (idx + 1 < items.length) {
        setIdx(idx + 1);
        setRevealed(false);
        return;
      }

      const today = todayStr();
      const { masteredCount: mastered } = commitSession(
        finalAnswers, today, new Date().toISOString(), 'cs',
      );
      setMasteredCount(mastered);
      setDueTomorrow(
        countDueOn(getCards().filter((c) => TRACK[c.type] === 'cs'), addDays(today, 1)),
      );
      setPhase('result');
    },
    [answers, idx, items],
  );

  const handleExit = useCallback(() => {
    if (answers.length > 0 && !window.confirm('지금 나가면 이번 판 기록이 사라져요. 나갈까요?')) {
      return;
    }
    router.push('/stats');
  }, [answers.length, router]);

  if (phase === 'result') {
    const knew = answers.filter((a) => a.correct).length;
    const total = answers.length;
    const rate = total > 0 ? Math.round((knew / total) * 100) : 0;
    const missed = items.filter((it) =>
      answers.some((a) => !a.correct && a.identity.itemId === it.identity.itemId),
    );

    return (
      <div className="flex flex-1 flex-col items-center bg-zinc-50 p-4 dark:bg-black">
        <div className="flex w-full max-w-xl flex-col gap-6 py-8">
          <div className="rounded-2xl border border-gray-200 p-6 text-center dark:border-gray-800">
            {masteredCount > 0 && (
              <p className="mb-3 text-sm font-semibold text-blue-600 dark:text-blue-400">
                {masteredCount}개 졸업했어요
              </p>
            )}
            <p className="text-sm text-gray-400 dark:text-gray-500">알았음 비율</p>
            <p className="mb-2 text-5xl font-bold text-blue-600 dark:text-blue-400">{rate}%</p>
            <p className="text-gray-500 dark:text-gray-400">{knew} / {total} 알았음</p>
          </div>

          {missed.length > 0 && (
            <div className="rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
              <p className="mb-3 text-sm text-gray-400 dark:text-gray-500">몰랐던 카드</p>
              <ul className="flex flex-col gap-2">
                {missed.map((it) => (
                  <li key={cardKey(it.identity.type, it.identity.itemId)} className="text-base">
                    {it.card.question}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 p-6 text-center dark:border-gray-800">
            <p className="text-lg font-medium">내일 볼 카드 {dueTomorrow}장</p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={onRestart}
              className="min-h-14 w-full rounded-lg bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
            >
              한 판 더
            </button>
            <Link
              href="/stats"
              className="flex min-h-14 w-full items-center justify-center rounded-lg border-2 border-gray-200 text-lg font-medium dark:border-gray-700"
            >
              통계 보기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const item = items[idx];
  const progress = ((idx + 1) / items.length) * 100;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={handleExit}
          className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          나가기
        </button>
        <div className="h-2 flex-1 rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className="h-2 rounded-full bg-blue-600 dark:bg-blue-400"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="w-12 shrink-0 text-right text-sm font-medium">
          {idx + 1} / {items.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center p-4">
        <div className="flex w-full max-w-xl flex-col gap-6">
          <div className="rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
            <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">{item.card.topic}</p>
            <p className="text-xl font-semibold leading-relaxed">{item.card.question}</p>
          </div>

          {revealed ? (
            <>
              <div className="rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
                <p className="text-base leading-relaxed">{item.card.answer}</p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => grade(true)}
                  className="min-h-14 w-full rounded-lg bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
                >
                  알았음
                </button>
                <button
                  type="button"
                  onClick={() => grade(false)}
                  className="min-h-14 w-full rounded-lg border-2 border-gray-200 text-lg font-medium dark:border-gray-700"
                >
                  몰랐음
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="min-h-14 w-full rounded-lg bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
            >
              답 보기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 타입·린트·빌드를 통과시킨다**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: 전부 통과(테스트 112 + 2 = 114개). 빌드 결과에 `/cs` 가 정적 페이지로 나온다.

- [ ] **Step 5: 화면을 실제로 확인한다**

Run: `npm run dev` (포어그라운드로 띄우고, 확인이 끝나면 반드시 종료한다)

`http://localhost:3000/cs` 에서 확인할 것:
1. 첫 카드의 질문과 주제가 보이고 답은 안 보인다
2. `답 보기` 를 누르면 답이 나오고 `알았음`/`몰랐음` 두 버튼이 나온다
3. 진행률이 `1 / 10` 에서 시작해 늘어난다
4. 10장을 끝내면 알았음 비율과 몰랐던 카드 목록이 나온다 — **"정답률"이라는 말이 어디에도 없다**
5. 판 중간에 `나가기` 를 누르면 확인을 묻고, 확인하면 `/stats` 로 간다
6. 다시 `/cs` 에 들어가면 "오늘 할 게 없어요"와 다음 복습 날짜가 나온다
7. `localStorage.setItem('ddt.srs', '[{"itemId":"없는카드","type":"cs","box":1,"dueDate":"2020-01-01"}]')` 를 넣고 새로 고쳐도 죽은 카드가 판을 잡아먹지 않는다

확인하지 못한 항목이 있으면 무엇을 못 봤는지 보고한다.

- [ ] **Step 6: 커밋**

```bash
git add components/CsRunner.tsx app/cs/page.tsx lib/date.ts app/page.tsx tests/date.test.ts
git commit -m "feat: add the CS deck screen and self-graded runner"
```

---

### Task 7: 진입점과 네비게이션

**Files:**
- Modify: `components/Nav.tsx:6-10`
- Modify: `components/GameRunner.tsx` (완료 화면 버튼 묶음)

**Interfaces:**
- Consumes: `/cs` 라우트 (Task 6)

- [ ] **Step 1: 네비게이션을 고친다**

`components/Nav.tsx` 의 `links` 를 바꾼다. 덱이 둘이 되면 `홈` 이 무엇을 가리키는지 모호해진다.

```ts
const links = [
  { href: '/', label: '토익' },
  { href: '/cs', label: 'CS' },
  { href: '/vocab', label: '단어장' },
  { href: '/stats', label: '통계' },
  { href: '/setup', label: '설치' },
];
```

`active` 판정은 그대로 둔다 — `'/'` 는 완전 일치, 나머지는 `startsWith` 이므로 `/cs` 가 올바르게 잡힌다.

- [ ] **Step 2: 토익 완료 화면에 CS 진입 버튼을 넣는다**

`components/GameRunner.tsx` 의 완료 화면 버튼 묶음(`한 판 더` 와 `통계 보기` 가 들어 있는 `<div className="flex flex-col gap-3">`)을 이렇게 바꾼다. **순서와 강조가 바뀐다** — 오늘 판을 끝낸 다음의 자연스러운 행동은 토익 한 판 더가 아니라 CS로 넘어가는 것이다.

```tsx
          <div className="flex flex-col gap-3">
            <Link
              href="/cs"
              className="flex min-h-14 w-full items-center justify-center rounded-lg bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
            >
              CS 10장 이어서 하기
            </Link>
            <button
              type="button"
              onClick={onRestart}
              className="min-h-14 w-full rounded-lg border-2 border-gray-200 text-lg font-medium dark:border-gray-700"
            >
              한 판 더
            </button>
            <Link
              href="/stats"
              className="flex min-h-14 w-full items-center justify-center rounded-lg border-2 border-gray-200 text-lg font-medium dark:border-gray-700"
            >
              통계 보기
            </Link>
          </div>
```

이 링크는 **항상 표시한다.** 토익 화면이 CS 콘텐츠를 미리 불러와 "오늘 CS 할 게 있나"를 판단하면 두 트랙이 결합되고 로딩도 느려진다. 할 게 없으면 `/cs` 가 알려준다.

- [ ] **Step 3: 확인한다**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Run: `npm run dev` (포어그라운드, 끝나면 종료)

확인할 것:
1. 네비게이션이 `토익 / CS / 단어장 / 통계 / 설치` 로 보이고, 좁은 화면(375px)에서도 가로 스크롤이 생기지 않는다
2. `/cs` 에 있을 때 `CS` 항목이 활성 표시된다
3. `/` 에 있을 때 `토익` 만 활성이다 (`/cs` 가 같이 활성되지 않는다)
4. 토익 한 판을 끝내면 `CS 10장 이어서 하기` 가 파란 주버튼으로 맨 위에 있고, 누르면 `/cs` 로 간다

- [ ] **Step 4: 커밋**

```bash
git add components/Nav.tsx components/GameRunner.tsx
git commit -m "feat: add CS entry points to the nav and the TOEIC finish screen"
```

---

### Task 8: 통계 트랙 분리

자기채점 "알았음" 비율과 4지선다 정답률을 한 숫자로 합치면 그 숫자는 아무 뜻이 없다. 이 태스크가 그걸 막는다.

**Files:**
- Create: `lib/stats.ts`
- Create: `tests/stats.test.ts`
- Modify: `app/stats/page.tsx`

**Interfaces:**
- Consumes: `TRACK` (Task 1), `countDueOn` (기존), `SessionRecord.track` (Task 1)
- Produces:
  ```ts
  export interface TrackStats {
    cards: number; mastered: number; sessions: number;
    dueToday: number; dueTomorrow: number;
    rate: number | null;                  // 판이 없으면 null
    boxCounts: Record<Box, number>;
  }
  export function trackStats(
    cards: SrsCard[], mastered: MasteredItem[], sessions: SessionRecord[],
    track: Track, today: string, tomorrow: string,
  ): TrackStats
  ```

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/stats.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { trackStats } from '@/lib/stats';
import type { SrsCard, MasteredItem, SessionRecord } from '@/lib/types';

const TODAY = '2026-08-09';
const TOMORROW = '2026-08-10';

const card = (itemId: string, type: SrsCard['type'], dueDate: string, box: SrsCard['box'] = 1): SrsCard =>
  ({ itemId, type, box, dueDate });
const mastered = (itemId: string, type: MasteredItem['type']): MasteredItem =>
  ({ itemId, type, masteredAt: '2026-08-01T00:00:00.000Z' });
const session = (track: SessionRecord['track'], correct: number, total: number): SessionRecord =>
  ({ finishedAt: '2026-08-09T10:00:00.000Z', date: TODAY, correct, total, track });

describe('trackStats — 트랙 분리', () => {
  const cards = [card('w-1', 'word', TODAY), card('cs-1', 'cs', TODAY)];
  const ms = [mastered('w-2', 'word'), mastered('cs-2', 'cs')];
  const ss = [session('toeic', 8, 10), session('cs', 3, 10)];

  it('토익 트랙은 토익 것만 센다', () => {
    const s = trackStats(cards, ms, ss, 'toeic', TODAY, TOMORROW);
    expect(s.cards).toBe(1);
    expect(s.mastered).toBe(1);
    expect(s.sessions).toBe(1);
    expect(s.rate).toBe(80);
  });
  it('CS 트랙은 CS 것만 센다', () => {
    const s = trackStats(cards, ms, ss, 'cs', TODAY, TOMORROW);
    expect(s.cards).toBe(1);
    expect(s.mastered).toBe(1);
    expect(s.sessions).toBe(1);
    expect(s.rate).toBe(30);
  });
  it('두 트랙의 비율이 섞이지 않는다', () => {
    const toeic = trackStats(cards, ms, ss, 'toeic', TODAY, TOMORROW);
    const cs = trackStats(cards, ms, ss, 'cs', TODAY, TOMORROW);
    expect(toeic.rate).not.toBe(cs.rate);
  });
  it('blank 와 arrange 도 토익으로 센다', () => {
    const s = trackStats(
      [card('s-1', 'blank', TODAY), card('s-1', 'arrange', TODAY)],
      [], [], 'toeic', TODAY, TOMORROW,
    );
    expect(s.cards).toBe(2);
  });
});

describe('trackStats — 비율', () => {
  it('판이 없으면 rate 가 null 이다 (0% 이 아니다)', () => {
    expect(trackStats([], [], [], 'cs', TODAY, TOMORROW).rate).toBeNull();
  });
  it('여러 판의 총합으로 계산한다 (판별 평균이 아니다)', () => {
    const ss = [session('cs', 10, 10), session('cs', 0, 90)];
    expect(trackStats([], [], ss, 'cs', TODAY, TOMORROW).rate).toBe(10);
  });
});

describe('trackStats — 예정과 분포', () => {
  it('오늘과 내일 예정을 트랙별로 센다', () => {
    const cards = [
      card('cs-1', 'cs', TODAY), card('cs-2', 'cs', TOMORROW),
      card('w-1', 'word', TODAY),
    ];
    const s = trackStats(cards, [], [], 'cs', TODAY, TOMORROW);
    expect(s.dueToday).toBe(1);
    expect(s.dueTomorrow).toBe(2);
  });
  it('박스별 개수를 센다', () => {
    const cards = [card('cs-1', 'cs', TODAY, 0), card('cs-2', 'cs', TODAY, 3)];
    const s = trackStats(cards, [], [], 'cs', TODAY, TOMORROW);
    expect(s.boxCounts).toEqual({ 0: 1, 1: 0, 2: 0, 3: 1 });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `npm test -- stats`
Expected: FAIL. `lib/stats.ts` 가 없다.

- [ ] **Step 3: `lib/stats.ts` 를 만든다**

```ts
import type { Box, MasteredItem, SessionRecord, SrsCard, Track } from './types';
import { TRACK } from './srs';
import { countDueOn } from './srsRepo';

export interface TrackStats {
  cards: number;
  mastered: number;
  sessions: number;
  dueToday: number;
  dueTomorrow: number;
  /** 판이 하나도 없으면 null. 0% 과 구분한다. */
  rate: number | null;
  boxCounts: Record<Box, number>;
}

/** 한 트랙의 통계를 뽑는다. 두 트랙의 비율을 섞지 않기 위해 트랙마다 따로 부른다. */
export function trackStats(
  cards: SrsCard[],
  mastered: MasteredItem[],
  sessions: SessionRecord[],
  track: Track,
  today: string,
  tomorrow: string,
): TrackStats {
  const c = cards.filter((x) => TRACK[x.type] === track);
  const m = mastered.filter((x) => TRACK[x.type] === track);
  const s = sessions.filter((x) => x.track === track);

  const answered = s.reduce((a, x) => a + x.total, 0);
  const correct = s.reduce((a, x) => a + x.correct, 0);

  const boxCounts: Record<Box, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const x of c) boxCounts[x.box] += 1;

  return {
    cards: c.length,
    mastered: m.length,
    sessions: s.length,
    dueToday: countDueOn(c, today),
    dueTomorrow: countDueOn(c, tomorrow),
    rate: answered === 0 ? null : Math.round((correct / answered) * 100),
    boxCounts,
  };
}
```

- [ ] **Step 4: 테스트를 통과시킨다**

Run: `npm test -- stats`
Expected: PASS, 8개.

- [ ] **Step 5: `/stats` 를 트랙별 두 구역으로 바꾼다**

`app/stats/page.tsx` 를 고친다. 유지할 것: 로딩 스피너, 기록이 아예 없을 때의 빈 화면, `BOX_LABEL` 4개, `SummaryTile`·`StageBar`·`EmptyCard` 컴포넌트, `bg-zinc-50 dark:bg-black`·`max-w-xl` 골격.

바꿀 것 — 상단 요약을 스트릭 하나로 줄이고, 그 아래를 두 구역으로 나눈다.

먼저 `app/stats/page.tsx:74-83` 의 계산 블록을 아래 것으로 **교체한다.**
`dueToday`·`dueTomorrow`·`boxCounts`·`maxBoxCount` 네 변수는 `trackStats` 안으로
들어가므로 지운다. 남겨두면 린트가 미사용으로 잡는다.

```tsx
  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const streak = calcStreak(sessions, today);
  const toeic = trackStats(cards, mastered, sessions, 'toeic', today, tomorrow);
  const cs = trackStats(cards, mastered, sessions, 'cs', today, tomorrow);
  const sortedSessions = [...sessions].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
```

본문:

```tsx
          <h1 className="text-2xl font-bold">통계</h1>

          <div className="rounded-2xl border border-gray-200 p-4 text-center dark:border-gray-800">
            <p className="mb-1 text-xs text-gray-400 dark:text-gray-500">연속 학습</p>
            <p className="text-3xl font-bold">🔥 {streak}일</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              토익이든 CS든 하루에 하나만 해도 이어져요
            </p>
          </div>

          <TrackSection title="토익" rateLabel="정답률" unit="개" stats={toeic} />
          <TrackSection title="컴퓨팅 사이언스" rateLabel="알았음 비율" unit="장" stats={cs} />

          <section>
            <h2 className="mb-3 text-lg font-semibold">세션 기록</h2>
            {sortedSessions.length === 0 ? (
              <EmptyCard text="아직 완료한 판이 없어요" />
            ) : (
              <div className="flex flex-col gap-2">
                {sortedSessions.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-2xl border border-gray-200 p-4 dark:border-gray-800"
                  >
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {s.track === 'cs' ? 'CS' : '토익'}
                      </p>
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        {new Date(s.finishedAt).toLocaleString('ko-KR')}
                      </p>
                    </div>
                    <p className="text-xl font-bold">
                      {s.correct} / {s.total}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
```

파일 아래쪽에 컴포넌트를 더한다:

```tsx
function TrackSection({
  title, rateLabel, unit, stats,
}: { title: string; rateLabel: string; unit: string; stats: TrackStats }) {
  const max = Math.max(1, ...BOXES.map((b) => stats.boxCounts[b]));
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <SummaryTile label="졸업" value={`${stats.mastered}${unit}`} />
          <SummaryTile label="학습 중" value={`${stats.cards}${unit}`} />
          <SummaryTile label="오늘 예정" value={`${stats.dueToday}${unit}`} />
        </div>
        <div className="rounded-2xl border border-gray-200 p-4 text-center dark:border-gray-800">
          <p className="mb-1 text-xs text-gray-400 dark:text-gray-500">{rateLabel}</p>
          <p className="text-3xl font-bold">
            {stats.rate === null ? '—' : `${stats.rate}%`}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {stats.sessions === 0 ? '아직 판이 없어요' : `${stats.sessions}판`}
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
          {BOXES.map((box) => (
            <StageBar key={box} label={BOX_LABEL[box]} count={stats.boxCounts[box]} max={max} />
          ))}
        </div>
      </div>
    </section>
  );
}
```

import 에 `trackStats`·`TrackStats`(`@/lib/stats`)를 더한다. 더 이상 쓰지 않는 `countDueOn` import 는 지운다(린트가 잡는다).

맨 아래의 `홈으로` 링크 문구를 `토익 하러 가기` 로 바꾼다 — 네비게이션에서 `홈` 이 사라졌으므로 말이 맞지 않는다.

- [ ] **Step 6: 확인한다**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: 전부 통과. 114 + 8 = 122개.

Run: `npm run dev` (포어그라운드, 끝나면 종료)

`http://localhost:3000/stats` 에서 확인할 것:
1. 스트릭이 하나만 보이고 그 아래에 토익·컴퓨팅 사이언스 두 구역이 있다
2. 토익 구역은 `정답률`, CS 구역은 `알았음 비율` 이라고 쓰여 있다
3. 판이 없는 트랙의 비율이 `0%` 가 아니라 `—` 로 나온다
4. 세션 기록의 각 줄에 `토익` 또는 `CS` 라벨이 붙는다
5. 좁은 화면(375px)에서 가로 스크롤이 생기지 않는다

- [ ] **Step 7: 커밋**

```bash
git add lib/stats.ts tests/stats.test.ts app/stats/page.tsx
git commit -m "feat: split stats by track so the two rates never mix"
```

---

## 마지막 확인 (전체 태스크 후)

- [ ] `npm test && npx tsc --noEmit && npm run lint && npm run build` 전부 통과
- [ ] `grep -rn "fetch(\|localStorage" app components` 로 저장소 경계 확인 — `lib/` 밖에서 직접 부르는 곳이 없어야 한다
- [ ] `grep -rn "SERVICE_ROLE" app components lib` 로 서비스 키가 클라이언트 코드에 없는지 확인
- [ ] 빌드된 클라이언트 청크에 서비스 키 문자열이 없는지 확인:
      `grep -rl "sb_secret" .next/static 2>/dev/null || echo "없음"`
- [ ] `README.md` 에 CS 트랙과 `npm run ingest:cs` 를 한 단락으로 추가
- [ ] `docs/superpowers/specs/2026-08-09-cs-knowledge-design.md` §17 변경 이력에 구현 완료를 한 줄 추가
- [ ] **푸시와 배포는 사용자에게 확인받는다.** OURFLIX 저장소의 마이그레이션 커밋도 따로 확인받는다.
- [ ] 확인하지 못한 것을 목록으로 보고한다 — 특히 실제 폰에서의 화면은 확인할 수 없다
