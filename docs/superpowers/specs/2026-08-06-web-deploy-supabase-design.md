# day-by-day TOEIC — 콘텐츠 DB 전환 + 웹 배포 설계

- 작성일: 2026-08-06
- 상태: 사용자 승인 완료 (구현 전)
- 선행 스펙: `2026-08-06-word-game-srs-design.md` (간격 반복 게임, 구현 완료)
- 이 문서는 같은 파일의 이전 두 판을 대체한다. 변경 이력은 15장에 정리했다.

## 1. 목표

두 가지를 해결한다.

**콘텐츠가 레포에 고정되어 있다.** 지금 단어·문장은 커밋된 14일치 JSON이다. 사용자는 매일 Claude로 콘텐츠를 생성해 쌓으려 하는데, 정적 파일이면 매일 커밋과 재배포를 해야 한다. → **DB로 옮기고 입력 스크립트를 만든다.**

**로컬에서만 돈다.** → **Vercel에 배포한다.**

DB는 기존 OURFLIX 프로젝트(`~/Desktop/proposs`)의 Supabase를 공유한다. 같은 스택(Next.js 16 / React 19 / Supabase / Vercel)이라 새로 만들 이유가 없다.

## 2. 범위

**이번 범위**
1. 콘텐츠 테이블 3개 + 읽기 전용 RLS
2. `lib/contentRepo.ts`를 DB 기반으로 교체
3. 매일 넣는 입력 스크립트
4. 기존 14일치 이전과 정적 파일 정리
5. Vercel 배포

**이번에 하지 않는 것 — 로그인과 서버 진도**

진도는 계속 브라우저 `localStorage`에 남는다. 인증은 넣지 않는다.

이유: 콘텐츠 DB화는 인증과 완전히 무관하고(콘텐츠는 공용, anon 읽기), 사용자가 지금 가장 원하는 것은 매일 단어를 쌓는 것이다. 로그인은 유일하게 사용자의 수동 검증이 필요한 부분이기도 하다. 한 기기만 쓰는 동안은 `localStorage`로 충분하다.

**포기가 아니라 유보다.** 이미 확정한 설계 결정은 14장에 남겨서 다음 스펙이 이어받는다.

## 3. 로그인 없이 동작한다

접속하면 지금처럼 바로 게임이 시작된다. 콘텐츠는 anon key로 읽고, 진도는 `localStorage`에 쓴다. **인증 관련 코드는 이 스펙에 존재하지 않는다.**

## 4. 콘텐츠 테이블

이전 판에서는 "콘텐츠는 읽기 전용이고 사용자별로 다르지 않으니 DB에 넣을 이유가 없다"고 판단했다. 그 판단은 콘텐츠가 고정 14일치라는 전제에서만 옳았다.

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

`item_id`를 텍스트 기본키로 둔다 (`w-negotiate`, `s-0804-1`). 이미 쌓인 학습 기록의 카드 신원 규칙 `(type, item_id)`가 그대로 유지되므로, **콘텐츠를 옮겨도 사용자의 진도가 살아 있다.**

`toeic_sets.seq`가 묶음의 도입 순서다. 입력 스크립트가 `max(seq) + 1`을 부여한다.

### 4.1 읽기만 허용한다

```sql
alter table toeic_sets enable row level security;
drop policy if exists "toeic sets readable" on toeic_sets;
create policy "toeic sets readable" on toeic_sets for select using (true);
```

`toeic_words`, `toeic_sentences`도 동일하게 만든다.

**INSERT / UPDATE / DELETE 정책은 의도적으로 만들지 않는다.** RLS가 켜져 있고 해당 정책이 없으면 anon key로는 쓸 수 없다. `service_role` 키만 RLS를 우회하므로, 입력 스크립트 외에는 아무도 문제를 바꿀 수 없다.

anon key는 브라우저에 그대로 노출되는 값이므로, **RLS가 켜져 있는지 확인하는 것이 이 스펙의 유일한 보안 관문이다.** 마이그레이션 실행 후 세 테이블 모두 확인한다.

## 5. 새 항목이 나오는 순서

`toeic_sets.seq` 오름차순 → 묶음 안에서 `toeic_words.seq` 순으로 단어 → `toeic_sentences.seq` 순으로 빈칸 → 같은 순서로 조합.

