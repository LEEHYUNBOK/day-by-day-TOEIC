# 데일리 CS 셀프 스터디 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 토익 앱을 걷어내고, 면접 질문을 공부 → 설명 → 자기채점 → `/채점`(Claude Code) → 캘린더·그래프·꼬리질문 트리로 보는 로컬 전용 Next.js 앱으로 교체한다.

**Architecture:** 모든 상태는 `data/` 아래 md 파일(frontmatter + 본문 섹션)이다. 서버 컴포넌트가 파일을 직접 읽어 화면을 그리고, 쓰기는 route handler 몇 개가 `lib/`의 함수를 호출한다. 질문 생성 로직은 가져오기 스크립트(Node 20, TS 실행기 없음)와 앱이 같이 쓰므로 기존 `scripts/ingest.mjs` 패턴대로 `.mjs` + `.d.mts`로 둔다.

**Tech Stack:** Next.js 16.3.0 (App Router), React 19.2.8, Tailwind 4, vitest 4, Node 20.19. 새 npm 패키지 없음.

**Spec:** `docs/superpowers/specs/2026-11-25-daily-cs-study-design.md` — 실행자는 스펙과 이 플랜을 같이 읽는다.

## Global Constraints

- 새 npm 패키지를 추가하지 않는다. 필요하면 멈추고 사용자에게 제안한다.
- Next.js 16 API는 `node_modules/next/dist/docs/`가 없으므로 context7(`/vercel/next.js`, v16.3) 또는 nextjs.org로 확인하고 쓴다. 특히 route handler 시그니처, 동적 `params`/`searchParams`(Promise 여부), 요청마다 다시 렌더되는 서버 컴포넌트 설정.
- 한글 id·파일명은 읽기·쓰기·비교 전에 항상 `.normalize('NFC')`.
- `dev` 스크립트: `next dev -H 127.0.0.1`.
- 앱은 AI API를 호출하지 않는다. 앱은 git 커밋을 하지 않는다.
- `pending`/`graded` 시도 파일은 앱이 절대 쓰지 않는다.
- 자기채점 값: `concept ∈ {0,30,60}`, `tradeoff ∈ {0,20,40}`. AI 값: 정수 `0..60`, `0..40`.
- 데이터 루트: `path.join(process.cwd(), 'data')`. `lib/` 함수는 모두 첫 인자로 `root: string`을 받는다 (테스트는 임시 폴더를 넘긴다).
- fs를 쓰는 테스트 파일 첫 줄: `// @vitest-environment node`.

## Review Focus

1. **macOS가 `readdir`에서 NFD 파일명을 돌려줄 때** — 질문 id 비교·중복 판정이 깨지지 않아야 한다 → Task 4 테스트 `lists NFD-named files as NFC ids`.
2. **API에 `../` 같은 경로가 들어올 때** — `data/` 밖을 읽거나 쓰지 않고 400 → Task 5 테스트 `rejects paths outside study/`.
3. **오래 열어 둔 탭이 이미 제출된 시도를 저장할 때** — 거부하고 파일은 그대로 → Task 5 테스트 `saveDraft refuses non-draft`.
4. **frontmatter 문자열에 `:`, 따옴표, `#`, 줄바꿈, URL이 들어갈 때** ("질문 추가" 입력, 링크) — 그대로 왕복 → Task 2 테스트 `round-trips awkward strings`.
5. **`data/`가 아직 없는 첫 실행** — 목록 함수는 빈 배열, 화면은 빈 상태로 뜬다 → Task 4·5 테스트 `returns [] when data dir missing`.

---

## File Structure

```
lib/
  frontmatter.mjs / .d.mts   md ↔ {data, body}; 본문 섹션 읽기/쓰기
  ids.mjs / .d.mts           normalizeText, slugify, makeId, seqOf
  questions.mjs / .d.mts     질문 파일 목록/읽기/생성(중복 판정), inferKind
  types.ts                   Question, Attempt, Rubric 등 공용 타입
  attempts.ts                시도 시작/임시저장/제출/목록, today(), 경로 검증
  retro.ts                   회고 읽기/쓰기
  scores.ts                  표시 점수, 질문 점수, 착각 지수, 날짜·토픽 집계, 트리
  paths.ts                   DATA_ROOT
scripts/import.mjs           RESUME 문항 은행 가져오기 (npm run import -- <RESUME 경로>)
.claude/commands/채점.md      /채점 명령
app/
  layout.tsx, page.tsx       홈 = 월 캘린더
  day/[date]/page.tsx        블로그 뷰 + 회고 편집
  bank/page.tsx, bank/new/page.tsx
  study/page.tsx             풀이 화면 (?a=<시도 경로>), 제출 후 읽기 전용
  graph/page.tsx, tree/page.tsx
  api/questions/route.ts, api/attempts/route.ts, api/attempts/submit/route.ts,
  api/audio/route.ts, api/retro/route.ts
components/                  Nav, StudyRunner(클라이언트), RetroEditor(클라이언트), 차트 SVG
tests/                       lib별 테스트 + fixtures/
```

---

### Task 1: 토익 앱 걷어내기와 빈 셸

**Files:**
- Delete: `app/vocab/`, `app/stats/`, `app/setup/`, `components/*`, `lib/*`, `scripts/ingest.mjs`, `scripts/ingest.d.mts`, `tests/*`
- Modify: `app/page.tsx` (빈 홈: 앱 이름 + "준비 중"), `app/layout.tsx` (메타데이터), `public/manifest.json`, `package.json`, `.gitignore`, `README.md`

