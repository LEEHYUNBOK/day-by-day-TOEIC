# day-by-day TOEIC — 웹 배포 + 서버 기록 저장 설계

- 작성일: 2026-08-06
- 상태: 사용자 승인 완료 (구현 전)
- 선행 스펙: `2026-08-06-word-game-srs-design.md` (간격 반복 게임, 구현 완료)

## 1. 목표

지금 앱은 로컬에서만 돌고 기록이 브라우저에 갇혀 있다. 이걸 웹에 배포하고, 카카오 로그인으로 기록을 계정에 묶어서 기기를 바꿔도 이어서 공부할 수 있게 한다.

인증과 DB는 **기존 OURFLIX 프로젝트(`~/Desktop/proposs`)의 Supabase를 그대로 공유한다.** OURFLIX는 이미 같은 스택(Next.js 16 / React 19 / Supabase / Vercel)이고 카카오·구글 로그인이 동작하므로, 인증을 새로 만들 이유가 없다.

## 2. 범위

사용자의 원래 요청은 다섯 덩어리였다. 이 스펙은 앞의 넷만 다룬다.

**이번 범위**
1. Supabase 테이블 + RLS
2. 카카오 로그인 (OURFLIX의 Supabase 인증 재사용)
3. `srsRepo`를 localStorage 전용에서 서버 지원으로 교체
4. Vercel 배포

**다음 스펙으로 미룸**
5. 공유 — 링크로 내 진도(연속 학습, 졸업한 단어 수 등)를 보여주기. 방향만 확정했고, 이 스펙의 스키마에 추가 부담은 없다. 없어도 앱이 성립하므로 뒤로 뺀다.

## 3. 로그인은 선택이다

**접속하면 로그인 없이 바로 게임이 시작된다.** 이건 이전 스펙에서 사용자가 명시적으로 요구한 것이고, 여기서 깨지 않는다.

- 로그인 전: 지금과 동일하게 localStorage에만 기록한다
- 게임 화면에 "기기 바꿔도 이어서 하기" 버튼을 둔다 → 카카오 로그인 → 로컬 기록을 서버로 이전
- 로그인 후: 서버가 원본이 되고, localStorage는 낙관적 캐시 역할을 한다

## 4. 저장 아키텍처 — 서버가 원본, 실패하면 대기열

### 4.1 커밋의 모양

**스케줄링 계산은 전부 클라이언트에 남는다.** `lib/srs.ts`와 `lib/queue.ts`는 변경하지 않는다. 서버는 계산하지 않고 저장만 한다.

한 판이 끝나면 클라이언트가 지금처럼 다음 카드 상태를 계산하고, 그 **결과 행들을 서버에 upsert**한다:

- 영향받은 카드들을 `toeic_cards`에 upsert (졸업한 카드는 delete)
- 졸업 항목을 `toeic_mastered`에 insert
- 세션 하나를 `toeic_sessions`에 insert

서버가 `nextState`를 다시 계산하지 않으므로 재전송이 안전하다 — 같은 결과 행을 다시 upsert하는 것은 멱등에 가깝다.

### 4.2 실패하면 대기열에 쌓는다

**정정:** 설계 논의 중 "대기 중인 판은 항상 최대 하나"라고 말했는데 이건 틀렸다. 오프라인 상태에서 여러 판을 연달아 끝낼 수 있으므로 대기열은 **배열**이어야 한다.

- localStorage 키 `ddt.pending`에 커밋 페이로드 배열을 쌓는다
- 커밋이 실패하면 페이로드를 대기열에 넣고, **로컬 카드 상태는 낙관적으로 갱신한다.** 그래서 연결이 없어도 계속 공부할 수 있고 다음 판의 큐가 올바르게 구성된다
- 다음 접속 시 로그인되어 있고 대기열이 비어 있지 않으면, **순서대로 재전송**한 뒤 성공한 것만 대기열에서 지운다
- 재전송이 또 실패하면 그대로 남겨두고 조용히 넘어간다 — 학습을 막지 않는다

### 4.3 읽기

로그인 상태에서 앱을 열면 서버에서 카드·졸업·세션을 읽어 localStorage에 써넣고, 그 뒤의 모든 읽기는 로컬에서 한다. 대기열이 남아 있으면 재전송을 먼저 시도하고, 그 결과를 반영한 뒤 화면을 그린다.

