# day-by-day TOEIC 프론트엔드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 달력 날짜 기반으로 매일 토익 단어·문장을 학습하고 복습 시험을 보는 웹앱의 프론트엔드를 만든다.

**Architecture:** Next.js App Router SPA. 콘텐츠는 `public/data/`의 정적 JSON, 진도는 localStorage. 화면은 `contentRepo`/`progressRepo` 두 데이터 접근 모듈만 바라보며, 나중에 백엔드 API로 구현체만 교체한다. 퀴즈 생성·채점·스트릭 계산은 순수 함수로 분리해 유닛 테스트한다.

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind CSS + Vitest (유닛 테스트). 그 외 런타임 라이브러리 없음.

**Spec:** `docs/superpowers/specs/2026-08-04-toeic-daily-frontend-design.md`

## Global Constraints

- 상태 관리 라이브러리 금지 (React 기본 훅만)
- 외부 UI/달력 라이브러리 금지 (달력은 월 그리드 직접 구현)
- 첫 버전 제외: 로그인, 듣기(TTS), 토익 모의고사
- 데이터 경로: `public/data/days/YYYY-MM-DD.json`, `public/data/index.json`
- `id`는 전체 데이터에서 유일. `blankWord`는 `text`에 정확히 1회 등장. `distractors`는 정확히 3개
- 채점: 문항별 **첫 시도**만 정답률·오답노트에 반영. 세션 끝 재도전은 기록하지 않음
- 시드 데이터: 2026-08-04부터 연속 14일, 하루 단어 10개 + 문장 5개
- 날짜는 브라우저 로컬 타임존 기준 `YYYY-MM-DD` 문자열로 통일
- UI 화면 태스크(Task 7~11)를 구현하는 작업자는 코드 작성 전에 `frontend-design` 스킬을 로드할 것

## 파일 구조

```
app/
  layout.tsx            # 루트 레이아웃 + 상단 네비게이션
  page.tsx              # 홈
  calendar/page.tsx     # 달력
  learn/[date]/page.tsx # 학습 세션 (몰입형, 네비 숨김)
  review/page.tsx       # 복습 시험
  notes/page.tsx        # 오답노트
  stats/page.tsx        # 통계
components/
  MonthCalendar.tsx     # 월 그리드 달력 (홈 미니/달력 페이지 공용)
  QuizCard.tsx          # 4지선다 문항 UI (단어 퀴즈·문장 빈칸 공용)
  ArrangeCard.tsx       # 문장 조합 문항 UI
  WordBrowse.tsx        # 단어 훑기 카드
  SessionRunner.tsx     # 학습 세션 진행 (useSession 훅 사용)
lib/
  types.ts              # 데이터·진도 타입 전부
  date.ts               # todayStr, addDays 등 날짜 헬퍼
  contentRepo.ts        # 콘텐츠 조회 (JSON fetch)
  progressRepo.ts       # 진도 저장/조회 (localStorage) + calcStreak
  quiz.ts               # 퀴즈 문항 생성 (순수 함수)
  session.ts            # 세션 문항 큐·재도전·채점 로직 (순수 함수)
scripts/
  validate-data.mjs     # npm run validate-data
public/data/
  index.json
  days/2026-08-04.json … 2026-08-17.json
tests/
  quiz.test.ts, session.test.ts, progressRepo.test.ts, date.test.ts
```

---

### Task 1: 프로젝트 스캐폴드

**Files:**
- Create: Next.js 프로젝트 전체 (create-next-app), `app/layout.tsx` 수정

**Interfaces:**
- Produces: 실행 가능한 Next.js + TS + Tailwind 앱, 상단 네비게이션(홈/달력/복습/오답노트/통계 링크)

- [ ] **Step 1: create-next-app 실행**

```bash
cd /Users/hyunbok/Desktop/day-by-day-TOEIC
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
```

기존 `README.md`, `docs/` 는 유지한다 (create-next-app이 비어있지 않다고 거부하면 임시 디렉토리에 생성 후 `.git`/`docs`/`README.md` 제외하고 복사).

- [ ] **Step 2: dev 서버 기동 확인**

Run: `npm run dev` 후 `curl -s localhost:3000 | head -5`
Expected: HTML 응답 (200)

- [ ] **Step 3: Vitest 설치·설정**

```bash
npm i -D vitest @vitest/coverage-v8 jsdom
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

`package.json` scripts에 추가: `"test": "vitest run"`, `"validate-data": "node scripts/validate-data.mjs"`

- [ ] **Step 4: 루트 레이아웃 + 네비게이션**

`app/layout.tsx` — `<nav>`에 링크 5개: `/`(홈), `/calendar`(달력), `/review`(복습), `/notes`(오답노트), `/stats`(통계). 메타데이터 title: "day-by-day TOEIC". 학습 세션 페이지는 자체적으로 전체화면 UI를 그리므로 네비는 layout에 두되, `/learn` 하위에서는 숨긴다 — 클라이언트 컴포넌트 `components/Nav.tsx`에서 `usePathname()`으로 `/learn` prefix면 `return null`.

- [ ] **Step 5: 빌드·테스트 확인 후 커밋**

Run: `npm run build && npm test`
Expected: 빌드 성공, 테스트 0건 통과(no tests found는 OK)

```bash
git add -A && git commit -m "feat: scaffold Next.js app with Tailwind, Vitest, base nav"
```

---

### Task 2: 타입·날짜 헬퍼

**Files:**
- Create: `lib/types.ts`, `lib/date.ts`
- Test: `tests/date.test.ts`

**Interfaces:**
- Produces (이후 모든 태스크가 사용):

```ts
// lib/types.ts — 전문
export interface Word {
  id: string; word: string; pos: string; meaning: string;
  example: string; exampleKo: string;
}
export interface Sentence {
  id: string; text: string; ko: string;
  blankWord: string; distractors: string[];
}
export interface DayContent {
  date: string; title: string; words: Word[]; sentences: Sentence[];
}
export interface DayIndexEntry { date: string; title: string; }

export type QuizType = 'word' | 'blank' | 'arrange';