**Interfaces:**
- Produces: 빌드되는 빈 앱. 새 앱 이름 **"데일리 CS"** (manifest `name`/`short_name`, `metadata.title`, `appleWebApp.title`, description은 "면접 질문을 매일 공부하고 설명해 이해도를 기록하는 앱.").

- [ ] **Step 1:** 위 Delete 목록 삭제, `npm uninstall @supabase/supabase-js`.
- [ ] **Step 2:** `package.json` scripts: `"dev": "next dev -H 127.0.0.1"`, `"ingest"` 삭제, `"import": "node scripts/import.mjs"` 추가, `"test": "vitest run --passWithNoTests"`.
- [ ] **Step 3:** `.gitignore`에 `data/**/*.webm` 추가.
- [ ] **Step 4:** layout·manifest 이름 교체. `globals.css`의 토익 관련 주석만 정리하고 토큰은 유지.
- [ ] **Step 5:** README를 실행 방법으로 다시 쓴다: `npm run dev`, `npm run import -- "<RESUME 경로>"`, Claude Code에서 `/채점`, `data/` 구조 한 단락. Supabase 언급 전부 제거.
- [ ] **Step 6:** 검증. Run: `npm run build && npm run lint && npm test` — Expected: 셋 다 성공. `grep -ri "supabase\|toeic\|토익" app components lib package.json public README.md` — Expected: 출력 없음.
- [ ] **Step 7:** Commit `chore: remove the TOEIC app and leave an empty shell`

---

### Task 2: frontmatter

**Files:**
- Create: `lib/frontmatter.mjs`, `lib/frontmatter.d.mts`
- Test: `tests/frontmatter.test.ts`

**Interfaces:**
- Produces:
  - `parse(md: string): { data: Record<string, unknown>; body: string }`
  - `stringify(data: Record<string, unknown>, body: string): string`
  - `getSection(body: string, heading: string): string` — `## <heading>` 다음부터 다음 `## ` 전까지, trim. 없으면 `''`.
  - `setSection(body: string, heading: string, text: string): string` — 있으면 교체, 없으면 끝에 추가.

형식 결정: frontmatter 한 줄 = `key: value`. 값이 `^[0-9A-Za-z가-힣_\-./]+$`에 맞고 JSON으로 파싱되지 않는 문자열이면 따옴표 없이, 그 밖의 값(숫자·null·불리언·객체·배열·특수문자 있는 문자열)은 `JSON.stringify`. 읽을 때는 `JSON.parse`를 시도하고 실패하면 원문 문자열. JSON은 YAML의 부분집합이라 다른 도구에서도 읽힌다. 객체는 `{"concept":30,"tradeoff":40}`, 목록은 `["a","b"]`.

- [ ] **Step 1: 실패하는 테스트**

```ts
it('round-trips scalars, objects, arrays', () => {
  const data = { id: '0006-프로세스와-스레드', date: '2026-11-25', minutes: 75, parent: null,
    self: { concept: 30, tradeoff: 40 }, followups: ['0012-a', '0038-b'] };
  expect(parse(stringify(data, 'body\n')).data).toEqual(data);
});
it('round-trips awkward strings', () => {
  const data = { from: '미리디: 기술 "스크리닝" #1', link: 'https://a.com/x?y=1#z', text: '첫 줄\n둘째 줄', num: '0006' };
  expect(parse(stringify(data, '')).data).toEqual(data);
});
it('writes plain ids without quotes', () => {
  expect(stringify({ id: '0006-프로세스' }, '')).toContain('id: 0006-프로세스\n');
});
it('reads and replaces sections', () => {
  const body = '## 공부 메모\n메모\n\n## 내 설명\n설명\n';
  expect(getSection(body, '내 설명')).toBe('설명');
  expect(getSection(setSection(body, '공부 메모', '새 메모'), '공부 메모')).toBe('새 메모');
  expect(getSection(setSection(body, '채점 결과', '- x'), '채점 결과')).toBe('- x');
});
```

- [ ] **Step 2:** Run `npx vitest run tests/frontmatter.test.ts` — Expected: FAIL (모듈 없음)
- [ ] **Step 3:** 구현 (`.d.mts`에 위 시그니처)
- [ ] **Step 4:** 같은 명령 — Expected: PASS
- [ ] **Step 5:** Commit `feat: add a minimal frontmatter reader and writer`

---

### Task 3: id 규칙

**Files:**
- Create: `lib/ids.mjs`, `lib/ids.d.mts`
- Test: `tests/ids.test.ts`

**Interfaces:**
- Produces:
  - `normalizeText(s: string): string` — NFC, 모든 공백과 문장부호 제거 (중복 판정 키)
  - `slugify(s: string): string` — NFC, 문장부호 `?,.!/:;"'()[]{}…·~` 제거, 공백 → `-`, 연속 `-` 하나로, 앞뒤 `-` 제거, 최대 30자 (자른 뒤 끝 `-` 제거)
  - `makeId(seq: number, text: string): string` — `String(seq).padStart(4,'0') + '-' + slugify(text)`
  - `seqOf(id: string): number` — 앞 4자리 정수, 아니면 `0`

- [ ] **Step 1: 실패하는 테스트**

