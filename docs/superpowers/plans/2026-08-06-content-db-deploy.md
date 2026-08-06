# 콘텐츠 DB 전환 + 웹 배포 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단어·문장 콘텐츠를 레포의 정적 JSON에서 Supabase로 옮기고, 매일 콘텐츠를 넣는 입력 스크립트를 만들고, Vercel에 배포한다.

**Architecture:** OURFLIX와 같은 Supabase 프로젝트에 `toeic_sets` / `toeic_words` / `toeic_sentences` 세 테이블을 추가한다. 읽기는 anon key로 누구나, 쓰기는 `service_role`만 (쓰기 정책을 아예 만들지 않는다). `lib/contentRepo.ts`가 전체 콘텐츠를 한 번에 가져오는 `fetchContent()`로 교체되고, 콘텐츠가 파일에서 오지 않으므로 `sourceDate` 필드가 사라진다. 진도는 계속 `localStorage`에 있고 인증은 이번 범위가 아니다.

**Tech Stack:** Next.js 16.3 / React 19.2 / TypeScript / Tailwind 4 / Vitest / Supabase (`@supabase/supabase-js` 신규 추가)

**Spec:** `docs/superpowers/specs/2026-08-06-web-deploy-supabase-design.md`

## Global Constraints

- **인증 코드를 만들지 않는다.** 로그인·서버 진도·공유는 다음 스펙이다. 진도는 계속 `localStorage`
- 새 의존성은 `@supabase/supabase-js` **하나만** 추가한다. 차트 라이브러리, 상태 관리 라이브러리, ORM 금지
- **입력 스크립트는 supabase-js를 쓰지 않고 `fetch`로 REST를 직접 호출한다.** 확인된 사실: Node 20에서 `createClient`가 realtime 때문에 `ws`를 요구하며 던진다. `fetch`를 쓰면 이 문제와 추가 의존성을 모두 피한다
- `SUPABASE_SERVICE_ROLE_KEY`는 `.env.local`에만 두고 **브라우저 코드에서 절대 import하지 않는다.** Vercel 환경변수에도 넣지 않는다
- 콘텐츠 테이블에 **INSERT/UPDATE/DELETE 정책을 만들지 않는다.** RLS가 켜져 있고 정책이 없으면 anon key로 쓸 수 없다
- 스케줄링 규칙(box 전이, 간격 1/3/7/14, 졸업, 복습 우선, 20문항 상한)은 변경하지 않는다. `sourceDate` 제거만 반영한다
- 카드 신원은 `(type, itemId)` 쌍. `item_id`를 텍스트 그대로 유지해 **기존 사용자 진도가 살아 있어야 한다**
- 새 항목 순서: `toeic_sets.seq` → 묶음 내 단어(`seq`) → 문장 빈칸(`seq`) → 같은 순서로 조합
- 조회 실패와 "콘텐츠 없음"을 **반드시 구분**한다. 조회 실패를 "오늘 할 게 없어요"로 표시하면 안 된다 (v1에서 실제 결함이었다)
- 모든 사용자 노출 문구는 한국어
- `lib/quiz.ts`, `lib/date.ts`는 변경하지 않는다
- 마이그레이션 SQL은 **OURFLIX 레포**(`~/Desktop/proposs/supabase/migrations/`)에 추가한다. 이 레포에 `supabase/` 디렉토리를 만들지 않는다

## 확인된 환경 사실

구현 전에 컨트롤러가 확인한 것들이다. 다시 조사하지 않아도 된다.

- Supabase URL 호스트: `ndvcivisvzsspqgixqaa.supabase.co`
- 키 형식은 신형식이다: anon은 `sb_publishable_...`, service는 `sb_secret_...`
- 두 키 모두 REST 호출이 **정상 동작한다** (없는 테이블 조회 시 `PGRST205` 404 — 인증 통과 신호)
- `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 세 개가 이미 있고 gitignore된다
- OURFLIX의 최신 마이그레이션은 `010_travel_popup.sql`이므로 **다음 번호는 011**
- OURFLIX에 `npm run migrate:sql -- <파일>`이 있고 트랜잭션으로 감싼다 (`scripts/run-migration.ts`, `.env`의 `SUPABASE_DB_URL` 사용)

## 파일 구조

```
~/Desktop/proposs/
  supabase/migrations/011_toeic_content.sql   # 신규 — Task 1

~/Desktop/day-by-day-TOEIC/
  lib/
    supabase.ts        # 신규 — 브라우저 클라이언트 — Task 2
    contentRepo.ts     # 다시 씀 — fetchContent() — Task 2, Task 4에서 옛 함수 삭제
    types.ts           # 수정 — sourceDate 제거, DayContent/DayIndexEntry 삭제 — Task 4
    srs.ts             # 수정 — CardIdentity에서 sourceDate 제거 — Task 4
    queue.ts           # 수정 — sourceDate 참조 제거 — Task 4
    srsRepo.ts         # 수정 — sourceDate 참조 제거 — Task 4
  app/
    page.tsx           # 수정 — 번들로 후보 생성, 오류/빈 상태 구분 — Task 4
    vocab/page.tsx     # 수정 — 번들로 원문 조회 — Task 4
  scripts/
    ingest.mjs         # 신규 — Task 3
    validate-data.mjs  # 삭제 — Task 5
  public/data/         # 삭제 — Task 5
  tests/
    ingest.test.ts     # 신규 — Task 3
    contentRepo.test.ts # 신규 — Task 2
    srs.test.ts, queue.test.ts, srsRepo.test.ts  # sourceDate 제거 반영 — Task 4
  README.md            # 수정 — Task 5
