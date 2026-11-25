import Link from 'next/link';
import { connection } from 'next/server';
import { DATA_ROOT } from '@/lib/paths';
import { listQuestions } from '@/lib/questions.mjs';
import { listAttempts } from '@/lib/attempts';
import { topicAverages, illusion } from '@/lib/scores';
import { BarChart, LineChart, Legend } from '@/components/charts';

export default async function GraphPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  await connection(); // 파일을 읽으므로 요청마다 렌더
  const sp = await searchParams;
  const qParam = typeof sp.q === 'string' ? sp.q.normalize('NFC') : '';

  const questions = listQuestions(DATA_ROOT);
  const attempts = listAttempts(DATA_ROOT);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const topics = topicAverages(questions, attempts).sort((a, b) => a.topic.localeCompare(b.topic));
  const ill = attempts
    .map((a) => ({ a, d: illusion(a) }))
    .filter((r): r is { a: typeof r.a; d: number } => r.d !== null)
    .sort((x, y) => y.d - x.d);
  const picked = byId.get(qParam);
  const mine = picked ? attempts.filter((a) => a.question === picked.id && a.status !== 'draft') : [];
  const asked = [...new Set(attempts.filter((a) => a.status !== 'draft').map((a) => a.question))].filter((id) => byId.has(id));

  const card = 'rounded-lg border-2 border-[#1c1a17] bg-[#fbf9f4] p-3 text-[#1c1a17]';
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <h1 className="mb-3 text-xl font-bold">그래프</h1>
      {topics.length === 0 && ill.length === 0 && asked.length === 0 ? (
        <p className="py-8 text-center opacity-70">아직 점수가 있는 시도가 없어요. 질문을 공부하고 제출하면 여기에 쌓여요.</p>
      ) : (
        <div className="flex flex-col gap-5">
          <section>
            <h2 className="mb-2 font-bold">토픽별 평균 점수</h2>
            <div className={card}>{topics.length ? <BarChart rows={topics.map((t) => ({ label: t.topic, value: t.avg, n: t.n }))} /> : <p className="opacity-70">점수가 있는 질문이 없어요</p>}</div>
          </section>

          <section>
            <h2 className="mb-1 font-bold">착각 지수 <span className="text-sm font-normal opacity-60">자기점수 − AI 점수, 큰 순</span></h2>
            {ill.length === 0 ? <p className="opacity-70">채점이 끝난 시도가 없어요</p> : (
              <ul className="flex flex-col gap-2">
                {ill.map(({ a, d }) => (
                  <li key={a.path}>
                    <Link href={`/study?a=${encodeURIComponent(a.path)}`} className={`${card} flex items-center gap-3`}>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{byId.get(a.question)?.text ?? '삭제된 질문'}</span>
                        <span className="text-xs opacity-70">{a.date} · 자기 {a.self_score}점 · AI {a.ai_score}점</span>
                      </span>
                      <span className="w-14 text-right font-bold" title="착각 지수">{d > 0 ? `+${d}` : d}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 font-bold">질문별 추이</h2>
            <form className="mb-2 flex gap-2">
              <select name="q" defaultValue={picked?.id ?? ''} className="min-w-0 flex-1 rounded border-2 border-[#1c1a17] bg-transparent px-2 py-1 text-sm" aria-label="질문">
                <option value="">질문 선택</option>
                {asked.map((id) => <option key={id} value={id}>{byId.get(id)!.text}</option>)}
              </select>
              <button className="rounded border-2 border-[#1c1a17] px-3 py-1 text-sm font-bold">보기</button>
            </form>
            {picked && (
              <div className={`${card} flex flex-col gap-2`}>
                <p className="font-semibold">{picked.text}</p>
                {mine.length === 0 ? <p className="opacity-70">제출한 시도가 없어요</p> : (
                  <>
                    <Legend />
                    <LineChart points={mine.map((a, i) => ({ label: `${i + 1}회 ${a.date.slice(5)}`, self: a.self_score, ai: a.ai_score }))} />
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