```ts
it('makes the spec example id', () => {
  expect(makeId(6, '프로세스와 스레드의 차이를 설명해 주시겠어요?')).toBe('0006-프로세스와-스레드의-차이를-설명해-주시겠어요');
});
it('caps slug at 30 chars without a trailing dash', () => {
  const s = slugify('가'.repeat(29) + ' 나다');
  expect(s.length).toBeLessThanOrEqual(30); expect(s.endsWith('-')).toBe(false);
});
it('treats NFD and spacing/punctuation variants as the same text', () => {
  const a = '뮤텍스와 세마포어의 차이는?'; const b = '뮤텍스와세마포어의 차이는'.normalize('NFD');
  expect(normalizeText(a)).toBe(normalizeText(b));
});
it('reads sequence numbers', () => { expect(seqOf('0038-x')).toBe(38); expect(seqOf('x')).toBe(0); });
```

- [ ] **Step 2:** Run `npx vitest run tests/ids.test.ts` — Expected: FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** 같은 명령 — Expected: PASS
- [ ] **Step 5:** Commit `feat: add question id and dedup-key helpers`

---

### Task 4: 질문 저장소

**Files:**
- Create: `lib/questions.mjs`, `lib/questions.d.mts`, `lib/types.ts`, `lib/paths.ts`
- Test: `tests/questions.test.ts`

**Interfaces:**
- Consumes: Task 2 `parse/stringify/getSection/setSection`, Task 3 전부
- Produces (`lib/types.ts`):
  ```ts
  export type Kind = 'concept' | 'experience';
  export type Source = 'real' | 'mock' | 'self' | 'followup';
  export interface Question { id: string; topic: string; kind: Kind; source: Source; from: string | null;
    parent: string | null; created: string; text: string; answer: string | null }
  export type Status = 'draft' | 'pending' | 'graded';
  export interface Rubric { concept: number; tradeoff: number }
  export interface Attempt { path: string; question: string; date: string; status: Status;
    seconds: number; minutes: number | null; mode: 'write' | 'voice' | null;
    self: Rubric | null; self_score: number | null; ai: Rubric | null; ai_score: number | null;
    followups: string[]; links: string[]; memo: string; explanation: string; mine: string; result: string }
  ```
- Produces (`lib/questions.mjs`):
  - `listQuestions(root: string): Question[]` — `data/questions/*.md`, id 순 정렬, 폴더 없으면 `[]`
  - `readQuestion(root: string, id: string): Question | null`
  - `inferKind(text: string): Kind` — `경험|실무|직접|겪어` 포함 시 `'experience'`
  - `createQuestion(root: string, input: { text: string; topic: string; source: Source; from?: string | null; parent?: string | null; answer?: string | null; kind?: Kind; created: string }): { question: Question; created: boolean }` — 기존 질문 중 `normalizeText(text)`가 같은 게 있으면 그 질문과 `created:false`. 아니면 `seq = max(seqOf) + 1`, 파일 `questions/<id>.md` 작성(본문: 질문 문장, `answer`가 있으면 `## 참고 답안` 섹션), `kind` 생략 시 `inferKind`.
  - `lib/paths.ts`: `export const DATA_ROOT = path.join(process.cwd(), 'data')`

질문 파일의 `text`는 frontmatter 다음 본문에서 첫 `## ` 앞까지(trim).

- [ ] **Step 1: 실패하는 테스트** (임시 폴더: `fs.mkdtempSync(path.join(os.tmpdir(), 'cs-'))`)

```ts
it('returns [] when data dir missing', () => { expect(listQuestions(tmp)).toEqual([]); });
it('creates with next sequence and dedups by text', () => {
  const a = createQuestion(tmp, { text: '프로세스와 스레드의 차이는?', topic: '운영체제', source: 'mock', created: '2026-11-25' });
  const b = createQuestion(tmp, { text: '프로세스와 스레드의 차이는', topic: '운영체제', source: 'mock', created: '2026-11-25' });
  const c = createQuestion(tmp, { text: 'WebFlux를 사용해 보신 경험이 있으신가요?', topic: 'Spring', source: 'mock', created: '2026-11-25' });
  expect(a.created).toBe(true); expect(b).toMatchObject({ created: false, question: { id: a.question.id } });
  expect(seqOf(c.question.id)).toBe(2); expect(c.question.kind).toBe('experience');
});
it('stores and reads the reference answer', () => {
  const { question } = createQuestion(tmp, { text: 'q', topic: 't', source: 'self', answer: '**답**', created: '2026-11-25' });
  expect(readQuestion(tmp, question.id)).toMatchObject({ text: 'q', answer: '**답**', parent: null });
});
it('lists NFD-named files as NFC ids', () => {
  const { question } = createQuestion(tmp, { text: '뮤텍스', topic: 't', source: 'self', created: '2026-11-25' });
  const dir = path.join(tmp, 'questions');
  fs.renameSync(path.join(dir, question.id + '.md'), path.join(dir, question.id.normalize('NFD') + '.md'));
  expect(listQuestions(tmp).map(q => q.id)).toContain(question.id);
  expect(createQuestion(tmp, { text: '뮤텍스', topic: 't', source: 'self', created: '2026-11-25' }).created).toBe(false);
});
```

- [ ] **Step 2:** Run `npx vitest run tests/questions.test.ts` — Expected: FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** 같은 명령 — Expected: PASS
- [ ] **Step 5:** Commit `feat: add the question file store`

---

### Task 5: 시도 저장소

**Files:**
- Create: `lib/attempts.ts`
- Test: `tests/attempts.test.ts`