export interface DayRecord {
  date: string;
  completedAt: string; // ISO
  scores: { word: number; blank: number; arrange: number }; // 0~100 정수
}
export interface WrongNote {
  type: QuizType; itemId: string; date: string; wrongCount: number;
}
export interface ReviewRecord {
  takenAt: string; // ISO
  scope: 'recent7' | 'all' | 'wrong';
  correct: number; total: number;
}
```

```ts
// lib/date.ts
export function todayStr(): string;            // 로컬 타임존 YYYY-MM-DD
export function toDateStr(d: Date): string;
export function addDays(dateStr: string, n: number): string;
export function monthGrid(year: number, month: number): (string | null)[][];
// month: 1~12. 주 단위 2차원 배열, 해당 월 밖 칸은 null. 주는 일요일 시작.
```

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/date.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { toDateStr, addDays, monthGrid } from '@/lib/date';

describe('date helpers', () => {
  it('toDateStr formats local date', () => {
    expect(toDateStr(new Date(2026, 7, 4))).toBe('2026-08-04');
  });
  it('addDays crosses month boundary', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
  });
  it('monthGrid: 2026-08 starts on Saturday, has 31 days', () => {
    const g = monthGrid(2026, 8);
    expect(g[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(g[0][6]).toBe('2026-08-01');
    expect(g.flat().filter(Boolean)).toHaveLength(31);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/date.test.ts` / Expected: FAIL (module not found)

- [ ] **Step 3: 구현** — `lib/types.ts`(위 전문 그대로), `lib/date.ts`:

```ts
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function todayStr(): string { return toDateStr(new Date()); }
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toDateStr(new Date(y, m - 1, d + n));
}
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks: (string | null)[][] = [];
  let week: (string | null)[] = new Array(first.getDay()).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(toDateStr(new Date(year, month - 1, d)));
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) weeks.push([...week, ...new Array(7 - week.length).fill(null)]);
  return weeks;
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/date.test.ts` / Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add lib/types.ts lib/date.ts tests/date.test.ts
git commit -m "feat: add data/progress types and date helpers"
```

---

### Task 3: 데이터 검증 스크립트 + Day 1 시드

**Files:**
- Create: `scripts/validate-data.mjs`, `public/data/index.json`, `public/data/days/2026-08-04.json`

**Interfaces:**
- Consumes: 스키마 (`lib/types.ts`의 `DayContent` 형태와 동일하나 스크립트는 JS로 독립 구현)
- Produces: `npm run validate-data` — 실패 시 exit 1 + 파일별 오류 메시지

- [ ] **Step 1: 검증 스크립트 작성** — `scripts/validate-data.mjs`

```js
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../public/data');
const errors = [];
const index = JSON.parse(readFileSync(path.join(root, 'index.json'), 'utf8'));
const files = readdirSync(path.join(root, 'days')).filter(f => f.endsWith('.json'));
const indexDates = new Set(index.days.map(d => d.date));
const fileDates = new Set(files.map(f => f.replace('.json', '')));

for (const d of indexDates) if (!fileDates.has(d)) errors.push(`index에 있는 ${d}의 파일이 없음`);
for (const d of fileDates) if (!indexDates.has(d)) errors.push(`days/${d}.json이 index에 없음`);

