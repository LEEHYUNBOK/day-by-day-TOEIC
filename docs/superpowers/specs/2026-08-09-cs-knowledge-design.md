# 컴퓨팅 사이언스 트랙 설계

작성일: 2026-08-09

## 1. 목적

이 앱은 영어 공부와 컴퓨팅 사이언스 공부를 겸하려고 만든 것이다. 지금은 토익만 있다.
CS 지식을 **별도 트랙**으로 붙여, 하루에 토익 10문항과 CS 10장을 각각 풀 수 있게 한다.

## 2. 범위

**넣는 것**

- CS 카드 콘텐츠 테이블과 마이그레이션
- CS 카드 입력 스크립트
- 시드 콘텐츠 5세트 50장
- `/cs` 화면과 자기채점 러너
- 토익 완료 화면에서 CS로 이어가는 진입점
- 트랙 구분(`Track`)과 그에 따른 통계 분리
- 스트릭 하나로 합치기

**넣지 않는 것**

- CS 카드 목록 화면 (`/vocab`의 CS 버전). 필요해지면 그때 만든다.
- CS 카드의 4지선다 변형
- 로그인·서버 저장 (2026-08-06 스펙 §14에서 미룬 그대로)
- 토익 판과 CS 판을 섞는 옵션

## 3. 사용자가 정한 것

| 항목 | 결정 |
|---|---|
| 카드 형태 | 질문 → 답 보기 → 알았음/몰랐음 자기채점 |
| 판 구조 | 토익과 완전히 별도 트랙, 별도 판 |
| CS 판 크기 | 10장 (하루 총 20개) |
| 진입 흐름 | 열면 바로 토익. 토익 완료 화면에서 CS로 이어가기. 네비게이션으로 CS만 따로도 가능 |
| 스트릭 | 하나. 토익이든 CS든 하루에 하나만 해도 유지 |
| 초기 콘텐츠 | 내가 만든다 |
| 주제 범위 | 학부 핵심(자료구조·알고리즘·네트워크·OS·DB) + 백엔드 실무(JVM·동시성·트랜잭션·인덱스·HTTP·캐시) |
| 구조 | 저장소는 하나로 두고 `Track` 구분만 명시적으로 도입 (접근법 C) |

접근법 A(저장소 공유, 트랙 구분 없음)를 버린 이유: `SessionRecord`에 트랙이 없으면
자기채점 "알았음" 비율과 4지선다 정답률이 한 숫자로 합쳐지고, 그 숫자는 아무 뜻이 없어진다.
접근법 B(저장소·모듈 분리)를 버린 이유: `srsRepo.ts`를 거의 그대로 복제해야 하고,
스트릭을 하나로 합치려면 갈라놓은 것을 다시 붙이는 코드가 필요하다.

## 4. 아키텍처

간격 반복 규칙(`lib/srs.ts`의 `DUE_DAYS`, `nextState`)과 판 구성(`lib/queue.ts`의 `buildQueue`)은
무엇을 외우는지 모르도록 만들어져 있다. 이 설계는 그 성질을 이용한다 — **두 모듈은 한 줄도 바뀌지 않는다.**

트랙은 `QuizType`에서 파생된다. 별도 필드를 카드에 넣지 않는다.

```
QuizType  'word' | 'blank' | 'arrange'  ->  Track 'toeic'
QuizType  'cs'                          ->  Track 'cs'
```

카드 저장소(`ddt.srs`)와 졸업 저장소(`ddt.mastered`)는 두 트랙이 공유한다.
`cardKey(type, itemId)`가 이미 타입을 포함하므로 키 충돌이 없다.
판을 구성할 때 호출부가 트랙으로 걸러서 `buildQueue`에 넘긴다.

세션 기록(`ddt.sessions`)만 트랙을 명시적으로 갖는다. 통계에서 두 트랙을 나눠 보여주기 위해서다.
스트릭은 트랙을 무시하고 전체 세션에서 계산하므로, "어느 쪽을 해도 유지"가 코드를 더 쓰지 않고 성립한다.

## 5. 타입 변경

`lib/types.ts`:

```ts
export type Track = 'toeic' | 'cs';
export type QuizType = 'word' | 'blank' | 'arrange' | 'cs';

export interface CsCard {
  id: string;       // 'cs-net-01'
  topic: string;    // '네트워크'
  question: string;
  answer: string;
}

export interface SessionRecord {
  finishedAt: string;
  date: string;
  correct: number;
  total: number;
  track: Track;     // 새 필드
}
```