**Interfaces:**
- Consumes: Task 2, Task 4 타입·`readQuestion`
- Produces:
  - `today(d?: Date): string` — 로컬 기준 `YYYY-MM-DD`
  - `assertAttemptPath(p: string): string` — NFC 후 `^study/\d{4}-\d{2}-\d{2}/[^/]+\.md$`이 아니거나 `..` 포함이면 `throw new BadPathError()`
  - `listAttempts(root: string): Attempt[]` — `study/*/*.md`(날짜 폴더 안만, 회고 파일 제외), 폴더 없으면 `[]`
  - `readAttempt(root: string, p: string): Attempt | null`
  - `attemptOrder(a: Attempt): [string, number]` — `[date, 접미사 번호(없으면 1)]`, 정렬 키
  - `startAttempt(root: string, questionId: string, date: string): Attempt` — 그 날짜 폴더에 `question === questionId && status === 'draft'`인 시도가 있으면 그것. 없으면 `<id>.md`, `<id>-2.md`, … 중 첫 빈 이름으로 `status: draft, seconds: 0, links: []` 생성. 질문이 없으면 throw.
  - `saveDraft(root: string, p: string, patch: Partial<Pick<Attempt,'seconds'|'links'|'memo'|'explanation'|'mine'|'mode'>>): Attempt` — 파일을 다시 읽어 `status !== 'draft'`면 `throw new NotDraftError()` (파일 무변경)
  - `submitAttempt(root: string, p: string, input: { explanation: string; mode: 'write'|'voice'; self: Rubric; mine?: string }): Attempt` — draft 아니면 `NotDraftError`; `explanation.trim()` 비면 throw; `self`가 허용값 밖이면 throw; `status: pending`, `self_score = concept + tradeoff`, `minutes = Math.round(seconds / 60)`, `seconds` 키 제거
  - `audioPathFor(p: string): string` — `.md` → `.webm`
- 본문 섹션 이름: `공부 메모`, `내 설명`, `내 사례 (선택)`, `채점 결과`.

- [ ] **Step 1: 실패하는 테스트** (질문 하나를 `createQuestion`으로 먼저 만든다)

```ts
it('returns [] when data dir missing', () => { expect(listAttempts(tmp)).toEqual([]); });
it('resumes a same-day draft, then suffixes after submit', () => {
  const a1 = startAttempt(tmp, qid, '2026-11-25');
  expect(startAttempt(tmp, qid, '2026-11-25').path).toBe(a1.path);
  submitAttempt(tmp, a1.path, { explanation: '설명', mode: 'write', self: { concept: 30, tradeoff: 40 } });
  const a2 = startAttempt(tmp, qid, '2026-11-25');
  expect(a2.path).toBe(`study/2026-11-25/${qid}-2.md`); expect(attemptOrder(a2)).toEqual(['2026-11-25', 2]);
});
it('submit fixes score and minutes', () => {
  const a = startAttempt(tmp, qid, '2026-11-25');
  saveDraft(tmp, a.path, { seconds: 4500, memo: 'm', links: ['https://x.io/a?b=1'] });
  const s = submitAttempt(tmp, a.path, { explanation: '설명', mode: 'voice', self: { concept: 60, tradeoff: 20 } });
  expect(s).toMatchObject({ status: 'pending', self_score: 80, minutes: 75, memo: 'm', mode: 'voice' });
  expect(fs.readFileSync(path.join(tmp, a.path), 'utf8')).not.toContain('seconds');
});
it('saveDraft refuses non-draft', () => {
  const a = startAttempt(tmp, qid, '2026-11-25');
  submitAttempt(tmp, a.path, { explanation: 'x', mode: 'write', self: { concept: 0, tradeoff: 0 } });
  const before = fs.readFileSync(path.join(tmp, a.path), 'utf8');
  expect(() => saveDraft(tmp, a.path, { memo: 'late' })).toThrow(NotDraftError);
  expect(fs.readFileSync(path.join(tmp, a.path), 'utf8')).toBe(before);
});
it('rejects invalid self scores and empty explanations', () => {
  const a = startAttempt(tmp, qid, '2026-11-25');
  expect(() => submitAttempt(tmp, a.path, { explanation: 'x', mode: 'write', self: { concept: 45, tradeoff: 0 } })).toThrow();
  expect(() => submitAttempt(tmp, a.path, { explanation: '  ', mode: 'write', self: { concept: 0, tradeoff: 0 } })).toThrow();
});
it('rejects paths outside study/', () => {
  for (const p of ['../x.md', 'study/2026-11-25/../../a.md', 'questions/a.md', 'study/x/a.md'])
    expect(() => assertAttemptPath(p)).toThrow(BadPathError);
});
```

- [ ] **Step 2:** Run `npx vitest run tests/attempts.test.ts` — Expected: FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** 같은 명령 — Expected: PASS
- [ ] **Step 5:** Commit `feat: add attempt files with draft, submit and same-day retries`

---

### Task 6: 점수와 집계

**Files:**
- Create: `lib/scores.ts`
- Test: `tests/scores.test.ts`

**Interfaces:**
- Consumes: Task 4 타입, Task 5 `attemptOrder`
- Produces:
  - `attemptScore(a: Attempt): { score: number; by: 'ai' | 'self' } | null` — draft면 null, `ai_score` 우선
  - `illusion(a: Attempt): number | null` — `graded`일 때만 `self_score - ai_score`
  - `questionScore(attempts: Attempt[], questionId: string): { score: number; by: 'ai'|'self' } | null` — 그 질문의 점수 있는 시도 중 `attemptOrder` 최대
  - `dayStats(attempts: Attempt[]): Record<string, { count: number; avg: number | null }>` — count는 draft 포함, avg는 점수 있는 시도의 `attemptScore` 평균(반올림)
  - `topicAverages(questions: Question[], attempts: Attempt[]): { topic: string; avg: number; n: number }[]` — 점수 있는 질문만, `questionScore` 평균
  - `buildTree(questions: Question[]): { q: Question; children: TreeNode[] }[]` — 루트 = `parent`가 null이거나 존재하지 않는 id. `TreeNode = { q: Question; children: TreeNode[] }`. 순환이 있어도 무한루프 없이 끊는다(방문 집합).

