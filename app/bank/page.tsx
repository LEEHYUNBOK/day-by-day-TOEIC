import Link from 'next/link';
import { connection } from 'next/server';
import { DATA_ROOT } from '@/lib/paths';
import { listQuestions } from '@/lib/questions.mjs';
import { listAttempts } from '@/lib/attempts';
import { questionScore } from '@/lib/scores';
import StudyButton from '@/components/StudyButton';

const SOURCES = { real: '실전', mock: '모의면접', self: '직접 추가', followup: '꼬리질문' } as const;
const SORTS = { todo: '미학습 먼저', pending: '채점 대기 먼저', low: '점수 낮은 순' } as const;
type Sort = keyof typeof SORTS;

export default async function BankPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  await connection(); // 파일을 읽으므로 요청마다 렌더
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');
  const topic = one('topic').normalize('NFC');
  const source = one('source');
  const exp = one('exp') === '1';
  const sort: Sort = Object.hasOwn(SORTS, one('sort')) ? (one('sort') as Sort) : 'todo';

  const all = listQuestions(DATA_ROOT);
  const attempts = listAttempts(DATA_ROOT);
  const topics = [...new Set(all.map((q) => q.topic))].sort();
  const pending = new Set(attempts.filter((a) => a.status === 'pending').map((a) => a.question));

  const rows = all
    .filter((q) => (exp || q.kind !== 'experience') && (!topic || q.topic === topic) && (!source || q.source === source))
    .map((q) => ({ q, s: questionScore(attempts, q.id), p: pending.has(q.id) }));
  // 정렬은 안정 정렬이라 같은 값끼리는 목록 순서가 유지된다.
  if (sort === 'todo') rows.sort((a, b) => Number(a.s !== null) - Number(b.s !== null));
  else if (sort === 'pending') rows.sort((a, b) => Number(b.p) - Number(a.p));
  else rows.sort((a, b) => (a.s?.score ?? 101) - (b.s?.score ?? 101));

  const field = 'rounded border-2 border-[#1c1a17] bg-transparent px-2 py-1 text-sm';
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">질문 은행 <span className="text-sm font-normal opacity-60">{rows.length}개</span></h1>
        <Link href="/bank/new" className="text-sm font-bold text-blue-600 underline">질문 추가</Link>
      </div>
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <select name="topic" defaultValue={topic} className={field} aria-label="토픽">
          <option value="">모든 토픽</option>
          {topics.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select name="source" defaultValue={source} className={field} aria-label="출처">
          <option value="">모든 출처</option>
          {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="sort" defaultValue={sort} className={field} aria-label="정렬">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="exp" value="1" defaultChecked={exp} /> 경험 질문 포함</label>
        <button className="rounded border-2 border-[#1c1a17] px-3 py-1 text-sm font-bold">적용</button>
      </form>
      {rows.length === 0 && <p className="py-8 text-center opacity-70">조건에 맞는 질문이 없어요</p>}
      <ul className="flex flex-col gap-2">
        {rows.map(({ q, s, p }) => (
          <li key={q.id} className="flex items-center gap-3 rounded-lg border-2 border-[#1c1a17] bg-[#fbf9f4] p-3 text-[#1c1a17]">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{q.text}</p>
              <p className="mt-1 text-xs opacity-70">{q.topic} · {SOURCES[q.source]}{q.kind === 'experience' && ' · 경험'}{p && ' · 채점 대기'}</p>
            </div>
            <span className={`w-16 text-right text-sm font-bold ${s?.by === 'self' ? 'opacity-40' : ''}`} title={s?.by === 'self' ? '자기점수' : 'AI 점수'}>
              {s ? `${s.score}점` : '-'}
            </span>
            <StudyButton questionId={q.id} />
          </li>
        ))}
      </ul>
    </main>
  );
}