## 5. 테이블

OURFLIX와 **같은 Supabase 프로젝트**, `public` 스키마, `toeic_` 접두사로 구분한다.

### 5.1 마이그레이션의 소유권과 실행

**마이그레이션 SQL은 OURFLIX 레포(`~/Desktop/proposs/supabase/migrations/`)에 새 번호를 붙여 추가한다.** 그 레포가 이 Supabase 프로젝트의 스키마를 소유하고 있으므로, 한 DB의 스키마 이력이 레포 두 곳으로 갈라지지 않게 한다. 이 TOEIC 레포에는 `supabase/` 디렉토리를 만들지 않는다.

이건 이 스펙에서 **OURFLIX 레포를 수정하는 유일한 지점**이다. 기존 마이그레이션 파일은 건드리지 않고 새 파일만 추가한다.

**실행은 사용자가 직접 한다.** Supabase 대시보드의 SQL 에디터에 붙여넣거나 OURFLIX의 기존 `scripts/run-migration.ts`를 쓴다. 구현 과정에서 DB에 직접 접속하지 않으므로 `SUPABASE_SERVICE_ROLE_KEY`나 `SUPABASE_DB_URL`은 이 프로젝트로 가져오지 않는다 — `.env.local`에는 브라우저에 노출되도록 설계된 `NEXT_PUBLIC_*` 두 개만 둔다.

마이그레이션은 재실행 가능하게 작성한다 (`create table if not exists`, 정책은 `drop policy if exists` 후 `create` — OURFLIX의 `001_schema.sql`이 쓰는 방식과 동일하다).

```sql
create table if not exists toeic_cards (
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_id     text not null,
  type        text not null check (type in ('word','blank','arrange')),
  source_date date not null,
  box         smallint not null check (box between 0 and 3),
  due_date    date not null,
  updated_at  timestamptz not null default now(),
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

RLS는 세 테이블 모두 동일하게, 자기 행만 읽고 쓴다:

```sql
alter table toeic_cards enable row level security;
drop policy if exists "own toeic cards" on toeic_cards;
create policy "own toeic cards" on toeic_cards
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

`toeic_mastered`, `toeic_sessions`도 같은 형태로 만든다. RLS를 켜는 것을 빠뜨리면 anon key로 남의 학습 기록을 읽을 수 있으므로, 세 테이블 모두에 `enable row level security`가 있는지 마이그레이션 실행 후 확인한다.

## 6. 로그인 시 기록 이전

**정정:** 논의 중 "더 나중 상태를 남긴다"고 말했는데, 카드에 갱신 시각이 없어서 그대로는 구현할 수 없다. 시각 필드를 새로 넣는 대신 더 단순하고 설명 가능한 규칙을 쓴다.

**규칙: 합집합, 충돌하면 서버가 이긴다.**

- 서버에 없고 로컬에만 있는 카드 → 서버에 추가한다
- 양쪽에 있는 카드 → 서버 행을 유지한다 (계정 기록이 권위를 갖는다)
- 졸업 항목도 같은 규칙. 세션 기록은 서버에 없는 것만 추가한다

이 규칙을 고른 이유: 기기 간 시계 차이에 의존하지 않고, 로컬에만 존재하는 학습을 잃지 않으며, 사용자에게 한 문장으로 설명된다. 첫 로그인(서버가 비어 있음)에서는 로컬 기록이 통째로 올라가므로 가장 흔한 경우에 손실이 없다.

이전은 로그인 직후 한 번만 실행하고, 결과를 사용자에게 알린다 ("N개 항목을 계정에 저장했어요").

## 7. 코드 변경

### 7.1 `lib/srsRepo.ts` — 비동기로 전환

현재는 동기 함수들이다. 서버를 붙이려면 읽기·쓰기가 비동기가 되어야 한다. **함수 이름과 의미는 유지하고 반환 타입만 `Promise`로 바꾼다.**

호출 지점은 네 곳이고 셋은 이미 비동기 문맥 안에 있어 `await`만 붙이면 된다 (`app/page.tsx`의 로더, `app/vocab/page.tsx`, `app/stats/page.tsx`).

문제는 네 번째다. `components/GameRunner.tsx`가 클릭 핸들러 안에서 커밋하고 **즉시 다시 읽어** "내일 볼 단어" 수를 계산한다. 여기에 단계를 하나 넣는다.