- [ ] **Step 1: 실패하는 테스트** (Attempt 객체를 직접 만드는 `mk(partial)` 헬퍼)

```ts
it('prefers ai score and ignores drafts', () => {
  expect(attemptScore(mk({ status: 'graded', self_score: 70, ai_score: 65 }))).toEqual({ score: 65, by: 'ai' });
  expect(attemptScore(mk({ status: 'pending', self_score: 70 }))).toEqual({ score: 70, by: 'self' });
  expect(attemptScore(mk({ status: 'draft' }))).toBeNull();
});
it('computes illusion only when graded', () => {
  expect(illusion(mk({ status: 'graded', self_score: 80, ai_score: 55 }))).toBe(25);
  expect(illusion(mk({ status: 'pending', self_score: 80 }))).toBeNull();
});
it('question score uses the latest scored attempt, suffix breaks same-day ties', () => {
  const as = [mk({ question: 'q', date: '2026-11-25', path: 'study/2026-11-25/q.md', status: 'graded', self_score: 70, ai_score: 65 }),
              mk({ question: 'q', date: '2026-11-25', path: 'study/2026-11-25/q-2.md', status: 'pending', self_score: 80 }),
              mk({ question: 'q', date: '2026-11-26', path: 'study/2026-11-26/q.md', status: 'draft' })];
  expect(questionScore(as, 'q')).toEqual({ score: 80, by: 'self' });
  expect(dayStats(as)['2026-11-25']).toEqual({ count: 2, avg: 73 });
  expect(dayStats(as)['2026-11-26']).toEqual({ count: 1, avg: null });
});
it('builds a tree and survives a cycle', () => {
  const qs = [qq('a', null), qq('b', 'a'), qq('c', 'b'), qq('x', 'y'), qq('y', 'x')];
  const t = buildTree(qs);
  expect(t.find(n => n.q.id === 'a')!.children[0].children[0].q.id).toBe('c');
});
```

- [ ] **Step 2:** Run `npx vitest run tests/scores.test.ts` — Expected: FAIL
- [ ] **Step 3:** 구현 (순환만 있는 무리(x↔y)는 루트가 없으므로, 트리에 아직 안 들어간 질문을 루트로 추가해 화면에서 사라지지 않게 한다)
- [ ] **Step 4:** 같은 명령 — Expected: PASS
- [ ] **Step 5:** Commit `feat: add score display rules and aggregates`

---

### Task 7: 질문 가져오기

**Files:**
- Create: `scripts/import.mjs`, `tests/fixtures/bank-a.js`, `tests/fixtures/bank-b.js`
- Test: `tests/import.test.ts`

**Interfaces:**
- Consumes: Task 4 `createQuestion`
- Produces:
  - `export const BANK_FILES: string[]` — 스펙 §8 순서의 세 파일명 (`04_면접·코테/` 기준 상대 경로)
  - `export function loadBank(file: string): { title: string; bank: { t: string; q: string; a: string }[] }` — 파일 원문을 `node:vm`의 `runInNewContext(src + '\n;CFG', {})`로 평가
  - `export function htmlToMd(html: string): string` — `<b>`/`</b>` → `**`, `<code>`/`</code>` → `` ` ``, 나머지 태그 제거, `&lt; &gt; &amp; &quot;` 복원
  - `export function importBanks(root: string, files: string[], created: string): { created: number; skipped: number }` — 파일 순서대로 `bank`만, `source: 'mock'`, `from: title`, `topic: t`, `answer: htmlToMd(a)` 또는 빈 문자열이면 null
  - 직접 실행 시(`import.meta.url === pathToFileURL(process.argv[1]).href`): 인자 `<RESUME 경로>`, `files = BANK_FILES.map(f => path.join(arg, '04_면접·코테', f))`, `root = data/`, 결과 `가져옴 N · 건너뜀 M` 출력. 인자 없거나 파일 없으면 한 줄 오류 + exit 1.

픽스처: `bank-a.js` = `var CFG = {"title":"A","open":{"t":"자기소개"},"bank":[{"no":"01","t":"OS","q":"프로세스와 스레드?","a":"<b>공유</b> <code>x</code>","mine":"m","pri":false},{"no":"01","t":"OS","q":"뮤텍스?","a":"","mine":"","pri":false}]};`, `bank-b.js` = 같은 형식으로 `"q":"프로세스와 스레드"`(중복) 1개 + 새 질문 1개.

- [ ] **Step 1: 실패하는 테스트**

```ts
it('imports bank only, dedups across files, and is idempotent', () => {
  expect(importBanks(tmp, [A, B], '2026-11-25')).toEqual({ created: 3, skipped: 1 });
  expect(importBanks(tmp, [A, B], '2026-11-25')).toEqual({ created: 0, skipped: 4 });
  const qs = listQuestions(tmp);
  expect(qs.map(q => q.text)).not.toContain('자기소개');
  expect(qs[0]).toMatchObject({ source: 'mock', from: 'A', topic: 'OS', answer: '**공유** `x`' });
  expect(qs[1].answer).toBeNull();
});
```

- [ ] **Step 2:** Run `npx vitest run tests/import.test.ts` — Expected: FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** 같은 명령 — Expected: PASS
- [ ] **Step 5:** 실데이터 확인. Run: `npm run import -- "$HOME/Library/Mobile Documents/com~apple~CloudDocs/me/RESUME"` — Expected: `가져옴 37 · 건너뜀 19`. 다시 실행 — Expected: `가져옴 0 · 건너뜀 56`. `grep -l "kind: experience" data/questions/*.md | wc -l` — Expected: `5`.
- [ ] **Step 6:** Commit (가져온 `data/questions/` 포함) `feat: import the mock-interview question banks`

---

### Task 8: `/채점` 명령

**Files:**
- Create: `.claude/commands/채점.md`, `tests/fixtures/grading/` (질문 1개 + `pending` 시도 1개, 수동 검증용)

**Interfaces:**
- Consumes: 스펙 §6 `/채점` 동작, §7 파일 형식, Task 3 id 규칙, Task 5 섹션 이름
- Produces: Claude Code에서 `/채점`으로 실행되는 프롬프트

명령 파일에 담을 지시 (스펙 §6을 그대로 옮기되 다음을 명시한다):
- 대상: `data/study/*/*.md` 중 `status: pending`. 없으면 "채점 대기 없음"만 말하고 끝.
- 기준표 표(개념/경험 해석 포함), AI 값은 정수 `concept 0..60`, `tradeoff 0..40`. 참고 답안이 없으면 자기 지식으로.
- 꼬리질문 2~3개: 각각 `data/questions/` 전체 문장을 읽고 의미가 같으면 기존 id 재사용(그 질문 파일은 수정하지 않음). 새 질문이면 id = `max 순번 + 1` 4자리 + 스펙 §7 slug 규칙, frontmatter `kind`는 `경험|실무|직접|겪어` 규칙, `source: followup`, `parent: <채점한 질문 id>`, `from: null`, `created: <오늘>`. 참고 답안 섹션 없음.
- frontmatter 값 형식: Task 2의 규칙(평범한 id·날짜는 따옴표 없이, 객체·배열·특수문자 문자열은 JSON).
- 순서: 꼬리질문 파일을 모두 만든 **뒤에** 시도 파일에 `ai`, `ai_score`, `followups`, `## 채점 결과`(빠진 개념, 근거) 추가 + `status: graded`. 다른 키와 본문은 건드리지 않는다.
- 끝나면 시도별 `질문 · 자기 → AI (착각 지수)` 한 줄 요약.