`lib/srs.ts`에 매핑을 둔다. `types.ts`는 지금 타입만 있는 파일이고, 카드 정체성 개념
(`cardKey`, `DUE_DAYS`)은 이미 `srs.ts`가 갖고 있다.

```ts
export const TRACK: Record<QuizType, Track> = {
  word: 'toeic', blank: 'toeic', arrange: 'toeic', cs: 'cs',
};
```

`Record<QuizType, Track>`이므로 나중에 `QuizType`을 늘리면 매핑을 채우지 않는 한 컴파일이 깨진다.
의도한 것이다.

**기존 기록 호환** — `ddt.sessions`에 이미 쌓인 레코드에는 `track`이 없다.
`getSessions()`가 읽을 때 `track ?? 'toeic'`으로 채운다. 저장된 데이터를 고치지 않고 읽는 쪽에서 흡수한다.

`lib/queue.ts`에 상수 하나를 추가한다. 기존 `SESSION_SIZE`(토익 10문항)는 그대로 둔다.

```ts
/** CS 한 판의 카드 수 */
export const CS_SESSION_SIZE = 10;
```

## 6. DB 스키마

OURFLIX 저장소(`~/Desktop/proposs`)의 `supabase/migrations/012_cs_content.sql`.
`011_toeic_content.sql`과 같은 형식을 따른다 — 재실행 가능, `bigserial`, RLS는 SELECT 정책만.

```sql
-- 컴퓨팅 사이언스 카드. 읽기는 누구나, 쓰기는 service_role 만.
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

alter table cs_sets enable row level security;
alter table cs_cards enable row level security;

drop policy if exists "cs sets readable" on cs_sets;
create policy "cs sets readable" on cs_sets for select using (true);

drop policy if exists "cs cards readable" on cs_cards;
create policy "cs cards readable" on cs_cards for select using (true);
```

INSERT/UPDATE/DELETE 정책을 만들지 않으므로 공개 키로는 쓸 수 없다.
검증 방법: 공개 키로 `POST /rest/v1/cs_cards`를 시도해 401이 오는지 확인한다.

## 7. 콘텐츠 읽기

`lib/contentRepo.ts`에 CS용 함수를 **따로** 추가한다. 기존 `fetchContent()`는 건드리지 않는다.
CS 조회가 실패해도 토익 화면이 죽지 않고, 반대도 마찬가지다.

```ts
export interface RawCsCard {
  item_id: string; set_id: number; seq: number;
  topic: string; question: string; answer: string;
}

export interface CsBundle {
  cards: CsCard[];
  candidates: CardIdentity[];   // 세트 seq -> 항목 seq 순서
}

export function toCsBundle(sets: RawSet[], cards: RawCsCard[]): CsBundle;
export async function fetchCsContent(): Promise<CsBundle | null>;  // null = 조회 실패
```

`toCsBundle`의 규칙은 `toBundle`과 같다:

- 세트 `seq` → 항목 `seq` 순으로 정렬한다
- `sets`에 없는 `set_id`를 가진 카드는 버린다
- snake_case를 camelCase로 옮긴다 (`item_id` → `id`)
- `candidates`는 정렬된 순서 그대로 `{ itemId, type: 'cs' }`

`fetchCsContent()`는 `cs_sets`와 `cs_cards`를 병렬로 조회하고, 둘 중 하나라도 오류면 `null`을 돌려준다.
예외도 잡아서 `null`로 만든다. **`null`(조회 실패)과 빈 번들(콘텐츠 없음)은 다른 상태다.**

## 8. 콘텐츠 입력 파이프라인

`scripts/ingest-cs.mjs`를 새로 만든다. `scripts/ingest.mjs`의 `loadEnv`와 `rest`에 `export`를 붙여
가져다 쓴다. 환경 로딩과 REST 헬퍼를 복제하지 않기 위한 최소 변경이다.
`scripts/ingest.d.mts`에 두 함수의 선언을 추가한다.

실행: `npm run ingest:cs -- <path>` (`package.json`에 스크립트 추가)

입력 파일 형식:

```json
{
  "title": "CS 1일차",
  "cards": [
    { "id": "cs-net-01", "topic": "네트워크",
      "question": "TCP와 UDP의 차이는?",
      "answer": "TCP는 연결을 맺고 순서와 재전송을 보장한다. UDP는 연결 없이 보내고 보장하지 않는다. 그래서 UDP가 더 빠르고 실시간 전송에 쓰인다." }
  ]
}
```

`validateCsInput(input, existingIds)`는 `validateInput`과 같은 계약을 갖는다 —
오류를 모두 모아서 `{ ok: errors.length === 0, errors }`를 **항상** 돌려준다.

검증 규칙:

- `title`이 비어 있지 않은 문자열
- `cards`가 1장 이상인 배열
- 카드마다 `id`·`topic`·`question`·`answer`가 비어 있지 않은 문자열
- 파일 안에서 `id` 중복 없음
- `existingIds`(DB에 이미 있는 `item_id`)와 겹치지 않음

토익과 달리 오답 데이터가 없으므로 오답 품질 검증이 없다. 자기채점 방식을 고른 결과다.

삽입 순서와 실패 처리는 `ingest.mjs`와 같게 한다 — 세트를 만들고 카드를 넣다가 실패하면
세트를 지우고, 지우기가 실패하면 살아남은 실제 개수를 보고한다. 비어 있다고 거짓 보고하지 않는다.

`seq`는 파일 안의 배열 순서로 부여한다. `ingest.mjs`가 `seq: i + 1`을 쓰므로 **1부터** 시작해
같은 규칙을 지킨다. 세트의 `seq`는 기존 최대값 + 1이다.

## 9. 시드 콘텐츠

5세트 50장. 세트당 10장이고, 한 세트 안에 주제를 섞는다:

| 주제 | 세트당 장수 | `item_id` 접두 |
|---|---|---|
| 자료구조·알고리즘 | 2 | `cs-ds-` |
| 네트워크 | 2 | `cs-net-` |
| 운영체제 | 2 | `cs-os-` |
| 데이터베이스 | 2 | `cs-db-` |
| 백엔드 실무 | 2 | `cs-be-` |

번호는 주제별로 이어서 붙인다(`cs-ds-01` … `cs-ds-10`).

한 주제를 몰아서 하지 않고 섞는 이유: 섞어서 공부하는 편이 기억에 오래 남는다.

**답안 작성 기준**

- 답은 3~4문장. 정의 한 줄로 끝내지 않고 "왜 그런지" 또는 "언제 쓰는지"를 한 문장 포함한다.
- 사실만 쓴다. 확실하지 않은 수치·버전별 동작은 넣지 않는다.
- 특정 프레임워크 버전에 종속된 내용은 백엔드 실무 주제에서도 피한다.
- 질문은 한 가지만 묻는다. "A와 B의 차이와 각각의 사용 사례는?"처럼 두 개를 묻지 않는다.

50장의 사실 확인은 작성자가 하되, 사용자가 한 번 훑어봐야 한다.

## 10. 화면과 흐름

**`/` (토익)** — 지금과 같다. 열면 바로 문제, 10문항.

**토익 완료 화면** (`components/GameRunner.tsx`) — 지금은 버튼이 둘이다:
`한 판 더`(파란 주버튼)와 `통계 보기`(외곽선 링크). 여기에 `CS 10장 이어서 하기`를 넣고
순서와 강조를 이렇게 바꾼다.

| 순서 | 버튼 | 강조 |
|---|---|---|
| 1 | CS 10장 이어서 하기 | 파란 주버튼 |
| 2 | 한 판 더 | 외곽선 |
| 3 | 통계 보기 | 외곽선 |

`한 판 더`를 주버튼에서 내리는 것은 의도한 변경이다. 오늘 판을 끝낸 다음의 자연스러운
행동은 토익을 한 판 더 하는 것이 아니라 CS로 넘어가는 것이고, 그게 사용자가 고른 흐름이다.
CS를 외곽선 버튼으로 두면 `통계 보기`와 같은 무게가 되어 묻힌다.
이건 요청 범위 밖의 강조 변경이므로 사용자 확인을 받는다.

CS 링크는 **항상 표시한다.** 토익 화면이 CS 콘텐츠를 미리 불러와 "오늘 CS 할 게 있나"를
판단하면 두 트랙이 결합되고 로딩도 느려진다. 할 게 없으면 `/cs`가 알려준다.