### 7.2 `GameRunner`에 '저장 중' 단계

`Phase`에 `'committing'`을 추가한다. 마지막 문항에 답하면:

1. `'committing'`으로 전환하고 스피너를 보여준다
2. 커밋을 `await`한다
3. 성공하면 결과 화면으로 간다
4. 실패하면 대기열에 넣고, **결과 화면은 그대로 보여주면서** "기록은 나중에 저장할게요"를 덧붙인다

학습 결과를 못 보여주는 일은 없어야 한다. 저장 실패는 알림이지 차단이 아니다.

### 7.3 새 파일

- `lib/supabase.ts` — 브라우저용 Supabase 클라이언트 (`@supabase/ssr`)
- `lib/remoteSrs.ts` — 서버 읽기/쓰기와 대기열 재전송
- `lib/migrateLocal.ts` — 6장의 이전 규칙
- `app/auth/callback/route.ts` — OAuth 콜백 (OURFLIX의 같은 파일을 참고)

`lib/srsRepo.ts`는 로그인 여부를 보고 로컬만 쓸지 서버까지 쓸지 결정하는 얇은 층이 된다. 화면은 여전히 `srsRepo`만 바라본다 — 이 경계는 유지된다.

### 7.4 변경하지 않는 것

`lib/srs.ts`, `lib/queue.ts`, `lib/quiz.ts`, `lib/contentRepo.ts`, `lib/date.ts`. 콘텐츠는 계속 `public/data/`의 정적 JSON이다 — 읽기 전용이고 사용자별로 다르지 않으므로 DB에 넣을 이유가 없다.

## 8. 배포

- Vercel에 **별도 프로젝트**로 배포한다 (OURFLIX와 같은 Supabase를 쓰지만 앱은 별개다)
- 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — OURFLIX와 같은 값
- Supabase 대시보드의 Auth → URL Configuration에 새 배포 도메인을 리다이렉트 URL로 추가한다. **이건 OURFLIX와 공유하는 설정을 건드리는 유일한 지점이므로, 기존 URL을 지우지 않고 추가만 한다**
- 카카오 개발자 콘솔은 Supabase가 중개하므로 별도 설정이 필요 없다 (Supabase 콜백 URL이 이미 등록되어 있다)

## 9. 엣지 케이스

- **로그인 안 한 상태** → 지금과 완전히 동일하게 동작한다. 서버 호출 없음
- **로그인했지만 오프라인** → 로컬 상태로 계속 플레이하고 커밋은 대기열에 쌓인다
- **로그아웃** → 서버 기록은 남기고 로컬 캐시를 비운다. 다시 로그인하면 서버에서 받아온다
- **두 기기에서 동시에** → 카드별 마지막 쓰기가 이긴다. 혼자 쓰는 앱에서 실질적 위험이 낮아 받아들인다. 세션 기록은 양쪽 다 남는다
- **서버에서 읽기 실패** → 로컬 캐시로 진행하고 배너로 알린다. 스피너에 갇히지 않는다
- **대기열 재전송이 계속 실패** → 대기열을 유지하고 조용히 넘어간다. `/stats`에 "저장 대기 중 N판"을 표시한다
- **RLS 위반** → 있을 수 없지만, 발생하면 커밋 실패로 취급해 대기열로 보낸다

## 10. 테스트

- `lib/migrateLocal.ts` — 6장 규칙의 유닛 테스트: 로컬만 있는 카드가 올라가는지, 충돌 시 서버가 이기는지, 서버가 비어 있을 때 전부 올라가는지
- 대기열 재전송 로직 — 순서 유지, 성공한 것만 제거, 실패 시 보존
- `srsRepo`의 로그인/비로그인 분기
- Supabase 호출은 모킹한다. 실제 네트워크를 타는 테스트는 두지 않는다
- 화면은 수동 확인 (기존 방식 유지)

## 11. 이번 범위 아님

- 공유 (2장 참조) — 다음 스펙
- 구글 로그인 — 카카오만. OURFLIX에 구글도 있으므로 나중에 한 줄로 추가할 수 있다
- 서버 사이드 스케줄링 — 계산은 클라이언트에 남는다
- 실시간 동기화, 오프라인 큐의 일반화된 병합
- 콘텐츠를 DB로 이전
