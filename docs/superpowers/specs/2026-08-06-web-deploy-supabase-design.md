# day-by-day TOEIC — 웹 배포 + Supabase 전환 설계

- 작성일: 2026-08-06
- 상태: 사용자 승인 완료 (구현 전)
- 선행 스펙: `2026-08-06-word-game-srs-design.md` (간격 반복 게임, 구현 완료)
- 이 문서는 같은 파일의 이전 판(콘텐츠를 DB로 옮기지 않는 안)을 대체한다. 사유는 4장 첫 문단에 적었다.

## 1. 목표

지금 앱은 로컬에서만 돌고, 기록은 브라우저에 갇혀 있고, 콘텐츠는 레포에 커밋된 14일치 JSON에 고정되어 있다. 이 셋을 모두 Supabase로 옮긴다.

인증·DB는 **기존 OURFLIX 프로젝트(`~/Desktop/proposs`)의 Supabase를 공유한다.** OURFLIX는 이미 같은 스택(Next.js 16 / React 19 / Supabase / Vercel)이고 카카오·구글 로그인이 동작하므로 인증을 새로 만들 이유가 없다.

## 2. 범위

**이번 범위**
1. 콘텐츠를 DB로 (단어·문장 테이블 + 매일 넣는 입력 스크립트)
2. 진도를 DB로 (카드·졸업·세션 테이블 + RLS)
3. 카카오 로그인 (OURFLIX의 Supabase 인증 재사용)
4. Vercel 배포

**다음 스펙으로 미룸**
5. 공유 — 링크로 내 진도(연속 학습, 졸업한 단어 수)를 보여주기. 방향만 확정했고 이 스펙의 스키마에 추가 부담은 없다. 없어도 앱이 성립하므로 뒤로 뺀다.

## 3. 로그인은 선택이다

**접속하면 로그인 없이 바로 게임이 시작된다.** 이전 스펙에서 사용자가 명시적으로 요구한 것이고 여기서 깨지 않는다.

- 콘텐츠는 로그인과 무관하게 누구나 읽는다 (anon 읽기 허용)
- 로그인 전: 진도는 localStorage에만 기록한다
- 게임 화면에 "기기 바꿔도 이어서 하기" 버튼 → 카카오 로그인 → 로컬 기록을 서버로 이전
- 로그인 후: 서버가 진도의 원본이 되고 localStorage는 낙관적 캐시가 된다

## 4. 콘텐츠를 DB로

이전 판에서는 "콘텐츠는 읽기 전용이고 사용자별로 다르지 않으니 DB에 넣을 이유가 없다"고 판단했다. **그 판단은 콘텐츠가 고정 14일치라는 전제에서만 옳았다.** 사용자가 매일 Claude로 콘텐츠를 생성해 쌓겠다고 했으므로, 정적 JSON은 매일 커밋과 재배포를 요구하게 된다. DB가 맞다.

### 4.1 테이블

```sql
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
```

`item_id`를 텍스트 기본키로 둔다 (`w-negotiate`, `s-0804-1`). 이미 쌓인 학습 기록의 카드 신원 규칙 `(type, item_id)`가 그대로 유지되므로, 콘텐츠를 옮겨도 진도가 살아 있다.

`toeic_sets.seq`가 묶음의 도입 순서다. 입력 스크립트가 `max(seq) + 1`을 부여한다.

### 4.2 읽기 정책 — 읽기만 허용, 쓰기 정책은 만들지 않는다

```sql
alter table toeic_sets enable row level security;
drop policy if exists "content readable by all" on toeic_sets;
create policy "content readable by all" on toeic_sets for select using (true);
```

`toeic_words`, `toeic_sentences`도 동일하게 만든다.

**INSERT / UPDATE / DELETE 정책은 의도적으로 만들지 않는다.** RLS가 켜져 있고 해당 정책이 없으면 anon key로는 쓸 수 없고, `service_role` 키만 RLS를 우회한다. 그래서 입력 스크립트 외에는 아무도 문제를 바꿀 수 없다.

### 4.3 새 항목이 나오는 순서

`toeic_sets.seq` 오름차순 → 묶음 안에서 `toeic_words.seq` 순으로 단어 → `toeic_sentences.seq` 순으로 빈칸 → 같은 문장들을 조합으로. **현재 파일 순서 동작과 동일하다.**