**`/cs`** — 열면 바로 첫 카드. 10장.

**네비게이션** (`components/Nav.tsx`) — `토익 / CS / 단어장 / 통계 / 설치`.
덱이 둘이 되면 `홈`이라는 라벨이 모호해지므로 `홈`을 `토익`으로 바꾼다.

**`components/CsRunner.tsx`** — 자기채점 러너. `GameRunner`를 재사용하지 않는다.
선택지 UI와 답-공개 UI는 상호작용이 다르고, 한 컴포넌트에 모드를 넣으면 둘 다 읽기 어려워진다.

카드 하나의 진행: `질문` → (`답 보기`) → `공개` → (`알았음` / `몰랐음`) → 다음 카드.

- `알았음`이 `correct: true`, `몰랐음`이 `correct: false`로 `nextState()`에 들어간다
- 진행률(`3 / 10`)과 막대는 `GameRunner`와 같은 형태
- 나가기: 답이 하나라도 있으면 확인을 받고 `/stats`로 간다
- 판 중간에 나가면 아무것도 기록하지 않는다 (`GameRunner`와 같다)

완료 화면은 `GameRunner`의 완료 화면과 같은 구성을 따르되 용어만 바꾼다:
졸업 개수(있을 때) → **알았음 비율**과 `8 / 10` → 몰랐던 카드 목록(질문 문장) →
`내일 볼 카드 N개` → `한 판 더`(파란 주버튼) / `통계 보기`(외곽선).

CS 완료 화면에는 토익으로 돌아가는 버튼을 넣지 않는다. 흐름은 토익 → CS 한 방향이고,
양쪽에 서로를 가리키는 버튼을 두면 어디까지 했는지 알기 어려워진다.
토익으로 가려면 네비게이션을 쓴다.

**용어** — 자기채점 결과를 "정답률"로 부르지 않고 **"알았음 비율"**로 부른다.
같은 숫자에 다른 이름을 붙이는 게 아니라, 스스로 채점한 값과 4지선다 정답률은 실제로 다른 값이다.

**`/vocab`** — `TRACK[c.type] === 'toeic'`인 카드만 보여준다. CS 카드를 섞으면 단어장이 아니게 된다.

**`/stats`** — 스트릭은 전체 세션에서 하나로 계산한다. 그 아래를 두 구역으로 나눈다.

- 토익: 총 판 수, 정답률, 박스별 카드 수, 졸업 수
- CS: 총 판 수, 알았음 비율, 박스별 카드 수, 졸업 수

박스 라벨(`기초 단계` / `익히는 중` / `거의 외움` / `마지막 확인`)은 그대로 쓴다.

## 11. 오류와 빈 상태

`/cs`는 `app/page.tsx`와 같은 네 상태를 갖는다. **이 구분은 타협하지 않는다.**

| 상태 | 조건 | 화면 |
|---|---|---|
| `loading` | 조회 중 | 스피너 |
| `error` | `fetchCsContent()`가 `null` | "불러오지 못했어요" + 다시 시도 버튼 |
| `no-content` | 번들의 `cards`가 비었음 | "아직 CS 카드가 없어요" |
| `empty` | 큐가 비었음 | "오늘 할 게 없어요" + 다음 복습 날짜 |

v1에서 오프라인일 때 "오늘 할 게 없어요"라고 거짓말하고 스트릭이 조용히 깨진 버그가 있었다.
`error`와 `empty`를 합치면 그 버그가 돌아온다.

**죽은 카드 걸러내기** — DB에서 지워진 카드를 가리키는 SRS 카드는 큐 구성 전에 걸러낸다.

```ts
const live = cards
  .filter((c) => TRACK[c.type] === 'cs')
  .filter((c) => cardById.has(c.itemId));
```

걸러내지 않으면 판 한 자리를 조용히 잡아먹고, `/cs`는 "오늘 할 게 없어요"라고 하는데
`/stats`는 "복습 예정 N개"라고 하는 모순이 생긴다. 토익 쪽에서 실제로 났던 버그다.

## 12. 저장

`lib/srsRepo.ts`의 `commitSession`에 트랙 인자를 추가한다.

```ts
export function commitSession(
  answers: SessionAnswer[], today: string, finishedAt: string, track: Track,
): void
```

기존 호출부(`GameRunner`)는 `'toeic'`을 넘긴다. `CsRunner`는 `'cs'`를 넘긴다.