```

**작업 순서의 이유:** Task 2가 `fetchContent()`를 **기존 함수 옆에 추가**하고, Task 3이 스크립트를 만들어 Task 3 안에서 14일치를 DB에 넣는다. 화면 전환(Task 4)은 DB에 데이터가 이미 있는 상태에서 한다. 그래서 모든 태스크 경계에서 `npm run build`가 통과하고, 화면이 깨진 채로 커밋되는 구간이 없다.

---

### Task 1: 마이그레이션 SQL 작성 및 실행

**Files:**
- Create: `~/Desktop/proposs/supabase/migrations/011_toeic_content.sql`

**Interfaces:**
- Produces: Supabase에 `toeic_sets`, `toeic_words`, `toeic_sentences` 테이블과 SELECT 전용 RLS

**중요:** 이 태스크는 **OURFLIX 레포를 수정하는 유일한 지점**이다. 기존 마이그레이션 파일을 건드리지 말고 새 파일만 추가한다. OURFLIX의 다른 파일, `.env`, `package.json`은 손대지 않는다.

- [ ] **Step 1: 마이그레이션 파일 작성**

`~/Desktop/proposs/supabase/migrations/011_toeic_content.sql`:

```sql
-- day-by-day TOEIC 콘텐츠 (단어/문장). 읽기는 누구나, 쓰기는 service_role 만.
-- 재실행 가능하게 작성한다 (001_schema.sql 과 같은 방식).

create table if not exists toeic_sets (
  id         bigserial primary key,
  title      text not null,
  seq        integer not null unique,
  created_at timestamptz not null default now()
);

create table if not exists toeic_words (
  item_id    text primary key,
  set_id     bigint not null references toeic_sets(id) on delete cascade,
  seq        integer not null,
  word       text not null,
  pos        text not null,
  meaning    text not null,
  example    text not null,
  example_ko text not null
);

create table if not exists toeic_sentences (
  item_id     text primary key,
  set_id      bigint not null references toeic_sets(id) on delete cascade,
  seq         integer not null,
  text        text not null,
  ko          text not null,
  blank_word  text not null,
  distractors text[] not null check (array_length(distractors, 1) = 3)
);

create index if not exists toeic_words_set on toeic_words (set_id, seq);
create index if not exists toeic_sentences_set on toeic_sentences (set_id, seq);

-- RLS: SELECT 만 허용한다. INSERT/UPDATE/DELETE 정책을 만들지 않으므로
-- anon key 로는 쓸 수 없고 service_role 만 RLS 를 우회한다.
alter table toeic_sets enable row level security;
alter table toeic_words enable row level security;
alter table toeic_sentences enable row level security;

drop policy if exists "toeic sets readable" on toeic_sets;
create policy "toeic sets readable" on toeic_sets for select using (true);

drop policy if exists "toeic words readable" on toeic_words;
create policy "toeic words readable" on toeic_words for select using (true);

drop policy if exists "toeic sentences readable" on toeic_sentences;
create policy "toeic sentences readable" on toeic_sentences for select using (true);
```

- [ ] **Step 2: 실행**

Run:
```bash
cd ~/Desktop/proposs && npm run migrate:sql -- supabase/migrations/011_toeic_content.sql
```

Expected: 성공 메시지. 이 스크립트는 `.env`의 `SUPABASE_DB_URL`로 접속하고 트랜잭션으로 감싼다. **DB 접속 정보를 TOEIC 프로젝트로 복사하지 않는다.**

- [ ] **Step 3: 테이블 생성과 RLS 확인**

anon key로 세 테이블을 조회해 200이 오는지 확인한다 (빈 배열이 정상):

```bash
cd ~/Desktop/day-by-day-TOEIC
URL=$(grep -E "^NEXT_PUBLIC_SUPABASE_URL=" .env.local | cut -d= -f2-)
ANON=$(grep -E "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" .env.local | cut -d= -f2-)
for t in toeic_sets toeic_words toeic_sentences; do
  echo -n "$t read: "
  curl -s -o /dev/null -w "%{http_code}\n" "$URL/rest/v1/$t?select=*&limit=1" \
    -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
done
```

Expected: 세 줄 모두 `200`.

- [ ] **Step 4: 쓰기가 막혔는지 확인 — 이게 이 태스크의 핵심 검증이다**

anon key로 INSERT를 시도해 **거부되는지** 확인한다:

```bash
curl -s -o /dev/null -w "anon insert: %{http_code}\n" -X POST "$URL/rest/v1/toeic_sets" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -d '{"title":"probe","seq":999999}'
```

Expected: `401` 또는 `403`. **200이나 201이 오면 RLS가 잘못된 것이다** — anon key는 브라우저에 노출되므로 누구나 문제를 바꿀 수 있게 된다. 이 경우 멈추고 보고한다.

만약 실수로 행이 들어갔다면 지운다:
```bash
cd ~/Desktop/proposs && npm run migrate:sql -- /dev/stdin <<< "delete from toeic_sets where title = 'probe';"
```

- [ ] **Step 5: 커밋 (OURFLIX 레포)**

```bash
cd ~/Desktop/proposs
git add supabase/migrations/011_toeic_content.sql
git commit -m "feat: add toeic content tables for day-by-day-TOEIC"
```

**push하지 않는다.** TOEIC 레포에는 커밋할 것이 없다.

---

### Task 2: Supabase 클라이언트 + `fetchContent()`

**Files:**
- Create: `lib/supabase.ts`, `tests/contentRepo.test.ts`
- Modify: `lib/contentRepo.ts` (추가만 — 기존 함수는 Task 4까지 남긴다), `package.json`

**Interfaces:**
- Consumes: Task 1의 테이블. `Word`, `Sentence` (`lib/types.ts`, 기존)
- Produces:

```ts
// lib/supabase.ts
export function getSupabase(): SupabaseClient;   // 모듈 스코프에 한 번 만들고 재사용

// lib/contentRepo.ts — 추가되는 것
export interface ContentBundle {
  words: Word[];          // 도입 순서로 정렬됨
  sentences: Sentence[];  // 도입 순서로 정렬됨
}
export async function fetchContent(): Promise<ContentBundle | null>;   // 실패하면 null