### 4.4 `contentRepo` 교체

`fetchIndex()` + 날짜별 `fetchDay()` 14회를 **쿼리 3개**로 대체한다. 인터페이스가 바뀌므로 `lib/contentRepo.ts`를 다시 쓴다.

```ts
export interface ContentBundle {
  words: Word[];        // 도입 순서로 정렬됨
  sentences: Sentence[];  // 도입 순서로 정렬됨
}
export async function fetchContent(): Promise<ContentBundle | null>;  // 실패하면 null
```

전체를 한 번에 가져오는 이유: `buildQueue`가 전체 후보 목록을, `buildWordQuiz`가 전체 단어 풀을 요구한다. 단어 1,000개 수준까지는 한 번에 가져와도 가볍다. 그 이상 쌓이면 나눠 가져오는 것을 그때 설계한다 — **지금 미리 만들지 않는다.**

후보 목록(`CardIdentity[]`)은 화면에서 이 번들로부터 만든다: 단어 순서대로 `word` 항목, 이어서 문장 순서대로 `blank`, 그다음 같은 순서로 `arrange`.

### 4.5 입력 스크립트

```
npm run ingest -- <파일경로>
```

입력 JSON의 형태는 현재 day 파일과 같되 `date`가 `title`만 남는다:

```json
{
  "title": "Day 15 — 계약 갱신",
  "words": [ { "id": "w-renew", "word": "renew", "pos": "v.", "meaning": "갱신하다",
               "example": "...", "exampleKo": "..." } ],
  "sentences": [ { "id": "s-0815-1", "text": "...", "ko": "...",
                   "blankWord": "renew", "distractors": ["...","...","..."] } ]
}
```

스크립트가 하는 일:

1. **검증** — 통과하지 못하면 아무것도 넣지 않고 종료한다
   - 필수 필드 존재
   - `blankWord`가 `text`에 정확히 한 번, 공백 기준 독립 토큰으로, 대소문자 일치, **문장 첫 단어가 아님**
   - `distractors` 정확히 3개
   - `id` 중복 — 입력 파일 안에서, 그리고 **DB에 이미 있는 것과** 비교한다
   - 분량은 자유. 단어가 1개 이상이면 통과한다 (문장은 0개도 허용)
2. **삽입** — `toeic_sets`에 `seq = max+1`로 한 줄, 그다음 단어·문장을 넣는다
3. 항목 삽입이 실패하면 방금 만든 묶음을 지우려 시도하고 실패를 보고한다. 이게 실패해도 **항목 없는 빈 묶음은 무해하다** — 후보를 하나도 만들지 않으므로 앱 동작에 영향이 없다

`service_role` 키를 쓰므로 **이 스크립트는 Node에서만 실행되고 브라우저 코드에서 절대 import되지 않는다.** 키는 `.env.local`의 `SUPABASE_SERVICE_ROLE_KEY`에 두고 git에 올리지 않는다 (`NEXT_PUBLIC_` 접두사가 없으므로 Next.js 클라이언트 번들에 포함되지 않는다).

입력 JSON 파일은 레포에 커밋하지 않는다. 임의 경로에서 읽는다.

정답·오답의 **품질** 규칙 — 오답이 빈칸에 넣어도 말이 되면 안 되고, 그렇다고 한눈에 걸러질 단어여도 안 되며, 문장은 어순이 하나만 성립해야 한다 — 은 스크립트가 검사할 수 없다. README에 남겨서 Claude가 생성할 때 따르게 한다. 이 규칙들은 v1 리뷰에서 실제 결함으로 확인된 것들이다.

### 4.6 기존 14일치 이전과 정리

1. 입력 스크립트로 `public/data/days/*.json` 14개를 날짜 순서대로 넣는다 (`title`은 각 파일의 것을 쓴다)
2. 앱이 DB에서 읽어 정상 동작하는 것을 확인한다
3. **확인된 뒤 `public/data/`와 `scripts/validate-data.mjs`를 삭제한다.** 앱이 더 읽지 않는 파일을 남기면 죽은 코드가 된다. 검증 규칙은 입력 스크립트로 옮겨졌다

## 5. `sourceDate` 제거

`SrsCard`와 `CardIdentity`의 `sourceDate`, 그리고 진도 테이블의 `source_date`를 **없앤다.**