- [ ] **Step 1:** 명령 파일 작성.
- [ ] **Step 2:** 한글 명령 이름 확인. Claude Code에서 `/` 입력 후 목록에 `채점`이 뜨는지 본다. 안 뜨면 파일명을 `grade.md`로 바꾸고 README·스펙 §6의 명령 이름을 `/grade`로 고친다.
- [ ] **Step 3:** 픽스처로 수동 검증: `tests/fixtures/grading/`을 임시로 `data/`에 복사 → `/채점` 실행 → 기대: 시도가 `graded`, `ai_score = ai.concept + ai.tradeoff`, `followups`의 id가 모두 `data/questions/`에 존재, 새 질문의 `parent`가 원 질문 id. `npx vitest run`이 여전히 통과. 확인 후 복사한 픽스처를 지운다.
- [ ] **Step 4:** Commit `feat: add the /채점 Claude Code command`

---

### Task 9: 쓰기 API

**Files:**
- Create: `app/api/questions/route.ts`, `app/api/attempts/route.ts`, `app/api/attempts/submit/route.ts`, `app/api/audio/route.ts`
- Test: `tests/api.test.ts` (route handler 함수를 직접 호출, `process.chdir(tmp)`로 `DATA_ROOT`가 임시 폴더를 가리키게 하거나 `lib/paths.ts`를 `vi.mock`)

**Interfaces:**
- Consumes: Task 4·5 함수
- Produces (모두 JSON, 실패 시 `{ error: string }`):
  - `POST /api/questions` body `{ text, topic, source, from?, kind? }` → `200 { question, created }`. `text`·`topic` 비면 400. `source`가 4값 밖이면 400.
  - `POST /api/attempts` body `{ questionId }` → `200 { attempt }` (`startAttempt(DATA_ROOT, questionId, today())`). 질문 없으면 404.
  - `PATCH /api/attempts` body `{ path, patch }` → `200 { attempt }`. `BadPathError` 400, `NotDraftError` 409.
  - `POST /api/attempts/submit` body `{ path, explanation, mode, self, mine? }` → `200 { attempt }`. 검증 실패 400, `NotDraftError` 409.
  - `POST /api/audio?path=<시도 경로>` body = 녹음 바이너리 → `audioPathFor(path)`에 저장, `200 { ok: true }`. 경로 검증 400, 시도 없음 404.

- [ ] **Step 1: 실패하는 테스트** — 시나리오 하나: 질문 생성 → 시도 시작 → PATCH 메모 → submit → 다시 PATCH가 409. 그리고 `PATCH { path: '../x.md' }` → 400, `POST /api/questions { text: '' }` → 400.
- [ ] **Step 2:** Run `npx vitest run tests/api.test.ts` — Expected: FAIL
- [ ] **Step 3:** 구현 (Next 16 route handler 시그니처는 context7로 확인)
- [ ] **Step 4:** 같은 명령 — Expected: PASS
- [ ] **Step 5:** Commit `feat: add write APIs for questions, attempts and audio`

---

### Task 10: 풀이 화면

**Files:**
- Create: `app/study/page.tsx` (서버: `?a=` 시도와 질문 읽기), `components/StudyRunner.tsx` (클라이언트), `components/Nav.tsx`
- Modify: `app/layout.tsx` (Nav — 풀이 화면에서는 숨김)