// 정렬 로직을 테스트할 수 있게 순수 함수로 분리한다
export interface RawSet { id: number; seq: number }
export interface RawWord { item_id: string; set_id: number; seq: number; word: string; pos: string; meaning: string; example: string; example_ko: string }
export interface RawSentence { item_id: string; set_id: number; seq: number; text: string; ko: string; blank_word: string; distractors: string[] }
export function toBundle(sets: RawSet[], words: RawWord[], sentences: RawSentence[]): ContentBundle;
```

**DB는 snake_case, 앱은 camelCase다.** `example_ko` → `exampleKo`, `blank_word` → `blankWord` 매핑이 `toBundle`의 일이다. `Word.id`와 `Sentence.id`는 `item_id`에서 온다.

**`ContentBundle`은 Task 4에서 `candidates: CardIdentity[]` 필드가 추가된다.** 이 태스크에서 미리 넣지 않는 이유: `CardIdentity`가 아직 `sourceDate`를 필수 필드로 갖고 있어서(Task 4에서 제거된다) 지금은 올바른 값을 만들 수 없다. 이 태스크는 `words`/`sentences` 두 필드만 다룬다 — 인터페이스가 나중에 자라는 것은 의도된 것이고 드리프트가 아니다.

- [ ] **Step 1: 의존성 추가**

```bash
npm i @supabase/supabase-js
```

- [ ] **Step 2: 실패하는 테스트 작성** — `tests/contentRepo.test.ts`

`toBundle`만 테스트한다. 네트워크를 타는 `fetchContent`는 테스트하지 않는다.

```ts
import { describe, it, expect } from 'vitest';
import { toBundle } from '@/lib/contentRepo';
import type { RawSet, RawWord, RawSentence } from '@/lib/contentRepo';

const sets: RawSet[] = [
  { id: 20, seq: 2 },
  { id: 10, seq: 1 },
];
const rawWord = (item_id: string, set_id: number, seq: number): RawWord => ({
  item_id, set_id, seq,
  word: 'w', pos: 'v.', meaning: '뜻', example: 'e', example_ko: 'ek',
});
const rawSentence = (item_id: string, set_id: number, seq: number): RawSentence => ({
  item_id, set_id, seq,
  text: 'The manager will negotiate the contract.', ko: '해석',
  blank_word: 'negotiate', distractors: ['a', 'b', 'c'],
});

describe('toBundle — 순서', () => {
  it('묶음 seq 순으로 정렬한다 (id 순이 아니다)', () => {
    const words = [rawWord('w-b', 20, 1), rawWord('w-a', 10, 1)];
    const out = toBundle(sets, words, []);
    expect(out.words.map((w) => w.id)).toEqual(['w-a', 'w-b']);
  });
  it('같은 묶음 안에서는 항목 seq 순으로 정렬한다', () => {
    const words = [rawWord('w-2', 10, 2), rawWord('w-1', 10, 1)];
    const out = toBundle(sets, words, []);
    expect(out.words.map((w) => w.id)).toEqual(['w-1', 'w-2']);
  });
  it('문장도 같은 규칙으로 정렬한다', () => {
    const sentences = [rawSentence('s-b', 20, 1), rawSentence('s-a', 10, 1)];
    const out = toBundle(sets, [], sentences);
    expect(out.sentences.map((s) => s.id)).toEqual(['s-a', 's-b']);
  });
  it('알 수 없는 set_id를 가진 항목은 버린다', () => {
    const words = [rawWord('w-orphan', 999, 1), rawWord('w-ok', 10, 1)];
    const out = toBundle(sets, words, []);
    expect(out.words.map((w) => w.id)).toEqual(['w-ok']);
  });
});