이 필드는 "이 항목이 몇 일차 **파일**에 있나"를 가리키는 콘텐츠 포인터였다. 콘텐츠가 DB로 가면 `item_id`로 직접 조회하므로 존재 이유가 사라진다. 남기면 의미 없는 필드가 된다.

영향: `lib/srs.ts`, `lib/queue.ts`, `lib/srsRepo.ts`와 그 테스트들. 선행 스펙에서 "변경 금지"로 묶어둔 파일이지만, 필드 하나를 빼는 수준의 변경이다. 스케줄링 규칙(box 전이, 간격) 자체는 건드리지 않는다.

## 6. 진도 테이블

OURFLIX와 같은 Supabase 프로젝트, `public` 스키마, `toeic_` 접두사.

```sql
create table if not exists toeic_cards (
  user_id    uuid not null references auth.users(id) on delete cascade,
  item_id    text not null,
  type       text not null check (type in ('word','blank','arrange')),
  box        smallint not null check (box between 0 and 3),
  due_date   date not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, type, item_id)
);

create table if not exists toeic_mastered (
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_id     text not null,
  type        text not null check (type in ('word','blank','arrange')),
  mastered_at timestamptz not null,
  primary key (user_id, type, item_id)
);

create table if not exists toeic_sessions (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  finished_at  timestamptz not null,
  session_date date not null,
  correct      smallint not null,
  total        smallint not null
);

create index if not exists toeic_cards_due on toeic_cards (user_id, due_date);
create index if not exists toeic_sessions_user_date on toeic_sessions (user_id, session_date desc);
```

`(user_id, type, item_id)` 복합 기본키가 앱의 카드 신원 규칙과 일치한다 — 한 문장이 `blank`·`arrange` 두 카드를 갖는 구조가 그대로 유지된다.

진도 테이블은 자기 행만 읽고 쓴다:

```sql
alter table toeic_cards enable row level security;
drop policy if exists "own toeic cards" on toeic_cards;
create policy "own toeic cards" on toeic_cards
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

`toeic_mastered`, `toeic_sessions`도 같은 형태로 만든다.

**RLS 확인은 마이그레이션 실행 후 필수다.** anon key는 브라우저에 그대로 노출되므로 RLS가 유일한 방어선이다. 진도 테이블에서 이걸 빠뜨리면 남의 학습 기록을 읽을 수 있다. 여섯 테이블 모두 `enable row level security`가 적용됐는지 확인한다.

## 7. 저장 아키텍처 — 서버가 원본, 실패하면 대기열

### 7.1 커밋의 모양

**스케줄링 계산은 전부 클라이언트에 남는다.** 서버는 계산하지 않고 저장만 한다. 한 판이 끝나면 클라이언트가 지금처럼 다음 카드 상태를 계산하고, 그 **결과 행들을 upsert**한다:

- 영향받은 카드를 `toeic_cards`에 upsert (졸업한 카드는 delete)
- 졸업 항목을 `toeic_mastered`에 upsert
- 세션 하나를 `toeic_sessions`에 insert

서버가 `nextState`를 다시 계산하지 않으므로 재전송이 안전하다 — 같은 결과 행을 다시 upsert하는 것은 멱등에 가깝다. 세션 insert만 중복될 수 있어, 대기열 항목에 클라이언트 생성 UUID를 실어 `toeic_sessions`에 `client_id text unique` 컬럼으로 중복을 막는다.

```sql
alter table toeic_sessions add column if not exists client_id text;
create unique index if not exists toeic_sessions_client on toeic_sessions (client_id) where client_id is not null;
```

### 7.2 실패하면 대기열에 쌓는다

- localStorage 키 `ddt.pending`에 커밋 페이로드 **배열**을 쌓는다. 오프라인에서 여러 판을 연달아 끝낼 수 있으므로 한 칸이 아니라 배열이어야 한다
- 커밋이 실패하면 페이로드를 대기열에 넣고 **로컬 카드 상태는 낙관적으로 갱신한다.** 그래서 연결이 없어도 계속 공부할 수 있고 다음 판의 큐가 올바르게 구성된다
- 다음 접속 시 로그인되어 있고 대기열이 비어 있지 않으면 **순서대로 재전송**하고, 성공한 것만 대기열에서 지운다
- 재전송이 또 실패하면 그대로 두고 조용히 넘어간다 — 학습을 막지 않는다

### 7.3 읽기

로그인 상태로 앱을 열면 서버에서 카드·졸업·세션을 읽어 localStorage에 써넣고, 이후의 읽기는 로컬에서 한다. 대기열이 남아 있으면 재전송을 먼저 시도하고 그 결과를 반영한 뒤 화면을 그린다.

## 8. 로그인 시 기록 이전

**규칙: 합집합, 충돌하면 서버가 이긴다.**

- 서버에 없고 로컬에만 있는 카드 → 서버에 추가한다
- 양쪽에 있는 카드 → 서버 행을 유지한다 (계정 기록이 권위를 갖는다)
- 졸업 항목도 같은 규칙. 세션은 서버에 없는 것만 추가한다

이 규칙을 고른 이유: 기기 간 시계 차이에 의존하지 않고, 로컬에만 존재하는 학습을 잃지 않으며, 한 문장으로 설명된다. 첫 로그인(서버가 비어 있음)에서는 로컬 기록이 통째로 올라가므로 가장 흔한 경우에 손실이 없다.

이전은 로그인 직후 한 번 실행하고 결과를 알린다 ("N개 항목을 계정에 저장했어요").

## 9. 코드 변경

### 9.1 `lib/srsRepo.ts` — 비동기로 전환

함수 이름과 의미는 유지하고 반환 타입만 `Promise`로 바꾼다. 호출 지점 넷 중 셋은 이미 비동기 문맥이라 `await`만 붙이면 된다 (`app/page.tsx` 로더, `app/vocab/page.tsx`, `app/stats/page.tsx`).

네 번째가 문제다. `components/GameRunner.tsx`가 클릭 핸들러에서 커밋하고 **즉시 다시 읽어** "내일 볼 단어" 수를 계산한다.

### 9.2 `GameRunner`에 '저장 중' 단계

`Phase`에 `'committing'`을 추가한다. 마지막 문항에 답하면:

1. `'committing'`으로 전환하고 스피너를 보여준다
2. 커밋을 `await`한다
3. 성공하면 결과 화면으로 간다
4. 실패하면 대기열에 넣고, **결과 화면은 그대로 보여주면서** "기록은 나중에 저장할게요"를 덧붙인다

학습 결과를 못 보여주는 일은 없어야 한다. 저장 실패는 알림이지 차단이 아니다.

### 9.3 새 파일 / 다시 쓰는 파일

| 파일 | 내용 |
|---|---|
| `lib/supabase.ts` | 브라우저용 클라이언트 (`@supabase/ssr`) |
| `lib/contentRepo.ts` | **다시 씀** — DB에서 콘텐츠 조회 (4.4) |
| `lib/remoteSrs.ts` | 서버 읽기/쓰기, 대기열 재전송 |
| `lib/migrateLocal.ts` | 8장의 이전 규칙 |
| `lib/srsRepo.ts` | **수정** — 로그인 여부로 로컬/서버를 고르는 얇은 층 |
| `scripts/ingest.mjs` | 콘텐츠 입력 (4.5) |
| `app/auth/callback/route.ts` | OAuth 콜백 (OURFLIX의 같은 파일 참고) |

화면은 여전히 `contentRepo`와 `srsRepo`만 바라본다 — 이 경계는 유지된다.

### 9.4 삭제

`public/data/`, `scripts/validate-data.mjs` — 4.6의 확인 후.

### 9.5 스케줄링 규칙은 그대로

`lib/srs.ts`의 box 전이와 간격(1/3/7/14, 졸업), `lib/queue.ts`의 복습 우선 + 20문항 상한은 변경하지 않는다. `sourceDate` 필드 제거만 반영한다.

## 10. 마이그레이션의 소유권과 실행

**SQL은 OURFLIX 레포(`~/Desktop/proposs/supabase/migrations/`)에 새 번호로 추가한다.** 그 레포가 이 Supabase 프로젝트의 스키마를 소유하므로, 한 DB의 스키마 이력이 레포 두 곳으로 갈라지지 않게 한다. 이 TOEIC 레포에는 `supabase/` 디렉토리를 만들지 않는다.

이건 이 스펙에서 **OURFLIX 레포를 수정하는 유일한 지점**이다. 기존 마이그레이션 파일은 건드리지 않고 새 파일만 추가한다.

**실행은 사용자가 직접 한다.** Supabase 대시보드 SQL 에디터 또는 OURFLIX의 기존 `scripts/run-migration.ts`. 마이그레이션은 재실행 가능하게 쓴다 (`create table if not exists`, 정책은 `drop policy if exists` 후 `create` — OURFLIX의 `001_schema.sql` 방식과 동일).

## 11. 배포

- Vercel에 **별도 프로젝트**로 배포한다 (같은 Supabase를 쓰지만 앱은 별개다)
- 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — OURFLIX와 같은 값. `SUPABASE_SERVICE_ROLE_KEY`는 **Vercel에 넣지 않는다** (입력 스크립트는 로컬에서만 돈다)
- Supabase 대시보드 Auth → URL Configuration에 새 배포 도메인을 리다이렉트 URL로 **추가**한다. OURFLIX와 공유하는 설정을 건드리는 유일한 지점이므로 기존 URL을 지우지 않는다
- 카카오 개발자 콘솔은 Supabase가 중개하므로 별도 설정이 필요 없다

## 12. 엣지 케이스

- **콘텐츠 조회 실패** → 문항을 만들 수 없다. 한국어 오류 화면과 재시도 버튼을 보여준다. "오늘 할 게 없어요"로 표시하지 않는다 — 그건 거짓이다
- **콘텐츠가 비어 있음(DB에 묶음 0개)** → 오류가 아니라 "아직 학습할 내용이 없어요"로 구분해 표시한다
- **로그인 안 한 상태** → 콘텐츠는 읽고, 진도는 localStorage에만. 진도 관련 서버 호출 없음
- **로그인했지만 오프라인** → 콘텐츠 조회가 실패하면 위 오류 화면. 진도 커밋은 대기열에 쌓인다
- **로그아웃** → 서버 기록은 남기고 로컬 캐시를 비운다. 다시 로그인하면 서버에서 받아온다
- **두 기기 동시 사용** → 카드별 마지막 쓰기가 이긴다. 혼자 쓰는 앱에서 위험이 낮아 받아들인다. 세션은 `client_id`로 중복만 막는다
- **대기열 재전송이 계속 실패** → 대기열을 유지하고 `/stats`에 "저장 대기 중 N판"을 표시한다
- **DB에서 삭제된 항목의 카드를 들고 있음** → `/vocab`에 "삭제된 콘텐츠"로 표시하고 제거 버튼을 준다. 후보 생성에서는 제외되므로 출제되지 않는다
- **입력 스크립트가 중복 `item_id`를 만나면** → 아무것도 넣지 않고 어느 id가 충돌했는지 보고한다

## 13. 테스트

- `lib/migrateLocal.ts` — 8장 규칙: 로컬만 있는 카드가 올라가는지, 충돌 시 서버가 이기는지, 서버가 비어 있을 때 전부 올라가는지
- 대기열 재전송 — 순서 유지, 성공한 것만 제거, 실패 시 보존
- `srsRepo` 로그인/비로그인 분기
- `scripts/ingest.mjs`의 검증 로직 — 현재 `validate-data.mjs` 테스트에 준하는 수준으로. blankWord 규칙, distractors 개수, 중복 id
- 콘텐츠 번들에서 후보 목록을 만드는 순서 로직
- Supabase 호출은 모킹한다. 실제 네트워크를 타는 테스트는 두지 않는다
- `lib/srs.ts`, `lib/queue.ts`의 기존 테스트는 `sourceDate` 제거만 반영하고 나머지는 유지한다
- 화면은 수동 확인. **카카오 OAuth 왕복은 사용자만 검증할 수 있다** — 구현자는 Supabase에 만든 테스트 계정으로 로그인 이후 흐름을 검증하고, 카카오 버튼 자체의 왕복은 사용자 확인으로 남긴다

## 14. 이번 범위 아님

- 공유 (2장) — 다음 스펙
- 구글 로그인 — 카카오만. OURFLIX에 이미 있으므로 나중에 한 줄로 추가 가능
- 서버 사이드 스케줄링 — 계산은 클라이언트에 남는다
- 실시간 동기화, 오프라인 큐의 일반화된 병합
- 콘텐츠를 나눠 가져오기(페이지네이션) — 단어 1,000개를 넘길 때 다시 본다
- 웹 관리자 입력 화면 — 입력은 로컬 스크립트로만
- `/vocab`에 묶음 제목 표시 — 데이터는 지원하지만 이번엔 만들지 않는다