const allIds = new Set();
for (const f of files) {
  const p = `days/${f}`;
  const day = JSON.parse(readFileSync(path.join(root, 'days', f), 'utf8'));
  if (day.date !== f.replace('.json', '')) errors.push(`${p}: date 필드(${day.date})와 파일명 불일치`);
  if (!day.title) errors.push(`${p}: title 없음`);
  for (const w of day.words ?? []) {
    for (const k of ['id', 'word', 'pos', 'meaning', 'example', 'exampleKo'])
      if (!w[k]) errors.push(`${p} ${w.id ?? w.word}: words.${k} 없음`);
    if (allIds.has(w.id)) errors.push(`${p}: 중복 id ${w.id}`);
    allIds.add(w.id);
  }
  for (const s of day.sentences ?? []) {
    for (const k of ['id', 'text', 'ko', 'blankWord'])
      if (!s[k]) errors.push(`${p} ${s.id}: sentences.${k} 없음`);
    if (allIds.has(s.id)) errors.push(`${p}: 중복 id ${s.id}`);
    allIds.add(s.id);
    const count = (s.text ?? '').split(/\s+/).filter(t => t.replace(/[.,!?;:]/g, '') === s.blankWord).length;
    if (count !== 1) errors.push(`${p} ${s.id}: blankWord "${s.blankWord}"가 text에 ${count}회 등장 (1회여야 함)`);
    if (!Array.isArray(s.distractors) || s.distractors.length !== 3)
      errors.push(`${p} ${s.id}: distractors는 정확히 3개여야 함`);
  }
  if ((day.words ?? []).length !== 10) errors.push(`${p}: 단어 ${day.words?.length}개 (10개여야 함)`);
  if ((day.sentences ?? []).length !== 5) errors.push(`${p}: 문장 ${day.sentences?.length}개 (5개여야 함)`);
}

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`OK — ${files.length}일치 데이터 검증 통과`);
```

- [ ] **Step 2: Day 1 시드 파일 작성** — `public/data/days/2026-08-04.json` (전문)

```json
{
  "date": "2026-08-04",
  "title": "Day 1 — 계약과 협상",
  "words": [
    { "id": "w-negotiate", "word": "negotiate", "pos": "v.", "meaning": "협상하다", "example": "We need to negotiate the terms of the contract.", "exampleKo": "우리는 계약 조건을 협상해야 한다." },
    { "id": "w-contract", "word": "contract", "pos": "n.", "meaning": "계약(서)", "example": "Please review the contract before signing it.", "exampleKo": "서명하기 전에 계약서를 검토해 주세요." },
    { "id": "w-agreement", "word": "agreement", "pos": "n.", "meaning": "합의, 협정", "example": "Both parties reached an agreement on the price.", "exampleKo": "양측은 가격에 대해 합의에 도달했다." },
    { "id": "w-terms", "word": "terms", "pos": "n.", "meaning": "(계약) 조건", "example": "The terms of the deal are favorable to us.", "exampleKo": "그 거래의 조건은 우리에게 유리하다." },
    { "id": "w-revise", "word": "revise", "pos": "v.", "meaning": "수정하다", "example": "We will revise the proposal by Friday.", "exampleKo": "금요일까지 제안서를 수정하겠습니다." },
    { "id": "w-deadline", "word": "deadline", "pos": "n.", "meaning": "마감 기한", "example": "The deadline for submission is next Monday.", "exampleKo": "제출 마감 기한은 다음 주 월요일이다." },
    { "id": "w-propose", "word": "propose", "pos": "v.", "meaning": "제안하다", "example": "I propose that we extend the schedule.", "exampleKo": "일정을 연장할 것을 제안합니다." },
    { "id": "w-clause", "word": "clause", "pos": "n.", "meaning": "조항", "example": "The confidentiality clause protects both companies.", "exampleKo": "비밀 유지 조항은 양사를 보호한다." },
    { "id": "w-mutual", "word": "mutual", "pos": "adj.", "meaning": "상호의", "example": "The partnership is based on mutual trust.", "exampleKo": "그 파트너십은 상호 신뢰에 기반한다." },
    { "id": "w-finalize", "word": "finalize", "pos": "v.", "meaning": "마무리 짓다, 확정하다", "example": "We hope to finalize the deal this week.", "exampleKo": "이번 주에 거래를 확정하기를 바랍니다." }
  ],
  "sentences": [
    { "id": "s-0804-1", "text": "The manager will negotiate the contract next week.", "ko": "매니저가 다음 주에 계약을 협상할 것이다.", "blankWord": "negotiate", "distractors": ["postpone", "estimate", "submit"] },
    { "id": "s-0804-2", "text": "Both companies signed the agreement after months of discussion.", "ko": "양사는 수개월의 논의 끝에 협정에 서명했다.", "blankWord": "agreement", "distractors": ["appliance", "attendance", "allowance"] },
    { "id": "s-0804-3", "text": "Please revise the report before the deadline.", "ko": "마감 기한 전에 보고서를 수정해 주세요.", "blankWord": "revise", "distractors": ["reside", "resign", "remove"] },
    { "id": "s-0804-4", "text": "The new clause was added to protect confidential information.", "ko": "기밀 정보를 보호하기 위해 새 조항이 추가되었다.", "blankWord": "clause", "distractors": ["cause", "course", "closure"] },
    { "id": "s-0804-5", "text": "We expect to finalize the terms by Friday.", "ko": "금요일까지 조건을 확정할 것으로 예상한다.", "blankWord": "finalize", "distractors": ["fertilize", "formalize", "familiarize"] }
  ]
}
```

- [ ] **Step 3: index.json 작성** — `public/data/index.json`

```json
{ "days": [ { "date": "2026-08-04", "title": "Day 1 — 계약과 협상" } ] }
```

- [ ] **Step 4: 검증 통과 확인** — Run: `npm run validate-data` / Expected: `OK — 1일치 데이터 검증 통과`

일부러 distractor 하나를 지워서 다시 실행 → 오류 메시지 + exit 1 확인 후 원복.

- [ ] **Step 5: 커밋**

```bash
git add scripts/validate-data.mjs public/data
git commit -m "feat: add data validator and Day 1 seed content"
```

---

### Task 4: 시드 데이터 Day 2~14

**Files:**
- Create: `public/data/days/2026-08-05.json` … `2026-08-17.json` (13개)
- Modify: `public/data/index.json`

**Interfaces:**
- Consumes: Task 3의 스키마·검증 스크립트
- Produces: 총 14일치 콘텐츠 (단어 140개, 문장 70개)

각 날짜의 주제와 단어 10개(뜻 포함)는 아래 표대로 한다. **예문(example/exampleKo)과 문장 5개는 작성자가 직접 짓되** 규칙: 문장은 그날 단어 중 5개를 하나씩 `blankWord`로 사용, Part 5 스타일 비즈니스 문장(8~14단어), `distractors`는 같은 품사의 그럴듯한 오답 3개, `ko`는 자연스러운 한국어 번역. id 규칙: 단어 `w-<word>` (중복 시 `w-<word>2`), 문장 `s-<MMDD>-<n>`.

| 날짜 | 제목 | 단어 (뜻) |
|---|---|---|
| 08-05 | Day 2 — 회의와 일정 | schedule 일정(을 잡다) / postpone 연기하다 / attend 참석하다 / agenda 안건 / minutes 회의록 / convene 소집하다 / reschedule 일정을 변경하다 / participant 참가자 / adjourn 휴회하다 / punctual 시간을 지키는 |
| 08-06 | Day 3 — 인사와 채용 | recruit 채용하다 / applicant 지원자 / qualification 자격 (요건) / promote 승진시키다 / salary 급여 / benefits 복리후생 / candidate 후보자 / interview 면접(하다) / probation 수습 (기간) / vacancy 공석 |
| 08-07 | Day 4 — 마케팅과 홍보 | advertisement 광고 / launch 출시(하다) / brochure 안내 책자 / publicity 홍보 / survey 설문 조사 / target 목표(로 삼다) / strategy 전략 / audience 청중, 대상 / feedback 피드백 / campaign 캠페인 |
| 08-08 | Day 5 — 재무와 회계 | budget 예산 / expense 지출, 비용 / invoice 청구서 / revenue 수익 / profit 이익 / audit 회계 감사 / fiscal 회계의, 재정의 / reimburse 상환하다 / estimate 견적(을 내다) / transaction 거래 |
| 08-09 | Day 6 — 출장과 여행 | itinerary 여행 일정표 / reservation 예약 / accommodation 숙소 / depart 출발하다 / fare 운임 / boarding 탑승 / luggage 수하물 / confirm 확인하다 / destination 목적지 / delay 지연(시키다) |
| 08-10 | Day 7 — 사무와 업무 | assign 배정하다 / procedure 절차 / document 문서 / supervise 감독하다 / colleague 동료 / department 부서 / efficient 효율적인 / workload 업무량 / submit 제출하다 / notify 통지하다 |
| 08-11 | Day 8 — 고객 서비스 | complaint 불만 / refund 환불(하다) / inquiry 문의 / respond 응답하다 / satisfaction 만족 / warranty 품질 보증(서) / exchange 교환(하다) / courteous 정중한 / resolve 해결하다 / policy 정책, 방침 |
| 08-12 | Day 9 — 생산과 물류 | manufacture 제조하다 / inventory 재고 / shipment 배송(품) / warehouse 창고 / supplier 공급업체 / deliver 배달하다 / defective 결함이 있는 / assembly 조립 / quality 품질 / distribute 유통시키다 |
| 08-13 | Day 10 — 규정과 법무 | comply 준수하다 / regulation 규정 / permit 허가(증) / liability 법적 책임 / confidential 기밀의 / violation 위반 / approve 승인하다 / restriction 제한 / obligation 의무 / inspect 점검하다 |
| 08-14 | Day 11 — IT와 기술 | install 설치하다 / upgrade 업그레이드(하다) / malfunction 오작동(하다) / technician 기술자 / maintenance 유지 보수 / device 기기 / troubleshoot 문제를 해결하다 / backup 백업 / network 네트워크 / manual 설명서 |
| 08-15 | Day 12 — 부동산과 시설 | lease 임대차 계약 / tenant 세입자 / property 부동산, 자산 / renovation 개조, 보수 / facility 시설 / utility 공과금, 설비 / landlord 임대인 / relocate 이전하다 / spacious 넓은 / premises 부지, 구내 |
| 08-16 | Day 13 — 행사와 네트워킹 | conference 회의, 학회 / register 등록하다 / banquet 연회 / keynote 기조연설 / exhibit 전시(하다) / venue 행사장 / attendee 참석자 / reception 환영회 / sponsor 후원(하다) / session 세션, 시간 |
| 08-17 | Day 14 — 성과와 평가 | evaluate 평가하다 / performance 성과, 실적 / achieve 달성하다 / objective 목표 / outstanding 뛰어난 / productivity 생산성 / appraisal 평가 / exceed 초과하다 / milestone 중요 단계 / recognition 인정 |

- [ ] **Step 1: 13개 날짜 파일 작성** — 위 표 + Day 1 파일(Task 3)의 형식을 그대로 따른다
- [ ] **Step 2: index.json에 14일 전체 등록** — 날짜 오름차순
- [ ] **Step 3: 검증** — Run: `npm run validate-data` / Expected: `OK — 14일치 데이터 검증 통과`
- [ ] **Step 4: 커밋**

```bash
git add public/data
git commit -m "feat: add seed content for days 2-14"
```

---

### Task 5: contentRepo + progressRepo

**Files:**
- Create: `lib/contentRepo.ts`, `lib/progressRepo.ts`
- Test: `tests/progressRepo.test.ts`

**Interfaces:**
- Consumes: `lib/types.ts`의 모든 타입
- Produces:

```ts
// lib/contentRepo.ts — 나중에 백엔드 API로 구현체 교체. 시그니처 고정.
export async function fetchIndex(): Promise<DayIndexEntry[]>;        // GET /data/index.json
export async function fetchDay(date: string): Promise<DayContent | null>; // 404면 null