describe('toBundle — 필드 매핑', () => {
  it('snake_case를 camelCase로 옮긴다', () => {
    const out = toBundle(sets, [rawWord('w-1', 10, 1)], [rawSentence('s-1', 10, 1)]);
    expect(out.words[0]).toEqual({
      id: 'w-1', word: 'w', pos: 'v.', meaning: '뜻', example: 'e', exampleKo: 'ek',
    });
    expect(out.sentences[0]).toEqual({
      id: 's-1',
      text: 'The manager will negotiate the contract.',
      ko: '해석',
      blankWord: 'negotiate',
      distractors: ['a', 'b', 'c'],
    });
  });
  it('빈 입력은 빈 번들이다', () => {
    expect(toBundle([], [], [])).toEqual({ words: [], sentences: [] });
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run tests/contentRepo.test.ts`
Expected: FAIL — `toBundle`이 export되지 않음

- [ ] **Step 4: 구현**

`lib/supabase.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** 브라우저용 Supabase 클라이언트. anon key 는 공개되도록 설계된 값이다. */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase 환경변수가 없습니다');
  client = createClient(url, key);
  return client;
}
```

`lib/contentRepo.ts` — 기존 `fetchIndex`/`fetchDay`는 **그대로 두고** 아래를 추가한다 (Task 4에서 옛 함수를 지운다):

```ts
import type { Word, Sentence } from './types';
import { getSupabase } from './supabase';

export interface ContentBundle {
  words: Word[];
  sentences: Sentence[];
}

export interface RawSet { id: number; seq: number }
export interface RawWord {
  item_id: string; set_id: number; seq: number;
  word: string; pos: string; meaning: string; example: string; example_ko: string;
}
export interface RawSentence {
  item_id: string; set_id: number; seq: number;
  text: string; ko: string; blank_word: string; distractors: string[];
}

/**
 * DB 행을 앱 타입으로 옮기고 도입 순서로 정렬한다.
 * 순서: 묶음 seq -> 항목 seq. 알 수 없는 set_id 를 가진 항목은 버린다.
 */
export function toBundle(sets: RawSet[], words: RawWord[], sentences: RawSentence[]): ContentBundle {
  const seqOf = new Map(sets.map((s) => [s.id, s.seq]));
  const order = <T extends { set_id: number; seq: number }>(rows: T[]): T[] =>
    rows
      .filter((r) => seqOf.has(r.set_id))
      .slice()
      .sort((a, b) => (seqOf.get(a.set_id)! - seqOf.get(b.set_id)!) || (a.seq - b.seq));

  return {
    words: order(words).map((w) => ({
      id: w.item_id, word: w.word, pos: w.pos, meaning: w.meaning,
      example: w.example, exampleKo: w.example_ko,
    })),
    sentences: order(sentences).map((s) => ({
      id: s.item_id, text: s.text, ko: s.ko,
      blankWord: s.blank_word, distractors: s.distractors,
    })),
  };
}

/** 전체 콘텐츠를 한 번에 가져온다. 조회 실패는 null (콘텐츠 없음과 구분된다). */
export async function fetchContent(): Promise<ContentBundle | null> {
  try {
    const sb = getSupabase();
    const [setsRes, wordsRes, sentencesRes] = await Promise.all([
      sb.from('toeic_sets').select('id,seq'),
      sb.from('toeic_words').select('item_id,set_id,seq,word,pos,meaning,example,example_ko'),
      sb.from('toeic_sentences').select('item_id,set_id,seq,text,ko,blank_word,distractors'),
    ]);
    if (setsRes.error || wordsRes.error || sentencesRes.error) return null;
    return toBundle(
      (setsRes.data ?? []) as RawSet[],
      (wordsRes.data ?? []) as RawWord[],
      (sentencesRes.data ?? []) as RawSentence[],
    );
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run tests/contentRepo.test.ts` → PASS (6 tests)
Run: `npm test` → 기존 58개 + 신규 6개 = 64개. 실제 수를 보고한다
Run: `npx tsc --noEmit && npx eslint .` → 깨끗

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json lib/supabase.ts lib/contentRepo.ts tests/contentRepo.test.ts
git commit -m "feat: fetch content from Supabase"
```

---

### Task 3: 입력 스크립트 + 기존 14일치 이전

**Files:**
- Create: `scripts/ingest.mjs`, `tests/ingest.test.ts`
- Modify: `package.json` (scripts에 `ingest` 추가)

**Interfaces:**
- Consumes: Task 1의 테이블. `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Produces: `npm run ingest -- <파일경로>`. 검증 함수는 테스트를 위해 export한다:

```js
// scripts/ingest.mjs
export function validateInput(input, existingIds);
// -> { ok: true } | { ok: false, errors: string[] }
// existingIds: Set<string> — DB에 이미 있는 item_id
```

**supabase-js를 쓰지 않는다.** 확인된 사실: Node 20에서 `createClient`가 realtime 때문에 `ws`를 요구하며 던진다. `fetch`로 REST를 직접 호출하면 이 문제와 추가 의존성을 모두 피한다.

REST 호출 형태:
```
GET  {URL}/rest/v1/toeic_words?select=item_id
POST {URL}/rest/v1/toeic_sets      (헤더 Prefer: return=representation 으로 생성된 id 를 받는다)
POST {URL}/rest/v1/toeic_words     (배열 본문으로 벌크 insert)
DELETE {URL}/rest/v1/toeic_sets?id=eq.{id}
```
모든 호출에 `apikey`와 `Authorization: Bearer` 헤더로 **service key**를 넣는다.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/ingest.test.ts`

검증 로직만 테스트한다. 네트워크는 테스트하지 않는다.

```ts
import { describe, it, expect } from 'vitest';
import { validateInput } from '../scripts/ingest.mjs';

const word = (id = 'w-renew') => ({
  id, word: 'renew', pos: 'v.', meaning: '갱신하다',
  example: 'We need to renew the lease.', exampleKo: '임대차 계약을 갱신해야 한다.',
});
const sentence = (id = 's-1', over: Record<string, unknown> = {}) => ({
  id,
  text: 'The tenant will renew the lease next month.',
  ko: '세입자가 다음 달에 임대차 계약을 갱신할 것이다.',
  blankWord: 'renew',
  distractors: ['reduce', 'remove', 'reverse'],
  ...over,
});
const input = (over: Record<string, unknown> = {}) => ({
  title: 'Day 15 — 계약 갱신', words: [word()], sentences: [sentence()], ...over,
});

describe('validateInput — 통과하는 경우', () => {
  it('정상 입력', () => {
    expect(validateInput(input(), new Set())).toEqual({ ok: true });
  });
  it('문장 0개도 허용한다', () => {
    expect(validateInput(input({ sentences: [] }), new Set())).toEqual({ ok: true });
  });
  it('단어 1개면 통과한다 (분량 제한 없음)', () => {
    expect(validateInput(input({ words: [word()] }), new Set()).ok).toBe(true);
  });
});

describe('validateInput — 필수 필드', () => {
  it('title 없으면 거부', () => {
    const r = validateInput(input({ title: '' }), new Set());
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/title/);
  });
  it('단어가 0개면 거부', () => {
    const r = validateInput(input({ words: [] }), new Set());
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/단어/);
  });
  it('단어 필드가 빠지면 거부', () => {
    const bad = { ...word(), meaning: '' };
    const r = validateInput(input({ words: [bad] }), new Set());
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/meaning/);
  });
});

describe('validateInput — blankWord 규칙', () => {
  it('text에 없으면 거부', () => {
    const r = validateInput(input({ sentences: [sentence('s-1', { blankWord: 'absent' })] }), new Set());
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/blankWord/);
  });
  it('두 번 나오면 거부', () => {
    const r = validateInput(input({
      sentences: [sentence('s-1', { text: 'We renew and renew the lease.', blankWord: 'renew' })],
    }), new Set());
    expect(r.ok).toBe(false);
  });
  it('문장 첫 단어면 거부 (검증기가 대소문자를 구분한다)', () => {
    const r = validateInput(input({
      sentences: [sentence('s-1', { text: 'Renew the lease today.', blankWord: 'Renew' })],
    }), new Set());
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/첫 단어/);
  });
  it('구두점이 붙어도 독립 토큰으로 인정한다', () => {
    const r = validateInput(input({
      sentences: [sentence('s-1', { text: 'We should renew.', blankWord: 'renew' })],
    }), new Set());
    expect(r.ok).toBe(true);
  });
});

describe('validateInput — distractors', () => {
  it('3개가 아니면 거부', () => {
    const r = validateInput(input({
      sentences: [sentence('s-1', { distractors: ['a', 'b'] })],
    }), new Set());
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/distractors/);
  });
});

describe('validateInput — id 중복', () => {
  it('파일 안에서 중복되면 거부', () => {
    const r = validateInput(input({ words: [word('w-x'), word('w-x')] }), new Set());
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/w-x/);
  });
  it('DB에 이미 있으면 거부', () => {
    const r = validateInput(input(), new Set(['w-renew']));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/w-renew/);
  });
  it('단어와 문장 id가 서로 겹쳐도 거부', () => {
    const r = validateInput(input({ words: [word('dup')], sentences: [sentence('dup')] }), new Set());
    expect(r.ok).toBe(false);
  });
});
```

`vitest.config.ts`의 `include`는 `tests/**/*.test.ts`이므로 이 파일이 잡힌다. `.mjs`를 TS 테스트에서 import하려면 타입 선언이 없어 `tsc`가 불평할 수 있다 — 그 경우 `tests/ingest.test.ts` 상단에 `// @ts-expect-error mjs 모듈에 타입 선언이 없다`를 붙이지 말고, `scripts/ingest.d.mts`에 최소 선언을 두는 쪽을 택한다:

```ts
// scripts/ingest.d.mts
export function validateInput(
  input: unknown,
  existingIds: Set<string>,
): { ok: true } | { ok: false; errors: string[] };
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/ingest.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 검증 로직 구현**

`scripts/ingest.mjs`의 검증 부분:

```js
const WORD_FIELDS = ['id', 'word', 'pos', 'meaning', 'example', 'exampleKo'];
const SENTENCE_FIELDS = ['id', 'text', 'ko', 'blankWord'];

/** 구두점을 떼고 공백 기준 토큰으로 쪼갠다 (validate-data.mjs 와 같은 방식). */
function tokens(text) {
  return String(text).split(/\s+/).map((t) => t.replace(/[.,!?;:"'()]/g, ''));
}

export function validateInput(input, existingIds) {
  const errors = [];
  if (!input || typeof input !== 'object') return { ok: false, errors: ['입력이 객체가 아닙니다'] };

  if (!input.title) errors.push('title 이 없습니다');

  const words = Array.isArray(input.words) ? input.words : [];
  const sentences = Array.isArray(input.sentences) ? input.sentences : [];
  if (words.length === 0) errors.push('단어가 1개 이상 필요합니다');

  const seen = new Set();
  const checkId = (id, label) => {
    if (!id) { errors.push(`${label}: id 가 없습니다`); return; }
    if (seen.has(id)) errors.push(`${label}: 파일 안에서 id 중복 — ${id}`);
    else if (existingIds.has(id)) errors.push(`${label}: DB 에 이미 있는 id — ${id}`);
    seen.add(id);
  };

  for (const w of words) {
    for (const f of WORD_FIELDS) if (!w?.[f]) errors.push(`단어 ${w?.id ?? '(id없음)'}: ${f} 가 없습니다`);
    checkId(w?.id, `단어 ${w?.id ?? '(id없음)'}`);
  }

  for (const s of sentences) {
    for (const f of SENTENCE_FIELDS) if (!s?.[f]) errors.push(`문장 ${s?.id ?? '(id없음)'}: ${f} 가 없습니다`);
    checkId(s?.id, `문장 ${s?.id ?? '(id없음)'}`);

    if (!Array.isArray(s?.distractors) || s.distractors.length !== 3) {
      errors.push(`문장 ${s?.id}: distractors 는 정확히 3개여야 합니다`);
    }
    if (s?.text && s?.blankWord) {
      const ts = tokens(s.text);
      const hits = ts.filter((t) => t === s.blankWord).length;
      if (hits !== 1) {
        errors.push(`문장 ${s.id}: blankWord "${s.blankWord}" 가 text 에 ${hits}회 등장 (1회여야 함, 대소문자 구분)`);
      } else if (ts[0] === s.blankWord) {
        errors.push(`문장 ${s.id}: blankWord 가 문장 첫 단어입니다 — 검증기가 대소문자를 구분하므로 첫 단어는 쓸 수 없습니다`);
      }
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/ingest.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: 삽입 로직과 CLI 구현**

같은 파일에 추가한다. 환경변수는 `.env.local`을 직접 파싱한다 (의존성 없이):

```js
import { readFileSync } from 'node:fs';

function loadEnv() {
  const out = {};
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

function rest(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const base = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  return {
    async get(path) {
      const r = await fetch(`${base}${path}`, { headers });
      if (!r.ok) throw new Error(`GET ${path} -> ${r.status} ${await r.text()}`);
      return r.json();
    },
    async post(path, body, prefer) {
      const r = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: prefer ? { ...headers, Prefer: prefer } : headers,
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`POST ${path} -> ${r.status} ${await r.text()}`);
      return prefer ? r.json() : null;
    },
    async del(path) {
      const r = await fetch(`${base}${path}`, { method: 'DELETE', headers });
      if (!r.ok) throw new Error(`DELETE ${path} -> ${r.status} ${await r.text()}`);
    },
  };
}

async function main() {
  const file = process.argv[2];
  if (!file) { console.error('사용법: npm run ingest -- <파일경로>'); process.exit(1); }

  // 스펙 §12: 잘못된 JSON 은 파싱 오류를 그대로 보고하고 종료한다 (스택 트레이스를 던지지 않는다)
  let input;
  try {
    input = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`입력 파일을 읽을 수 없습니다: ${file}`);
    console.error(`  ${e.message}`);
    process.exit(1);
  }

  const env = loadEnv();
  const api = rest(env);

  // 기존 id 전부 모아서 중복 검사에 쓴다
  const [dbWords, dbSentences] = await Promise.all([
    api.get('/toeic_words?select=item_id'),
    api.get('/toeic_sentences?select=item_id'),
  ]);
  const existing = new Set([...dbWords, ...dbSentences].map((r) => r.item_id));

  const v = validateInput(input, existing);
  if (!v.ok) {
    console.error('검증 실패 — 아무것도 넣지 않았습니다:');
    for (const e of v.errors) console.error('  - ' + e);
    process.exit(1);
  }

  const sets = await api.get('/toeic_sets?select=seq&order=seq.desc&limit=1');
  const nextSeq = (sets[0]?.seq ?? 0) + 1;

  const [created] = await api.post('/toeic_sets', { title: input.title, seq: nextSeq }, 'return=representation');
  const setId = created.id;

  try {
    if (input.words.length) {
      await api.post('/toeic_words', input.words.map((w, i) => ({
        item_id: w.id, set_id: setId, seq: i + 1,
        word: w.word, pos: w.pos, meaning: w.meaning,
        example: w.example, example_ko: w.exampleKo,
      })));
    }
    if (input.sentences.length) {
      await api.post('/toeic_sentences', input.sentences.map((s, i) => ({
        item_id: s.id, set_id: setId, seq: i + 1,
        text: s.text, ko: s.ko, blank_word: s.blankWord, distractors: s.distractors,
      })));
    }
  } catch (e) {
    console.error('항목 삽입 실패, 방금 만든 묶음을 되돌립니다:', e.message);
    try { await api.del(`/toeic_sets?id=eq.${setId}`); }
    catch { console.error(`되돌리기도 실패했습니다. 빈 묶음 id=${setId} 가 남아 있지만 무해합니다 (후보를 만들지 않음).`); }
    process.exit(1);
  }

  console.log(`OK — "${input.title}" (seq ${nextSeq}): 단어 ${input.words.length}개, 문장 ${input.sentences.length}개`);
}

// 테스트에서 import 할 때는 main 을 실행하지 않는다
if (process.argv[1] && process.argv[1].endsWith('ingest.mjs')) main();
```

`package.json`의 scripts에 추가: `"ingest": "node scripts/ingest.mjs"`

- [ ] **Step 6: 잘못된 입력이 거부되는지 실제로 확인**

일부러 깨진 파일로 실행해 아무것도 안 들어가는지 본다:

```bash
cd ~/Desktop/day-by-day-TOEIC
cat > /tmp/bad.json << 'EOF'
{ "title": "깨진 입력", "words": [{ "id": "w-bad", "word": "bad" }], "sentences": [] }
EOF
npm run ingest -- /tmp/bad.json; echo "exit=$?"
```

Expected: 검증 실패 메시지에 `pos`, `meaning`, `example`, `exampleKo` 누락이 나오고 `exit=1`. 이어서 `toeic_sets`가 여전히 비어 있는지 확인한다.

- [ ] **Step 7: 기존 14일치를 DB에 넣는다**

`public/data/days/*.json` 14개를 날짜 순서대로 넣는다. 파일에는 `date`가 있고 `title`도 있으므로, `title`만 쓰면 입력 형태와 맞는다. 날짜 순서를 지켜야 도입 순서가 보존된다:

```bash
cd ~/Desktop/day-by-day-TOEIC
for f in $(ls public/data/days/*.json | sort); do
  echo "=== $f"
  npm run ingest -- "$f" || { echo "중단: $f 에서 실패"; break; }
done
```

Expected: 14번 모두 `OK`. 실패하면 멈추고 원인을 보고한다 (이미 들어간 묶음은 남아 있어도 되지만, 어디까지 들어갔는지 정확히 보고해야 한다).

- [ ] **Step 8: 들어간 데이터 확인**

```bash
URL=$(grep -E "^NEXT_PUBLIC_SUPABASE_URL=" .env.local | cut -d= -f2-)
ANON=$(grep -E "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" .env.local | cut -d= -f2-)
for t in toeic_sets toeic_words toeic_sentences; do
  echo -n "$t: "
  curl -s "$URL/rest/v1/$t?select=*" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
    -H "Prefer: count=exact" -I 2>/dev/null | grep -i content-range || true
done
```

Expected: `toeic_sets` 14, `toeic_words` 140, `toeic_sentences` 70.

`seq`가 1..14로 날짜 순서와 일치하는지도 확인한다:
```bash
curl -s "$URL/rest/v1/toeic_sets?select=seq,title&order=seq" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
```
Expected: seq 1이 "Day 1 — 계약과 협상", seq 14가 "Day 14 — 성과와 평가".

- [ ] **Step 9: 전체 검증 후 커밋**

Run: `npm test` (Task 2의 64개 + 신규 14개 = 78개 예상. 실제 수를 보고한다), `npx tsc --noEmit`, `npx eslint .`

```bash
git add scripts/ingest.mjs scripts/ingest.d.mts tests/ingest.test.ts package.json
git commit -m "feat: add content ingest script and load the initial 14 sets"
```

---

### Task 4: 화면 전환 — 번들 사용 + `sourceDate` 제거

**Files:**
- Modify: `lib/types.ts`, `lib/srs.ts`, `lib/queue.ts`, `lib/srsRepo.ts`, `lib/contentRepo.ts`, `app/page.tsx`, `app/vocab/page.tsx`, `tests/srs.test.ts`, `tests/queue.test.ts`, `tests/srsRepo.test.ts`

**Interfaces:**
- Consumes: `fetchContent()`, `ContentBundle` (Task 2). DB에 이미 14묶음이 들어 있다 (Task 3)
- Produces: 파일을 읽지 않는 앱. `CardIdentity`는 `{ itemId, type }` 두 필드만 남는다

**이 두 변경은 한 태스크여야 한다.** `app/page.tsx`가 `identity.sourceDate`로 날짜별 콘텐츠를 찾고 있으므로, `sourceDate`를 없애려면 번들 기반 조회로 함께 바꿔야 한다. 따로 하면 중간에 빌드가 깨진다.

- [ ] **Step 1: 타입에서 `sourceDate`와 죽은 타입 제거**

`lib/types.ts`:
- `SrsCard`에서 `sourceDate` 제거
- `DayContent`, `DayIndexEntry` 삭제 (파일을 더 읽지 않으므로 쓰는 곳이 없어진다)
- `Word`, `Sentence`, `QuizType`, `Box`, `MasteredItem`, `SessionRecord`는 그대로 둔다

`lib/srs.ts`: `CardIdentity`에서 `sourceDate` 제거. `nextState`는 `{ ...identity, box, dueDate }`로 카드를 만들므로 **로직 변경 없이** 필드만 줄어든다. `DUE_DAYS`, 전이 규칙, `cardKey`는 건드리지 않는다.

`lib/queue.ts`: 만기 카드를 `CardIdentity`로 옮기는 `.map()`에서 `sourceDate`를 빼고 `{ itemId, type }`만 남긴다. 정렬·상한·제외 로직은 그대로.

`lib/srsRepo.ts`: `sourceDate`를 참조하는 곳이 있으면 제거한다. `commitSession`은 `identity`를 그대로 쓰므로 대개 변경이 없다.

**기존 localStorage 데이터는 마이그레이션하지 않는다.** 저장된 카드에 `sourceDate`가 남아 있어도 코드가 읽지 않아 무해하게 무시된다. 사용자 진도는 유지된다.

- [ ] **Step 2: 기존 테스트에서 `sourceDate` 제거**

`tests/srs.test.ts`, `tests/queue.test.ts`, `tests/srsRepo.test.ts`의 픽스처에서 `sourceDate`를 뺀다. **단정 내용은 바꾸지 않는다** — box 전이, 간격, 큐 순서, 졸업 처리를 검증하는 테스트는 그대로 통과해야 한다. 통과하지 않으면 로직을 잘못 건드린 것이다.

Run: `npx tsc --noEmit`
Expected: `sourceDate`를 쓰는 모든 곳이 오류로 드러난다. 이 목록이 이번 태스크의 작업 목록이다.

- [ ] **Step 3: `app/page.tsx` — 번들로 후보 생성 + 오류/빈 상태 구분**

`fetchIndex`/`fetchDay` 호출을 `fetchContent()` 하나로 바꾼다.

로드 상태를 셋으로 나눈다. 지금 코드에 이미 `'error'` 상태가 있으니 그 패턴을 따른다:

- `fetchContent()`가 `null`을 반환 → **조회 실패**. 한국어 오류 화면 + 재시도 버튼. **"오늘 할 게 없어요"로 표시하면 안 된다**
- 번들의 `words`와 `sentences`가 모두 비어 있음 → **콘텐츠 없음**. "아직 학습할 내용이 없어요" (오류가 아니다)
- 그 외 → 게임

후보 목록은 번들에서 만든다. 순서는 지금과 동일하게 단어 전부 → 빈칸 → 조합이다. 번들이 이미 도입 순서로 정렬되어 있으므로 그대로 훑으면 된다:

```ts
const candidates: CardIdentity[] = [
  ...bundle.words.map((w) => ({ itemId: w.id, type: 'word' as const })),
  ...bundle.sentences.map((s) => ({ itemId: s.id, type: 'blank' as const })),
  ...bundle.sentences.map((s) => ({ itemId: s.id, type: 'arrange' as const })),
];
```

**주의 — 순서가 바뀐다.** 지금은 묶음마다 `단어10 → 빈칸5 → 조합5`이 반복되지만, 위 코드는 `전체 단어 → 전체 빈칸 → 전체 조합`이 된다. 첫 판이 Day 1의 단어 10 + 빈칸 5 + 조합 5가 되게 하려면 **묶음별로 묶어야 한다.** `Word`/`Sentence`에는 묶음 정보가 없으므로, `ContentBundle`을 묶음 단위로 바꾸는 대신 여기서는 **번들 순서를 유지하면서 묶음 경계를 알 필요가 없는 방식**을 쓴다:

`lib/contentRepo.ts`의 `ContentBundle`에 `candidates: CardIdentity[]`를 함께 담는다. `toBundle`이 정렬할 때 묶음 정보를 이미 알고 있으므로 거기서 만드는 것이 옳다. `toBundle`을 수정한다:

```ts
export interface ContentBundle {
  words: Word[];
  sentences: Sentence[];
  candidates: CardIdentity[];   // 묶음별로 단어 -> 빈칸 -> 조합 순서
}
```

`toBundle` 안에서 묶음 seq로 그룹을 만들어, 각 묶음마다 그 묶음의 단어 전부 → 그 묶음의 문장 빈칸 → 같은 문장의 조합을 이어붙인다. 이렇게 하면 현재 파일 기반 동작과 정확히 일치한다.

`tests/contentRepo.test.ts`에 이를 검증하는 테스트를 추가한다:

```ts
it('candidates는 묶음별로 단어 -> 빈칸 -> 조합 순서다', () => {
  const out = toBundle(
    [{ id: 10, seq: 1 }, { id: 20, seq: 2 }],
    [rawWord('w-1', 10, 1), rawWord('w-2', 20, 1)],
    [rawSentence('s-1', 10, 1), rawSentence('s-2', 20, 1)],
  );
  expect(out.candidates.map((c) => `${c.type}:${c.itemId}`)).toEqual([
    'word:w-1', 'blank:s-1', 'arrange:s-1',
    'word:w-2', 'blank:s-2', 'arrange:s-2',
  ]);
});
```

문항 생성은 번들의 평탄한 배열에서 `id`로 찾는다. `buildWordQuiz`에는 **항상 `bundle.words` 전체**를 pool로 넘긴다 — 서로 다른 뜻 3개를 못 찾으면 예외를 던지므로 이건 지켜야 한다.

- [ ] **Step 4: `app/vocab/page.tsx` — 번들로 원문 조회**

현재 `fetchIndex` + 날짜별 `fetchDay` 후 `sourceDate`로 찾고, 졸업 항목은 전체 날짜를 훑는다. 번들이 평탄한 배열이므로 둘 다 `id` 조회 하나로 단순해진다:

```ts
const wordById = new Map(bundle.words.map((w) => [w.id, w]));
const sentenceById = new Map(bundle.sentences.map((s) => [s.id, s]));
```

카드의 `type`이 `'word'`면 `wordById`, 아니면 `sentenceById`에서 찾는다. **찾지 못하면 지금처럼 "삭제된 콘텐츠"로 표시하고 제거 버튼을 준다** — DB에서 항목이 지워진 경우다. 이 동작을 없애지 않는다.

조회 실패(`fetchContent()`가 `null`) 시에는 한국어 오류 화면을 보여준다. 빈 상태("아직 학습한 단어가 없어요")와 구분한다.

- [ ] **Step 5: 옛 `contentRepo` 함수 삭제**

`lib/contentRepo.ts`에서 `fetchIndex`와 `fetchDay`를 삭제한다. 이제 참조하는 곳이 없어야 한다:

Run: `grep -rn "fetchIndex\|fetchDay" app components lib tests`
Expected: 결과 없음

- [ ] **Step 6: 검증**

Run: `npx tsc --noEmit && npx eslint . && npm test`
Expected: 타입·린트 깨끗. 테스트는 Task 3의 78개에 `candidates` 테스트 1개가 더해진 수. **실제 수를 보고한다**

`npm run dev`로 실제 확인한다:
- `/` 접속 → 스피너 후 바로 문항. 첫 판이 **Day 1 콘텐츠**(단어 10 + 빈칸 5 + 조합 5)인지 — DB 순서가 맞는지 확인하는 핵심 지점
- 기존 `localStorage` 진도가 살아 있는지 (`ddt.srs`의 카드가 그대로 인식되는지)
- 한 판 완주 → `/vocab`에서 단계·다음 날짜가 정상인지
- DevTools Network에서 `/data/` 요청이 **더 이상 없는지** (Supabase만 호출)
- Network를 오프라인으로 바꾸고 새로고침 → **오류 화면 + 재시도**가 나오는지. "오늘 할 게 없어요"가 나오면 결함이다

- [ ] **Step 7: 커밋**

```bash
git add lib app tests
git commit -m "feat: read content from the database and drop sourceDate"
```

---

### Task 5: 정적 파일 정리 + README

**Files:**
- Delete: `public/data/`, `scripts/validate-data.mjs`
- Modify: `README.md`, `package.json` (`validate-data` 스크립트 제거)

**Interfaces:**
- Consumes: Task 4까지 완료 (앱이 DB만 읽는다)
- Produces: 없음 (마무리)

- [ ] **Step 1: 앱이 정말 파일을 안 읽는지 재확인**

Run: `grep -rn "/data/\|public/data" app components lib`
Expected: 결과 없음. 나오면 Task 4가 덜 된 것이므로 멈추고 보고한다

- [ ] **Step 2: 삭제**

```bash
git rm -r public/data scripts/validate-data.mjs
```

`package.json`에서 `"validate-data"` 스크립트를 제거한다. 검증은 입력 스크립트로 옮겨졌다.

- [ ] **Step 3: README 갱신**

바뀐 부분만 고친다:

- **"학습 콘텐츠 추가하기" 섹션을 전면 교체한다.** 이제 JSON 파일을 레포에 넣는 게 아니라 `npm run ingest -- <파일>`로 DB에 넣는다. 입력 JSON 형태(`title` / `words` / `sentences`)와 예시를 보여준다
- **작성 규칙은 유지한다** — 스크립트가 검사하는 것(blankWord 한 번, 문장 첫 단어 금지, distractors 3개, id 중복)과 **검사할 수 없는 것**(정답이 유일해야 함, 오답이 한눈에 걸러지면 안 됨, 어순이 하나만 성립해야 함)을 나눠서 적는다. 후자는 v1 리뷰에서 실제 결함으로 확인된 것들이므로 잃으면 안 된다
- 데이터 저장 방식 섹션: 콘텐츠는 Supabase, 진도는 브라우저 `localStorage`(`ddt.srs`, `ddt.mastered`, `ddt.sessions`). 백엔드를 붙일 때는 `lib/contentRepo.ts`와 `lib/srsRepo.ts`가 교체 지점
- 환경변수 섹션 추가: `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. **service key는 입력 스크립트 전용이고 Vercel에 넣지 않는다**는 것을 명시
- `npm run validate-data` 언급을 지운다
- 프로젝트 구조에서 `public/data/`를 지운다

- [ ] **Step 4: 검증**

Run: `npm test && npx tsc --noEmit && npx eslint . && npm run build`
Expected: 전부 통과. 라우트는 `/`, `/vocab`, `/stats` 세 개

`npm run dev`로 한 판 완주해 정적 파일 삭제가 아무것도 깨뜨리지 않았는지 확인한다.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "refactor: remove static content files and document the ingest flow"
```

---

### Task 6: Vercel 배포

**Files:**
- 코드 변경 없음. 필요하면 `next.config.ts`만

**Interfaces:**
- Consumes: Task 5까지 완료
- Produces: 공개 URL

**사전 확인:** `vercel` CLI가 있는지 본다 (`npx vercel --version`). 로그인이 필요하면 **직접 하지 말고 사용자에게 요청한다** — `! npx vercel login`을 프롬프트에 입력하면 이 세션에서 실행된다고 안내한다.

- [ ] **Step 1: 배포 전 로컬 빌드 확인**

Run: `npm run build`
Expected: 성공. 라우트 `/`, `/_not-found`, `/stats`, `/vocab`

- [ ] **Step 2: 환경변수 두 개를 Vercel에 등록**

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`만 등록한다.

**`SUPABASE_SERVICE_ROLE_KEY`는 절대 등록하지 않는다.** 입력 스크립트는 로컬에서만 돌고, 웹에 올라가는 코드에는 존재 이유가 없다. 등록하면 DB 전체 쓰기 권한이 배포 환경에 놓인다.

- [ ] **Step 3: 배포**

`npx vercel --prod` 또는 GitHub 연동. GitHub 연동을 쓰면 `main` 푸시로 자동 배포되므로 이후가 편하다. 어느 쪽을 썼는지 리포트에 적는다.

- [ ] **Step 4: 실제 URL에서 QA — 이게 이 태스크의 본체다**

배포된 URL에서 확인한다. 로컬에서 됐다고 넘어가지 않는다:

- `/` 접속 → 스피너 후 바로 문항. 대시보드 없음
- 첫 판이 Day 1 콘텐츠인지
- 20문항 완주, 일부 틀리기 → 결과 화면, `localStorage`에 카드 20개와 세션 1건
- 틀린 단어에서 뜻·품사·예문이 펼쳐지는지
- `/vocab`, `/stats`가 정상인지
- **DevTools Network에서 `SUPABASE_SERVICE_ROLE_KEY`가 어디에도 나오지 않는지 확인한다.** 번들과 네트워크 응답 모두. 나오면 즉시 멈추고 보고한다
- 폰 브라우저에서 한 번 (실사용 환경)
- 다크 모드

- [ ] **Step 5: README에 URL 추가하고 커밋**

```bash
git add README.md
git commit -m "docs: add deployed URL"
```

- [ ] **Step 6: 배포 URL을 사용자에게 보고**

URL과 함께, 다음 콘텐츠 추가는 `npm run ingest -- <파일>`로 하면 재배포 없이 바로 반영된다는 것을 알린다 (콘텐츠가 DB에 있으므로).