**Interfaces:**
- Consumes: Task 4·5 읽기 함수, Task 9 API, Task 6 `attemptScore`·`illusion`
- Produces: `/study?a=<path>`. Nav 링크: 홈(`/`), 질문(`/bank`), 그래프(`/graph`), 트리(`/tree`).

동작 (스펙 §5·§9):
- `status: draft` → 전체화면 풀이. 상단: 토픽·출처, 타이머 `HH:MM:SS`, [시작]/[일시정지], [나가기](→ `/bank`). 가운데: 질문 크게. 메모 textarea, 링크 입력(Enter로 추가, 목록 표시). 설명: [글 쓰기] textarea / [말로 설명] 녹음 토글. 자기채점 라디오(개념 0·30·60, 트레이드오프 0·20·40, 경험 질문이면 §6의 경험 문구로 라벨). [제출]은 설명이 비었거나 자기채점 둘 중 하나라도 안 골랐으면 비활성.
- 타이머: 열면 항상 일시정지 상태, 저장된 `seconds`부터. 돌아가는 동안 30초마다, 그리고 일시정지·[나가기]·제출 시 `PATCH`(`seconds`, `memo`, `links`, `explanation`, `mine`, `mode`). 409를 받으면 "이미 제출된 기록입니다" 알림 후 새로고침.
- 녹음: `MediaRecorder`(`audio/webm`)로 녹음, 동시에 `webkitSpeechRecognition`(`lang='ko-KR'`, `continuous`, `interimResults`) 결과를 설명 textarea에 이어 붙인다. 인식이 침묵으로 `end`되면 녹음 중일 때 다시 `start()`. 정지 시 blob을 `POST /api/audio`. 마이크 거부·인식 미지원·`error` 이벤트면 녹음은 계속(가능할 때) 하고 "받아쓰기를 못 해서 글 쓰기로 바꿨어요" 표시 후 글 쓰기 탭으로.
- 제출 → `POST /api/attempts/submit` → 같은 페이지 새로고침.
- `status: pending|graded` → 읽기 전용: 질문, 내 설명, 메모·링크, 자기점수, **참고 답안 공개**, graded면 AI 점수·착각 지수·`## 채점 결과`·`followups` 링크(각 질문으로 `POST /api/attempts` 후 이동하는 [공부하기] 버튼). [다시 풀기] 버튼 = 같은 질문으로 `POST /api/attempts`.
- 디자인: frontend-design 스킬로 잡다 인적성 검사 같은 몰입형 화면 (Global Constraints 안에서).

- [ ] **Step 1:** 구현.
- [ ] **Step 2:** 실행 확인 (run 스킬 또는 chrome-devtools): `npm run dev` → 가져온 질문 하나로 `POST /api/attempts` → `/study?a=…`. 확인할 것: 타이머 시작·일시정지 후 새로고침해도 시간 유지 / 다른 탭으로 가도 시간이 계속 감 / 제출 버튼 비활성 조건 / 제출 후 참고 답안이 보이고 편집 불가 / 같은 페이지를 다른 탭에 열어 두고 제출 후 그 탭에서 일시정지 → 409 알림 / 녹음 후 `data/study/<오늘>/*.webm` 생김, `git status`에 webm 안 보임.
- [ ] **Step 3:** `npm run build && npm test` — Expected: 성공
- [ ] **Step 4:** Commit `feat: add the immersive study screen`

---

### Task 11: 질문 은행과 질문 추가

**Files:**
- Create: `app/bank/page.tsx`, `app/bank/new/page.tsx` (+ 필요한 작은 클라이언트 컴포넌트)

**Interfaces:**
- Consumes: Task 4 `listQuestions`, Task 5 `listAttempts`, Task 6 `questionScore`, Task 9 API
- Produces: `/bank?topic=&source=&exp=1&sort=`, `/bank/new`

동작 (스펙 §9):
- 필터: 토픽, 출처(real/mock/self/followup), **"경험 질문 포함" 토글 기본 꺼짐**(`exp=1`일 때만 `kind: experience` 표시).
- 정렬(`sort`): `todo`(미학습 먼저, 기본) / `pending`(채점 대기 시도 있는 질문 먼저) / `low`(질문 점수 낮은 순).
- 각 행: 질문, 토픽, 출처, 질문 점수(자기점수면 흐리게), [공부하기] → `POST /api/attempts` → `/study?a=…`.
- `/bank/new`: 질문 문장, 토픽(기존 토픽 datalist), 출처 라디오와 안내문 "실제 면접에서 받은 질문만 real. 예상질문·직접 만든 질문은 self.", from(선택). 제출 → `POST /api/questions`; `created:false`면 "이미 있는 질문입니다" + 그 질문 링크.

- [ ] **Step 1:** 구현
- [ ] **Step 2:** 실행 확인: 기본 목록 32개(경험 5개 숨김), 토글 켜면 37개, 같은 질문을 띄어쓰기만 바꿔 추가하면 "이미 있는 질문", 새 질문 추가 시 id 순번 `0038`.
- [ ] **Step 3:** `npm run build && npm test` — Expected: 성공
- [ ] **Step 4:** Commit `feat: add the question bank and add-question form`

---

### Task 12: 홈 캘린더와 블로그 뷰·회고

**Files:**
- Create: `lib/retro.ts`, `app/api/retro/route.ts`, `app/day/[date]/page.tsx`, `components/RetroEditor.tsx`
- Modify: `app/page.tsx`
- Test: `tests/retro.test.ts`