// lib/progressRepo.ts — localStorage. 시그니처 고정.
export function getDayRecords(): Record<string, DayRecord>;   // key = date
export function saveDayRecord(r: DayRecord): void;            // 같은 날짜는 덮어씀
export function getWrongNotes(): WrongNote[];
export function addWrongNote(n: Omit<WrongNote, 'wrongCount'>): void; // 이미 있으면 wrongCount+1
export function resolveWrongNote(type: QuizType, itemId: string): void; // 목록에서 제거
export function getReviewRecords(): ReviewRecord[];
export function addReviewRecord(r: ReviewRecord): void;
export function calcStreak(records: Record<string, DayRecord>, today: string): number;
```

localStorage 키: `ddt.dayRecords`, `ddt.wrongNotes`, `ddt.reviewRecords` (JSON 직렬화). 값이 없거나 파싱 실패면 빈 값으로 동작.

`calcStreak` 규칙: `today`부터 거꾸로 세어 연속 완료일 수. **오늘 미완료는 스트릭을 끊지 않는다** (오늘 안 했으면 어제부터 센다). 예: 어제·그제 완료 + 오늘 미완료 → 2.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/progressRepo.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDayRecords, saveDayRecord, getWrongNotes, addWrongNote,
  resolveWrongNote, calcStreak,
} from '@/lib/progressRepo';
import type { DayRecord } from '@/lib/types';

const rec = (date: string): DayRecord => ({
  date, completedAt: `${date}T10:00:00.000Z`,
  scores: { word: 90, blank: 80, arrange: 100 },
});

beforeEach(() => localStorage.clear());

describe('progressRepo', () => {
  it('saves and loads day records, overwrites same date', () => {
    saveDayRecord(rec('2026-08-04'));
    saveDayRecord({ ...rec('2026-08-04'), scores: { word: 50, blank: 50, arrange: 50 } });
    const all = getDayRecords();
    expect(Object.keys(all)).toHaveLength(1);
    expect(all['2026-08-04'].scores.word).toBe(50);
  });
  it('addWrongNote increments wrongCount for same item', () => {
    addWrongNote({ type: 'word', itemId: 'w-negotiate', date: '2026-08-04' });
    addWrongNote({ type: 'word', itemId: 'w-negotiate', date: '2026-08-04' });
    expect(getWrongNotes()).toEqual([
      { type: 'word', itemId: 'w-negotiate', date: '2026-08-04', wrongCount: 2 },
    ]);
  });
  it('resolveWrongNote removes the item', () => {
    addWrongNote({ type: 'blank', itemId: 's-0804-1', date: '2026-08-04' });
    resolveWrongNote('blank', 's-0804-1');
    expect(getWrongNotes()).toEqual([]);
  });
  it('returns empty on corrupted storage', () => {
    localStorage.setItem('ddt.wrongNotes', '{broken');
    expect(getWrongNotes()).toEqual([]);
  });
});

describe('calcStreak', () => {
  const recs = (...dates: string[]) =>
    Object.fromEntries(dates.map(d => [d, rec(d)]));
  it('counts consecutive days ending today', () => {
    expect(calcStreak(recs('2026-08-02', '2026-08-03', '2026-08-04'), '2026-08-04')).toBe(3);
  });
  it('today not done yet does not break streak', () => {
    expect(calcStreak(recs('2026-08-02', '2026-08-03'), '2026-08-04')).toBe(2);
  });
  it('gap breaks streak', () => {
    expect(calcStreak(recs('2026-08-01', '2026-08-03'), '2026-08-04')).toBe(1);
  });
  it('empty records → 0', () => {
    expect(calcStreak({}, '2026-08-04')).toBe(0);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/progressRepo.test.ts` / Expected: FAIL

- [ ] **Step 3: 구현**

`lib/contentRepo.ts`:

```ts
import type { DayContent, DayIndexEntry } from './types';

export async function fetchIndex(): Promise<DayIndexEntry[]> {
  const res = await fetch('/data/index.json');
  if (!res.ok) return [];
  const json = await res.json();
  return json.days ?? [];
}

export async function fetchDay(date: string): Promise<DayContent | null> {
  const res = await fetch(`/data/days/${date}.json`);
  if (!res.ok) return null;
  return res.json();
}
```

`lib/progressRepo.ts`:

```ts
import type { DayRecord, WrongNote, ReviewRecord, QuizType } from './types';
import { addDays } from './date';

const KEYS = {
  dayRecords: 'ddt.dayRecords',
  wrongNotes: 'ddt.wrongNotes',
  reviewRecords: 'ddt.reviewRecords',
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

export function getDayRecords(): Record<string, DayRecord> {
  return load(KEYS.dayRecords, {});
}
export function saveDayRecord(r: DayRecord): void {
  const all = getDayRecords();
  all[r.date] = r;
  save(KEYS.dayRecords, all);
}

export function getWrongNotes(): WrongNote[] {
  return load(KEYS.wrongNotes, []);
}
export function addWrongNote(n: Omit<WrongNote, 'wrongCount'>): void {
  const notes = getWrongNotes();
  const found = notes.find(x => x.type === n.type && x.itemId === n.itemId);
  if (found) found.wrongCount += 1;
  else notes.push({ ...n, wrongCount: 1 });
  save(KEYS.wrongNotes, notes);
}
export function resolveWrongNote(type: QuizType, itemId: string): void {
  save(KEYS.wrongNotes, getWrongNotes().filter(x => !(x.type === type && x.itemId === itemId)));
}

export function getReviewRecords(): ReviewRecord[] {
  return load(KEYS.reviewRecords, []);
}
export function addReviewRecord(r: ReviewRecord): void {
  save(KEYS.reviewRecords, [...getReviewRecords(), r]);
}

export function calcStreak(records: Record<string, DayRecord>, today: string): number {
  let cursor = records[today] ? today : addDays(today, -1);
  let streak = 0;
  while (records[cursor]) { streak += 1; cursor = addDays(cursor, -1); }
  return streak;
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/progressRepo.test.ts` / Expected: PASS
- [ ] **Step 5: 커밋**

```bash
git add lib/contentRepo.ts lib/progressRepo.ts tests/progressRepo.test.ts
git commit -m "feat: add content/progress repositories with streak calc"
```

---

### Task 6: 퀴즈 생성 + 세션 로직 (순수 함수)

**Files:**
- Create: `lib/quiz.ts`, `lib/session.ts`
- Test: `tests/quiz.test.ts`, `tests/session.test.ts`

**Interfaces:**
- Consumes: `Word`, `Sentence`, `QuizType` (Task 2)
- Produces:

```ts
// lib/quiz.ts — rng는 () => number (0~1). 기본값 Math.random. 테스트에서 고정 rng 주입.
export interface Choice { text: string; correct: boolean; }
export interface WordQuizItem  { type: 'word';    itemId: string; word: Word; choices: Choice[]; }
export interface BlankQuizItem { type: 'blank';   itemId: string; sentence: Sentence; blankedText: string; choices: Choice[]; }
export interface ArrangeQuizItem { type: 'arrange'; itemId: string; sentence: Sentence; tokens: string[]; answerTokens: string[]; }
export type QuizItem = WordQuizItem | BlankQuizItem | ArrangeQuizItem;

export function shuffle<T>(arr: T[], rng?: () => number): T[];      // 원본 불변, 새 배열
export function buildWordQuiz(words: Word[], pool: Word[], rng?: () => number): WordQuizItem[];
export function buildBlankQuiz(sentences: Sentence[], rng?: () => number): BlankQuizItem[];
export function buildArrangeQuiz(sentences: Sentence[], rng?: () => number): ArrangeQuizItem[];

// lib/session.ts
export interface AnswerLog { type: QuizType; itemId: string; correctOnFirstTry: boolean; }
export function scoreOf(logs: AnswerLog[], type: QuizType): number; // 0~100 반올림, 문항 0개면 100
```

규칙:
- `buildWordQuiz`: 문항당 보기 4개(정답 뜻 1 + 오답 뜻 3). 오답은 `pool`에서 자기 자신·**뜻이 같은 단어**를 제외하고 뽑되, 같은 날 단어(= `words` 배열)를 우선 사용하고 부족하면 나머지 pool에서 채운다. 보기 순서 셔플.
- `buildBlankQuiz`: `blankedText` = `text`에서 `blankWord` 1회를 `____`로 치환 (단어 경계 기준, 구두점 보존). 보기 = 정답 + distractors 3개 셔플.
- `buildArrangeQuiz`: `answerTokens` = `text`를 공백으로 split. `tokens` = answerTokens 셔플. 셔플 결과가 정답 순서와 같으면 한 번 더 셔플 (2단어 이상일 때).
- `itemId`: word 문항은 `word.id`, 문장 문항은 `sentence.id` (오답노트 참조 키).

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/quiz.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { shuffle, buildWordQuiz, buildBlankQuiz, buildArrangeQuiz } from '@/lib/quiz';
import type { Word, Sentence } from '@/lib/types';

const w = (id: string, word: string, meaning: string): Word =>
  ({ id, word, pos: 'v.', meaning, example: '', exampleKo: '' });
const words = [
  w('w-a', 'alpha', '첫째'), w('w-b', 'beta', '둘째'), w('w-c', 'gamma', '셋째'),
  w('w-d', 'delta', '넷째'), w('w-e', 'epsilon', '다섯째'),
];
const sent: Sentence = {
  id: 's-1', text: 'Please revise the report today.', ko: '오늘 보고서를 수정해 주세요.',
  blankWord: 'revise', distractors: ['reside', 'resign', 'remove'],
};
const fixedRng = () => 0.42;

describe('shuffle', () => {
  it('keeps elements, does not mutate input', () => {
    const arr = [1, 2, 3, 4];
    const out = shuffle(arr, fixedRng);
    expect(out.slice().sort()).toEqual([1, 2, 3, 4]);
    expect(arr).toEqual([1, 2, 3, 4]);
  });
});

describe('buildWordQuiz', () => {
  it('4 choices, exactly one correct, correct is the meaning', () => {
    const items = buildWordQuiz(words, words, fixedRng);
    expect(items).toHaveLength(5);
    for (const it of items) {
      expect(it.choices).toHaveLength(4);
      expect(it.choices.filter(c => c.correct)).toHaveLength(1);
      expect(it.choices.find(c => c.correct)!.text).toBe(it.word.meaning);
    }
  });
  it('excludes duplicate meanings from distractors', () => {
    const pool = [...words, w('w-a2', 'omega', '첫째')]; // '첫째' 뜻 중복
    const items = buildWordQuiz([words[0]], pool, fixedRng);
    const texts = items[0].choices.map(c => c.text);
    expect(texts.filter(t => t === '첫째')).toHaveLength(1);
  });
});

describe('buildBlankQuiz', () => {
  it('replaces blankWord with ____ and offers 4 choices', () => {
    const [item] = buildBlankQuiz([sent], fixedRng);
    expect(item.blankedText).toBe('Please ____ the report today.');
    expect(item.choices.map(c => c.text).sort())
      .toEqual(['remove', 'reside', 'resign', 'revise']);
    expect(item.choices.find(c => c.correct)!.text).toBe('revise');
  });
});