all-or-nothing 성질을 유지한다 — 카드·졸업·세션 세 번의 저장을 루프가 끝난 뒤에 한 번씩 한다.
루프 안에서 저장하면 중간에 실패했을 때 카드 일부만 갱신된 채로 남는다.

`calcStreak`는 바뀌지 않는다. 전체 세션을 보므로 CS만 한 날도 연속이 유지된다.
오늘 아직 안 한 것이 연속을 깨지 않는 성질도 그대로다.

## 13. 테스트

기존 86개에 추가한다. Vitest, jsdom.

**`toCsBundle`**

- 세트 `seq` → 항목 `seq` 순으로 정렬한다
- `sets`에 없는 `set_id`를 가진 카드를 버린다
- snake_case를 camelCase로 옮긴다
- `candidates`가 정렬된 순서대로 `type: 'cs'`를 갖는다

정렬 픽스처는 `id`와 `seq`를 **역방향**으로 둔다: `{id: 10, seq: 2}, {id: 20, seq: 1}`.
같은 방향이면 "`seq`로 정렬한다"를 증명하지 못한다 — 2026-08-06 작업에서 실제로 이걸 틀렸다.

**`srsRepo`**

- `getSessions()`가 `track` 없는 기존 레코드를 `'toeic'`으로 채운다
- `commitSession`이 넘긴 `track`을 기록한다
- CS 세션만 있는 날도 `calcStreak`가 연속으로 센다

**`srs`**

- `TRACK`이 모든 `QuizType`을 덮는다

**`queue`**

- `CS_SESSION_SIZE`가 10이다

**`validateCsInput`**

- 필수 필드 누락을 모두 모아서 보고한다
- 파일 안의 `id` 중복을 잡는다
- `existingIds`와 겹치는 `id`를 잡는다
- `cards`가 비면 실패한다
- 정상 입력에 `{ ok: true, errors: [] }`를 돌려준다

## 14. 보안

- `cs_sets`·`cs_cards`는 RLS를 켜고 SELECT 정책만 만든다. 공개 키로 INSERT를 시도해 401을 확인한다.
- `SUPABASE_SERVICE_ROLE_KEY`는 `ingest-cs.mjs`만 쓴다. 클라이언트 번들에 들어가지 않는지 확인한다.
- 마이그레이션은 OURFLIX 저장소 안에서 실행한다. `SUPABASE_DB_URL`을 이 프로젝트에 두지 않는다.

## 15. 손대지 않는 것

- `lib/srs.ts`의 `DUE_DAYS`와 `nextState` — 간격 규칙은 트랙과 무관하다
- `lib/queue.ts`의 `buildQueue` — 무엇을 외우는지 몰라도 되게 만들어져 있다
- `lib/quiz.ts` 전체 — CS는 선택지를 만들지 않는다
- `contentRepo.fetchContent()`와 `toBundle()`
- `SESSION_SIZE`(토익 10문항)
- `ddt.srs`·`ddt.mastered`의 저장 형식

## 16. 미룬 결정

- **CS 카드 목록 화면** — `/vocab`의 CS 버전. 지금은 필요를 확인하지 못했다.
- **CS 판 크기 조정** — 하루 총 20개가 부담이면 `CS_SESSION_SIZE` 한 줄을 바꾼다.
  사용자에게 5장을 권했으나 10장을 선택했다.
- **트랙별 스트릭** — 사용자가 합친 스트릭을 선택했다. 한 쪽만 계속하고 다른 쪽을 버려도
  숫자가 예뻐서 알아보기 어렵다는 단점을 안고 간다.
- **CS 카드의 4지선다 변형** — 자기채점만으로 부족하다고 느껴지면 그때 검토한다.
- **로그인·서버 저장** — 2026-08-06 스펙 §14 그대로. CS 진도도 이 브라우저에만 남는다.
- **콘텐츠 페이지네이션** — Supabase의 Max rows 한계(약 1000으로 추정, 미확인)에
  `cs_cards`도 같이 걸린다. 증상은 새 콘텐츠가 조용히 안 나오는 것이다.

## 17. 변경 이력

- 2026-08-09 최초 작성. 사용자 결정 7건(카드 형태, 판 구조, 판 크기, 진입 흐름, 스트릭, 초기 콘텐츠, 주제 범위)과 접근법 C 승인 반영.