**현재 파일 순서 동작과 동일하다.** 첫 판이 Day 1의 단어 10개 + 빈칸 5개 + 조합 5개인 것도 그대로다.

## 6. `contentRepo` 교체

`fetchIndex()` + 날짜별 `fetchDay()` 14회를 쿼리 3개로 대체한다.

```ts
export interface ContentBundle {
  words: Word[];          // 도입 순서로 정렬됨
  sentences: Sentence[];  // 도입 순서로 정렬됨
}

/** 조회 실패는 null. 콘텐츠가 없는 것(빈 배열)과 구분된다. */
export async function fetchContent(): Promise<ContentBundle | null>;
```

전체를 한 번에 가져오는 이유: `buildQueue`가 전체 후보 목록을, `buildWordQuiz`가 전체 단어 풀을 요구한다. 단어 1,000개 수준까지는 가볍다. 그 이상 쌓이면 나눠 가져오는 것을 그때 설계한다 — 지금 미리 만들지 않는다.

후보 목록(`CardIdentity[]`)은 `app/page.tsx`가 이 번들로 만든다: 단어 순서대로 `word`, 이어서 문장 순서대로 `blank`, 그다음 같은 순서로 `arrange`.

## 7. `sourceDate` 제거

`SrsCard`와 `CardIdentity`의 `sourceDate`를 없앤다.

이 필드는 "이 항목이 몇 일차 **파일**에 있나"를 가리키는 콘텐츠 포인터였다. 콘텐츠가 DB로 가면 `item_id`로 번들에서 직접 찾으므로 존재 이유가 사라진다. 남기면 입력 스크립트가 의미 없는 날짜를 만들어 넣어야 한다.

영향: `lib/srs.ts`, `lib/queue.ts`, `lib/srsRepo.ts`, `app/page.tsx`, `app/vocab/page.tsx`와 관련 테스트. 스케줄링 규칙(box 전이, 간격 1/3/7/14, 졸업)은 건드리지 않는다.

**기존 localStorage 데이터는 마이그레이션하지 않는다.** 이미 저장된 카드에는 `sourceDate`가 남아 있지만, 코드가 읽지 않으므로 무해하게 무시된다. 사용자의 진도는 그대로 유지된다.

## 8. 입력 스크립트

```
npm run ingest -- <파일경로>
```

입력 JSON은 현재 day 파일과 같은 형태에서 `date`가 빠지고 `title`만 남는다:

```json
{
  "title": "Day 15 — 계약 갱신",
  "words": [
    { "id": "w-renew", "word": "renew", "pos": "v.", "meaning": "갱신하다",
      "example": "We need to renew the lease.", "exampleKo": "우리는 임대차 계약을 갱신해야 한다." }
  ],
  "sentences": [
    { "id": "s-0815-1", "text": "The tenant will renew the lease next month.",
      "ko": "세입자가 다음 달에 임대차 계약을 갱신할 것이다.",
      "blankWord": "renew", "distractors": ["reduce", "remove", "reverse"] }
  ]
}
```

스크립트가 하는 일:

1. **검증** — 통과하지 못하면 아무것도 넣지 않고 종료한다
   - 필수 필드 존재 (`title`, 단어의 6개 필드, 문장의 5개 필드)
   - `blankWord`가 `text`에 정확히 한 번, 공백 기준 독립 토큰으로, 대소문자 일치, **문장 첫 단어가 아님**
   - `distractors` 정확히 3개
   - `id` 중복 — 입력 파일 안에서, 그리고 **DB에 이미 있는 것과** 비교한다
   - 분량은 자유. 단어가 1개 이상이면 통과한다 (문장 0개도 허용)
2. **삽입** — `toeic_sets`에 `seq = max+1`로 한 줄, 그다음 단어·문장
3. 항목 삽입이 실패하면 방금 만든 묶음을 지우려 시도하고 실패를 보고한다. 이게 실패해도 **항목 없는 빈 묶음은 무해하다** — 후보를 하나도 만들지 않으므로 앱 동작에 영향이 없다