describe('buildArrangeQuiz', () => {
  it('tokens are a permutation of answer, not in answer order', () => {
    const [item] = buildArrangeQuiz([sent], fixedRng);
    expect(item.answerTokens).toEqual(['Please', 'revise', 'the', 'report', 'today.']);
    expect(item.tokens.slice().sort()).toEqual(item.answerTokens.slice().sort());
    expect(item.tokens).not.toEqual(item.answerTokens);
  });
});
```

`tests/session.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scoreOf } from '@/lib/session';
import type { AnswerLog } from '@/lib/session';

const log = (type: 'word' | 'blank', ok: boolean): AnswerLog =>
  ({ type, itemId: 'x', correctOnFirstTry: ok });

describe('scoreOf', () => {
  it('rounds percentage of first-try corrects per type', () => {
    const logs = [log('word', true), log('word', true), log('word', false), log('blank', false)];
    expect(scoreOf(logs, 'word')).toBe(67);
    expect(scoreOf(logs, 'blank')).toBe(0);
  });
  it('returns 100 when no items of that type', () => {
    expect(scoreOf([], 'arrange')).toBe(100);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/quiz.test.ts tests/session.test.ts` / Expected: FAIL

- [ ] **Step 3: 구현**

`lib/quiz.ts`:

```ts
import type { Word, Sentence } from './types';

export interface Choice { text: string; correct: boolean; }
export interface WordQuizItem  { type: 'word';    itemId: string; word: Word; choices: Choice[]; }
export interface BlankQuizItem { type: 'blank';   itemId: string; sentence: Sentence; blankedText: string; choices: Choice[]; }
export interface ArrangeQuizItem { type: 'arrange'; itemId: string; sentence: Sentence; tokens: string[]; answerTokens: string[]; }
export type QuizItem = WordQuizItem | BlankQuizItem | ArrangeQuizItem;

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildWordQuiz(words: Word[], pool: Word[], rng: () => number = Math.random): WordQuizItem[] {
  return words.map(word => {
    const sameDay = words.filter(w => w.id !== word.id && w.meaning !== word.meaning);
    const others = pool.filter(w =>
      w.id !== word.id && w.meaning !== word.meaning && !sameDay.some(s => s.id === w.id));
    const candidates = [...shuffle(sameDay, rng), ...shuffle(others, rng)];
    const distractors: string[] = [];
    for (const c of candidates) {
      if (distractors.length === 3) break;
      if (!distractors.includes(c.meaning)) distractors.push(c.meaning);
    }
    const choices = shuffle(
      [{ text: word.meaning, correct: true }, ...distractors.map(text => ({ text, correct: false }))],
      rng,
    );
    return { type: 'word' as const, itemId: word.id, word, choices };
  });
}

export function buildBlankQuiz(sentences: Sentence[], rng: () => number = Math.random): BlankQuizItem[] {
  return sentences.map(sentence => {
    const re = new RegExp(`\\b${sentence.blankWord}\\b`);
    const blankedText = sentence.text.replace(re, '____');
    const choices = shuffle(
      [{ text: sentence.blankWord, correct: true },
       ...sentence.distractors.map(text => ({ text, correct: false }))],
      rng,
    );
    return { type: 'blank' as const, itemId: sentence.id, sentence, blankedText, choices };
  });
}

export function buildArrangeQuiz(sentences: Sentence[], rng: () => number = Math.random): ArrangeQuizItem[] {
  return sentences.map(sentence => {
    const answerTokens = sentence.text.split(/\s+/);
    let tokens = shuffle(answerTokens, rng);
    if (answerTokens.length > 1) {
      while (tokens.join(' ') === answerTokens.join(' ')) tokens = shuffle(answerTokens, rng);
    }
    return { type: 'arrange' as const, itemId: sentence.id, sentence, tokens, answerTokens };
  });
}
```

주의: `fixedRng`처럼 상수를 돌려주는 rng로도 `while` 재셔플이 무한 루프에 빠지지 않는지 확인할 것 — 상수 rng의 Fisher–Yates 결과는 결정적이므로, 만약 정답 순서와 같게 나오면 무한 루프가 된다. 테스트가 그런 rng·입력 조합이면 rng를 카운터 기반(`let i = 0; () => (i++ % 10) / 10`)으로 바꾼다.

`lib/session.ts`:

```ts
import type { QuizType } from './types';

export interface AnswerLog { type: QuizType; itemId: string; correctOnFirstTry: boolean; }

export function scoreOf(logs: AnswerLog[], type: QuizType): number {
  const of = logs.filter(l => l.type === type);
  if (of.length === 0) return 100;
  return Math.round((of.filter(l => l.correctOnFirstTry).length / of.length) * 100);
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: 전체 PASS
- [ ] **Step 5: 커밋**

```bash
git add lib/quiz.ts lib/session.ts tests/quiz.test.ts tests/session.test.ts
git commit -m "feat: add quiz builders and session scoring logic"
```

---

### Task 7: 공용 컴포넌트 (달력·문항 UI)

**Files:**
- Create: `components/MonthCalendar.tsx`, `components/QuizCard.tsx`, `components/ArrangeCard.tsx`, `components/WordBrowse.tsx`

**Interfaces:**
- Consumes: `Choice`(Task 6), `Word`(Task 2), `monthGrid`(Task 2)
- Produces (모두 `'use client'` 컴포넌트):

```ts
// MonthCalendar.tsx
interface MonthCalendarProps {
  year: number; month: number;      // month: 1~12
  contentDates: Set<string>;        // 콘텐츠 있는 날짜
  doneDates: Set<string>;           // 완료한 날짜
  today: string;
  onSelect?: (date: string) => void;
  compact?: boolean;                // 홈 미니 달력용 (작은 셀, 범례 없음)
}
// QuizCard.tsx — 단어 퀴즈·문장 빈칸 공용 4지선다
interface QuizCardProps {
  prompt: string;                   // 단어 또는 빈칸 문장
  subPrompt?: string;               // 품사 등 보조 표시
  choices: Choice[];
  onNext: (correct: boolean) => void;
}
// ArrangeCard.tsx — 문장 조합
interface ArrangeCardProps {
  ko: string;                       // 한글 해석 (프롬프트)
  tokens: string[];                 // 섞인 칩
  answerTokens: string[];
  onNext: (correct: boolean) => void;
}
// WordBrowse.tsx — 단어 훑기
interface WordBrowseProps { words: Word[]; onDone: () => void; }
```

동작 규칙 (타이머 없이 버튼으로만 진행):
- **QuizCard**: 보기 클릭 → 즉시 잠금, 정답 보기 초록·내가 고른 오답 빨강 표시 → "다음" 버튼 표시 → 클릭 시 `onNext(correct)`. `key` 변경으로 문항 전환 시 상태 초기화 (부모가 `key={itemId}` 부여).
- **ArrangeCard**: 상단에 `ko` 표시. 하단 칩 클릭 → 답 영역에 순서대로 추가(원래 칩은 비활성), 답 영역 칩 클릭 → 제거·복원. 칩을 모두 배치하면 "확인" 활성 → `join(' ')`으로 정답 비교, 맞으면 초록, 틀리면 빨강 + 정답 문장 표시 → "다음" → `onNext(correct)`.
- **WordBrowse**: 카드 1장씩 (word·pos·meaning·example·exampleKo), 이전/다음 버튼과 진행 표시(`3 / 10`), 마지막 카드에서 "퀴즈 시작" 버튼 → `onDone()`.
- **MonthCalendar**: `monthGrid(year, month)`로 그리드 생성. 셀 상태 — 콘텐츠 없음: 회색 비활성 / 완료: 초록 채움 / 콘텐츠 있고 과거 미완료: 주황 테두리(놓친 날) / 오늘 미완료: 파랑 강조 / 미래: 연회색 + 클릭 불가. 클릭 가능 조건: `contentDates.has(date) && date <= today`일 때만 `onSelect(date)`.

- [ ] **Step 1: frontend-design 스킬 로드 후 4개 컴포넌트 구현** — 위 props·동작 규칙대로. 스타일은 Tailwind, 카드형(rounded-2xl, 넉넉한 패딩), 몰입형 세션에 어울리는 큰 터치 타깃(보기 버튼 min-h-14, 전체 폭)
- [ ] **Step 2: 타입 확인** — Run: `npx tsc --noEmit` / Expected: 오류 없음
- [ ] **Step 3: 커밋**

```bash
git add components
git commit -m "feat: add calendar and quiz UI components"
```

---

### Task 8: 학습 세션 + 결과 화면

**Files:**
- Create: `components/SessionRunner.tsx`, `app/learn/[date]/page.tsx`, `app/learn/[date]/result/page.tsx`

**Interfaces:**
- Consumes: Task 5 레포지토리, Task 6 빌더·`scoreOf`, Task 7 컴포넌트
- Produces: 결과 전달용 sessionStorage 키 `ddt.lastResult`:

```ts
interface LastResult {
  date: string;
  scores: { word: number; blank: number; arrange: number };
  wrongs: { type: QuizType; itemId: string; label: string }[]; // label: 단어 또는 문장 원문
}
```

- [ ] **Step 1: SessionRunner 구현** — 핵심 상태 기계:

```tsx
'use client';
// props: { day: DayContent }
type Phase = 'browse' | 'quiz' | 'retry' | 'done';

// 초기화 (useState 초기값): 문항 20개 = 단어 10 + 빈칸 5 + 조합 5
const [items] = useState<QuizItem[]>(() => [
  ...buildWordQuiz(day.words, day.words),
  ...buildBlankQuiz(day.sentences),
  ...buildArrangeQuiz(day.sentences),
]);
const [phase, setPhase] = useState<Phase>('browse');
const [idx, setIdx] = useState(0);
const [logs, setLogs] = useState<AnswerLog[]>([]);
const [retryQueue, setRetryQueue] = useState<QuizItem[]>([]);

function handleAnswer(correct: boolean) {
  const item = (phase === 'quiz' ? items : retryQueue)[idx];
  if (phase === 'quiz') {
    setLogs(l => [...l, { type: item.type, itemId: item.itemId, correctOnFirstTry: correct }]);
    if (!correct) setRetryQueue(q => [...q, item]);
    if (idx + 1 < items.length) setIdx(idx + 1);
    else if (retryQueue.length + (correct ? 0 : 1) > 0) { setPhase('retry'); setIdx(0); }
    else finish();
  } else { // retry: 기록하지 않음
    if (idx + 1 < retryQueue.length) setIdx(idx + 1);
    else finish();
  }
}

function finish() {
  const scores = {
    word: scoreOf(logs, 'word'), blank: scoreOf(logs, 'blank'), arrange: scoreOf(logs, 'arrange'),
  };
  saveDayRecord({ date: day.date, completedAt: new Date().toISOString(), scores });
  const wrongs = logs.filter(l => !l.correctOnFirstTry);
  wrongs.forEach(l => addWrongNote({ type: l.type, itemId: l.itemId, date: day.date }));
  sessionStorage.setItem('ddt.lastResult', JSON.stringify({
    date: day.date, scores,
    wrongs: wrongs.map(l => ({ ...l, label: labelOf(l) })), // labelOf: itemId로 day에서 단어/문장 원문 찾기
  }));
  router.push(`/learn/${day.date}/result`);
}
```

주의: `finish()`가 `logs` state를 읽으므로 마지막 문항의 로그가 반영된 뒤 호출되도록 `handleAnswer`에서 지역 변수로 최신 로그 배열을 만들어 `setLogs`와 `finish` 계산에 같이 쓴다 (stale state 버그 방지).

렌더: 상단 진행바(`(현재 문항 순번) / (전체)`) + 나가기 버튼(`/`로 이동, confirm 없이). phase별로 `WordBrowse` → `QuizCard`/`ArrangeCard`(item.type에 따라, `key={item.itemId + phase}`) 표시. retry 진입 시 "틀린 문제 다시 풀기" 안내 화면 1장.

- [ ] **Step 2: 세션 페이지** — `app/learn/[date]/page.tsx` (client): `useParams()`로 date, `fetchDay(date)` → 로딩 중 스피너, `null`이면 "이 날은 콘텐츠가 없어요" + 달력으로 가기 링크, 있으면 `<SessionRunner day={day} />`
- [ ] **Step 3: 결과 페이지** — `app/learn/[date]/result/page.tsx` (client): sessionStorage `ddt.lastResult` 파싱. 없으면 홈 링크만. 있으면 종합 정답률(세 scores 평균 반올림), 유형별 점수, 틀린 문항 목록(label 표시, "오답노트에 저장됨" 안내), 버튼: 홈으로 / 다시 학습
- [ ] **Step 4: 수동 확인** — `npm run dev` 후 `/learn/2026-08-04` 진입 → 훑기 20문항 → 일부러 몇 개 틀리기 → 재도전 → 결과 페이지 → localStorage에 dayRecords·wrongNotes 저장 확인 (DevTools). `/learn/2026-01-01` → 콘텐츠 없음 안내 확인
- [ ] **Step 5: 커밋**

```bash
git add components/SessionRunner.tsx app/learn
git commit -m "feat: add learning session flow with retry and result page"
```

---

### Task 9: 홈 + 달력 페이지

**Files:**
- Create: `app/calendar/page.tsx`
- Modify: `app/page.tsx` (스캐폴드 기본 페이지 교체)

**Interfaces:**
- Consumes: `fetchIndex`, `getDayRecords`, `calcStreak`, `MonthCalendar`, `todayStr`

- [ ] **Step 1: 홈 구현** — `app/page.tsx` (client). 로드 시 `fetchIndex()` + `getDayRecords()`. 구성:
  - **오늘 카드**: 오늘 콘텐츠 있음 & 미완료 → title + "학습 시작" 버튼(`/learn/{today}`) / 완료 → 점수 요약 + "다시 학습" / 오늘 콘텐츠 없음 → "오늘 콘텐츠가 없어요" + 가장 최근 미완료 날짜(인덱스에서 `date <= today`이고 record 없는 것 중 최신) 안내 카드
  - **스트릭**: `calcStreak(records, today)` — "🔥 N일 연속"과 누적 완료일 수
  - **미니 달력**: 이번 달 `MonthCalendar compact`, 날짜 클릭 → `/learn/{date}`
- [ ] **Step 2: 달력 페이지 구현** — `app/calendar/page.tsx` (client). 연·월 state(초기값 오늘 기준), ◀ ▶로 이동, `MonthCalendar` 풀사이즈 + 범례(완료/놓침/오늘/콘텐츠 없음), 클릭 → `/learn/{date}`
- [ ] **Step 3: 수동 확인** — 홈에서 오늘(시드 범위 내) 카드·스트릭 표시, 달력에서 완료한 날 초록 표시, 과거 미완료 주황, 미래 클릭 불가 확인
- [ ] **Step 4: 커밋**

```bash
git add app/page.tsx app/calendar
git commit -m "feat: add home and calendar pages"
```

---

### Task 10: 복습 시험 + 오답노트

**Files:**
- Create: `app/review/page.tsx`, `app/notes/page.tsx`

**Interfaces:**
- Consumes: 레포지토리 전부, `buildWordQuiz`/`buildBlankQuiz`, `QuizCard`, `shuffle`
- Produces: 없음 (말단 화면)

- [ ] **Step 1: 복습 문항 생성 로직** — `app/review/page.tsx` 내부 함수로 구현 (별도 파일 불필요):

```ts
// scope: 'recent7' | 'all' | 'wrong'
// 1) 완료한 날짜 목록 = getDayRecords()의 키 ∩ index. recent7이면 addDays(today,-6)~today로 필터
// 2) 해당 날짜들 fetchDay → words/sentences 풀 구성
// 3) scope='wrong'이면 getWrongNotes()의 (type,itemId)에 해당하는 항목만 풀에 남김
// 4) 문항 = [...buildWordQuiz(포함 단어, 전체 단어 풀), ...buildBlankQuiz(포함 문장)] 셔플 후 앞 20개
//    (20개 미만이면 있는 만큼. 조합(arrange) 문항은 복습에 내지 않음 — 스펙 8장: 단어·빈칸 혼합)
```

- [ ] **Step 2: 복습 화면 구현** — 3단계 UI: (a) 범위 선택 카드 3개 — 각 카드에 예상 문항 수 표시, 풀이 비면 비활성 / (b) 진행 — `QuizCard` 재사용, 진행바 / (c) 결과 — 정답률, 틀린 문항 목록. 종료 시 `addReviewRecord({takenAt, scope, correct, total})`, 틀린 문항 `addWrongNote`, **wrong 스코프에서 맞힌 문항은 `resolveWrongNote`**
- [ ] **Step 3: 오답노트 구현** — `app/notes/page.tsx`: `getWrongNotes()` 목록 표시. 각 항목: 단어(word+meaning) 또는 문장(text) — note.date로 `fetchDay`해서 itemId로 찾음(같은 날짜는 한 번만 fetch, 콘텐츠에서 못 찾은 항목은 "삭제된 콘텐츠"로 표시하고 제거 버튼 제공), 유형·틀린 횟수·날짜 표시. "다시 풀기" 버튼 → 해당 항목들로 QuizCard 진행(단어→뜻 4지선다 또는 빈칸), 맞히면 `resolveWrongNote` + "오답노트에서 제거됨" 피드백, 틀리면 `addWrongNote`(횟수 증가). 비어 있으면 "오답이 없어요 🎉"
- [ ] **Step 4: 수동 확인** — 세션에서 만든 오답이 노트에 보이고, 다시 풀어 맞히면 사라지는지. 복습 3개 스코프 각각 진행·결과 저장 확인
- [ ] **Step 5: 커밋**

```bash
git add app/review app/notes
git commit -m "feat: add review test and wrong-answer notes"
```

---

### Task 11: 통계 페이지 + 최종 검증

**Files:**
- Create: `app/stats/page.tsx`
- Modify: `README.md` (실행 방법·데이터 추가 방법 문서화)

**Interfaces:**
- Consumes: `getDayRecords`, `getReviewRecords`, `calcStreak`, `fetchIndex`, `fetchDay`

- [ ] **Step 1: 통계 구현** — (막대 등 차트를 그리게 되면 dataviz 스킬 로드) 구성:
  - 상단 요약 타일 3개: 🔥 스트릭 / 완료일 수 / 누적 학습 단어 수(완료한 각 날짜의 `words.length` 합 — 완료 날짜들 fetchDay로 합산)
  - 날짜별 정답률 목록: 최근 완료일부터, 날짜·title·유형별 점수·종합(평균). CSS 너비 막대(`div` width %)로 표시
  - 복습 기록: `getReviewRecords()` 최신순 — 일시·범위·점수
- [ ] **Step 2: README 갱신** — 실행(`npm install && npm run dev`), 테스트, 데이터 추가 방법(스키마 요약 + `npm run validate-data`) 문서화
- [ ] **Step 3: 전체 검증** — Run: `npm test && npm run validate-data && npm run build` / Expected: 모두 성공
- [ ] **Step 4: 수동 QA 체크리스트** — dev 서버에서:
  - 홈 → 오늘 학습 시작 → 세션 완주 → 결과 → 홈에 완료 반영
  - 달력에서 과거 날짜 학습, 미래 날짜 클릭 불가
  - 완료한 날짜 재학습 시 기록 덮어씀
  - 복습 3개 스코프, 오답노트 해결 흐름
  - localStorage 비우고 새로고침 → 빈 진도로 정상 동작
- [ ] **Step 5: 커밋**

```bash
git add app/stats README.md
git commit -m "feat: add stats page and finalize v1"
```