**Interfaces:**
- Consumes: Task 5 `listAttempts`, Task 6 `dayStats`·`attemptScore`, Task 4 `readQuestion`
- Produces:
  - `readRetro(root: string, date: string): { read: string; dev: string; retro: string }` — 없으면 빈 문자열 셋
  - `writeRetro(root: string, date: string, v: { read: string; dev: string; retro: string }): void` — `study/<date>.md`, 섹션 `읽은 글`/`개발한 것`/`회고`. `date`가 `^\d{4}-\d{2}-\d{2}$` 아니면 throw.
  - `PUT /api/retro` body `{ date, read, dev, retro }` → 200 / 400

- [ ] **Step 1: 실패하는 테스트**

```ts
it('round-trips a retro and rejects bad dates', () => {
  expect(readRetro(tmp, '2026-11-25')).toEqual({ read: '', dev: '', retro: '' });
  writeRetro(tmp, '2026-11-25', { read: '- [글](https://a.io) — 한 줄', dev: 'x', retro: 'y' });
  expect(readRetro(tmp, '2026-11-25').read).toBe('- [글](https://a.io) — 한 줄');
  expect(() => writeRetro(tmp, '../x', { read: '', dev: '', retro: '' })).toThrow();
});
it('retro files are not listed as attempts', () => {
  writeRetro(tmp, '2026-11-25', { read: '', dev: '', retro: 'y' });
  expect(listAttempts(tmp)).toEqual([]);
});
```

- [ ] **Step 2:** Run `npx vitest run tests/retro.test.ts` — Expected: FAIL
- [ ] **Step 3:** `lib/retro.ts`, API 구현 → 테스트 PASS
- [ ] **Step 4:** 홈 `/?m=YYYY-MM` (기본 이번 달): 월 달력, 칸 색 농도 = `dayStats.count`(0, 1, 2, 3+ 네 단계), 칸 안 숫자 = `avg`, 이전/다음 달 링크, 날짜 클릭 → `/day/<date>`. 오늘의 [질문 고르기] → `/bank`.
- [ ] **Step 5:** `/day/[date]`: 그날 시도 목록(질문, 상태, 표시 점수, 공부 시간) → `/study?a=…`, 아래 회고 편집기(세 칸, [저장] → `PUT /api/retro`). 시도·회고 모두 없으면 빈 상태 문구.
- [ ] **Step 6:** 실행 확인: Task 10에서 만든 시도가 오늘 칸에 보이고, 회고 저장 후 `data/study/<오늘>.md` 생성, 새로고침해도 유지. `npm run build && npm test` 성공.
- [ ] **Step 7:** Commit `feat: add the calendar home, day view and daily retro`

---

### Task 13: 그래프와 꼬리질문 트리

**Files:**
- Create: `app/graph/page.tsx`, `app/tree/page.tsx`, `components/charts.tsx` (SVG 막대·선, 패키지 없음)

**Interfaces:**
- Consumes: Task 6 `topicAverages`·`attemptScore`·`illusion`·`questionScore`·`buildTree`, Task 4·5 목록 함수
- Produces: `/graph`, `/graph?q=<질문 id>`, `/tree`

동작 (스펙 §9):
- `/graph`: 토픽별 평균 막대(라벨에 `n`), 착각 지수 큰 순 목록(graded 시도, 질문·자기·AI·차이, 클릭 → 시도), 질문 선택 시 `?q=`로 그 질문의 시도별 자기점수 선 + AI 점수 선(x = `attemptOrder` 순).
- `/tree`: `buildTree` 결과를 들여쓴 접이식 목록(`<details>`). 노드: 질문, 질문 점수(없으면 "미학습", 자기점수면 흐리게), [공부하기]. 꼬리질문이 없는 루트는 접힌 기본 상태로 아래에 몰아도 된다.
- 차트 작성 전 dataviz 스킬을 읽는다. 데이터 0건이면 빈 상태 문구.

- [ ] **Step 1:** 구현
- [ ] **Step 2:** 실행 확인: Task 8 픽스처를 `data/`에 다시 넣고 `/채점`을 돌린 상태(또는 graded 시도를 손으로 하나 작성)에서 토픽 막대·착각 지수 목록·질문 추이·트리의 부모→꼬리질문이 보인다. 확인 후 테스트용 데이터 제거.
- [ ] **Step 3:** `npm run build && npm run lint && npm test` — Expected: 성공
- [ ] **Step 4:** Commit `feat: add score graphs and the follow-up tree`

---

## Self-Review 결과

- 스펙 커버리지: §2 목표 → T10–13 / §3 제약 → Global Constraints, T1 / §5 상태 전이·시도·타이머 → T5, T10 / §6 기준표·표시 점수·착각 지수 → T5, T6 / `/채점` → T8 / 트리 → T6, T13 / §7 파일·id·git → T2–5, T1 / §8 가져오기 → T7, 수동 추가 → T11 / §9 화면 → T10–13 / §12 교체 범위 → T1.
- 이름 일관성: `startAttempt`/`saveDraft`/`submitAttempt`/`attemptOrder`/`attemptScore`/`questionScore`/`illusion`/`dayStats`/`topicAverages`/`buildTree`/`createQuestion`/`listQuestions`/`readQuestion`/`listAttempts`/`readAttempt`/`readRetro`/`writeRetro`/`audioPathFor`/`assertAttemptPath`/`DATA_ROOT` — 정의한 Task와 사용하는 Task에서 같은 이름.
- 남은 판단(빌더 몫): 라우트·컴포넌트 세부 분리, 색·폰트, 차트 세부 모양.