`service_role` 키를 쓰므로 **이 스크립트는 Node에서만 실행되고 브라우저 코드에서 절대 import되지 않는다.** 키는 `.env.local`의 `SUPABASE_SERVICE_ROLE_KEY`에 두고 git에 올리지 않는다 (`NEXT_PUBLIC_` 접두사가 없으므로 Next.js 클라이언트 번들에 포함되지 않는다).

입력 JSON 파일은 레포에 커밋하지 않는다. 임의 경로에서 읽는다.

### 8.1 스크립트가 검사할 수 없는 것

정답·오답의 **품질** 규칙은 기계가 판단할 수 없다:

- 오답 보기가 빈칸에 들어가도 말이 되면 안 된다 (정답이 둘이 됨)
- 그렇다고 한눈에 걸러질 단어여도 안 된다 (공부가 안 됨)
- 문장 조합 모드는 어순을 정확히 맞춰야 하므로, 어순이 두 가지로 성립하는 문장은 피해야 한다

이 규칙들은 v1 리뷰에서 실제 결함으로 확인된 것들이다. README에 남겨서 Claude가 생성할 때 따르게 한다.

## 9. 기존 14일치 이전과 정리

1. 입력 스크립트로 `public/data/days/*.json` 14개를 날짜 순서대로 넣는다 (`title`은 각 파일의 것을 쓴다)
2. 앱이 DB에서 읽어 정상 동작하는 것을 확인한다 — 첫 판이 Day 1 내용인지, 기존 진도가 유지되는지
3. **확인된 뒤 `public/data/`와 `scripts/validate-data.mjs`를 삭제한다.** 앱이 더 읽지 않는 파일을 남기면 죽은 코드가 된다. 검증 규칙은 입력 스크립트로 옮겨졌다

## 10. 마이그레이션의 소유권과 실행

**SQL은 OURFLIX 레포(`~/Desktop/proposs/supabase/migrations/`)에 새 번호로 추가한다.** 그 레포가 이 Supabase 프로젝트의 스키마를 소유하므로, 한 DB의 스키마 이력이 레포 두 곳으로 갈라지지 않게 한다. 이 TOEIC 레포에는 `supabase/` 디렉토리를 만들지 않는다.

이건 이 스펙에서 **OURFLIX 레포를 수정하는 유일한 지점**이다. 기존 마이그레이션 파일은 건드리지 않고 새 파일만 추가한다.

**실행은 구현자가 OURFLIX 디렉토리에서 기존 도구로 한다:**

```
cd ~/Desktop/proposs && npm run migrate:sql -- supabase/migrations/0NN_toeic_content.sql
```

이 스크립트는 `.env`의 `SUPABASE_DB_URL`로 접속하고 트랜잭션으로 감싼다. **DB 접속 정보를 TOEIC 프로젝트로 복사하지 않는다** — 비밀키는 있던 자리에 두고 명령만 그쪽에서 실행한다.

마이그레이션은 재실행 가능하게 쓴다 (`create table if not exists`, 정책은 `drop policy if exists` 후 `create` — OURFLIX의 `001_schema.sql` 방식과 동일).

실행 후 세 테이블의 RLS가 켜져 있고 SELECT 정책만 있는지 확인한다.

## 11. 배포

- Vercel에 **별도 프로젝트**로 배포한다 (같은 Supabase를 쓰지만 앱은 별개다)
- 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — OURFLIX와 같은 값
- **`SUPABASE_SERVICE_ROLE_KEY`는 Vercel에 넣지 않는다.** 입력 스크립트는 로컬에서만 돌고, 웹에 올라가는 코드에는 존재 이유가 없다
- 인증이 없으므로 Supabase의 리다이렉트 URL 설정은 건드리지 않는다. **OURFLIX와 공유하는 설정을 수정하는 지점이 이 스펙에는 없다**

## 12. 엣지 케이스

- **콘텐츠 조회 실패** → 문항을 만들 수 없다. 한국어 오류 화면과 재시도 버튼. **"오늘 할 게 없어요"로 표시하지 않는다** — 그건 거짓이고, v1에서 실제로 이 결함이 있었다
- **콘텐츠가 비어 있음 (DB에 묶음 0개)** → 오류가 아니라 "아직 학습할 내용이 없어요"로 구분해 표시한다
- **DB에서 삭제된 항목의 카드를 들고 있음** → `/vocab`에 "삭제된 콘텐츠"로 표시하고 제거 버튼을 준다 (현재 동작 유지). 후보 생성에서 제외되므로 출제되지 않는다
- **입력 스크립트가 중복 `item_id`를 만남** → 아무것도 넣지 않고 어느 id가 충돌했는지 보고한다
- **입력 파일이 잘못된 JSON** → 파싱 오류를 그대로 보고하고 종료한다
- **`localStorage`가 비어 있음** → 지금과 동일. 신규 항목으로 한 판을 구성한다

## 13. 테스트

- 입력 스크립트의 검증 로직 — 현재 `validate-data.mjs`가 검사하던 수준으로: `blankWord` 규칙(한 번만, 독립 토큰, 대소문자, 문장 첫 단어 아님), `distractors` 개수, 파일 내 중복 id
- 콘텐츠 번들에서 후보 목록을 만드는 순서 로직 — 단어 → 빈칸 → 조합, 묶음 순서 유지
- `lib/srs.ts`, `lib/queue.ts`, `lib/srsRepo.ts`의 기존 테스트는 `sourceDate` 제거만 반영하고 나머지는 유지한다
- Supabase 호출은 모킹한다. 실제 네트워크를 타는 테스트는 두지 않는다
- 화면은 수동 확인 (기존 방식 유지). **배포 후 실제 URL에서 한 판을 완주하는 것까지 확인한다**

## 14. 다음 스펙으로 넘기는 설계 결정

로그인·서버 진도·공유는 유보하지만, 이미 확정한 결정을 잃지 않도록 남긴다. 상세 설계는 이 파일의 이전 판(git 이력)에 있다.

- **진도 테이블 3개** — `toeic_cards` / `toeic_mastered` / `toeic_sessions`, `(user_id, type, item_id)` 복합 기본키, `auth.uid()` 기반 RLS
- **저장 아키텍처** — 서버가 원본, 커밋 실패 시 `localStorage`의 대기열(배열)에 쌓고 다음 접속에 순서대로 재전송. 스케줄링 계산은 클라이언트에 남기고 서버는 저장만 한다
- **세션 중복 방지** — 대기열 재전송이 세션을 중복 insert하지 않도록 클라이언트 생성 `client_id`에 유니크 인덱스
- **로그인 시 기록 이전** — 합집합, 충돌하면 서버가 이긴다 (기기 간 시계 차이에 의존하지 않기 위해)
- **`GameRunner`에 `'committing'` 단계** — 저장 실패는 알림이지 차단이 아니다. 결과 화면은 무조건 보여준다
- **인증은 카카오만** — OURFLIX의 Supabase에 이미 연결되어 있어 provider 설정이 불필요하다. 구글은 나중에 한 줄로 추가 가능
- **공유** — 링크로 내 진도(연속 학습, 졸업한 단어 수)를 보여주기. 식별자가 필요하므로 로그인이 선행되어야 한다

## 15. 이 문서의 변경 이력

같은 파일이 세 번 쓰였다. 판단이 바뀐 지점을 남긴다.

1. **1판** — 로그인·서버 진도·배포. 콘텐츠는 정적 JSON 유지
2. **2판** — 사용자가 "매일 Claude로 콘텐츠를 쌓겠다"고 밝혀, 콘텐츠 DB화를 합침. 정적 JSON은 매일 커밋·재배포를 요구하므로 1판의 판단이 틀렸다
3. **3판 (현재)** — 로그인을 유보. 콘텐츠 DB화는 인증과 무관하고, 사용자가 지금 원하는 것은 매일 단어를 쌓는 것이다. 로그인은 유일하게 사용자의 수동 검증이 필요한 부분이기도 하다

## 16. 이번 범위 아님

- 로그인, 서버 진도, 공유 (14장)
- 서버 사이드 스케줄링 — 계산은 클라이언트에 남는다
- 콘텐츠 페이지네이션 — 단어 1,000개를 넘길 때 다시 본다
- 웹 관리자 입력 화면 — 입력은 로컬 스크립트로만
- `/vocab`에 묶음 제목 표시 — 데이터는 지원하지만 이번엔 만들지 않는다
- 콘텐츠 수정·삭제 기능 — 입력만. 고칠 일이 생기면 SQL로 직접 한다
