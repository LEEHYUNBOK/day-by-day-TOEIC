import Link from 'next/link';
import { connection } from 'next/server';
import { DATA_ROOT } from '@/lib/paths';
import { listAttempts } from '@/lib/attempts';
import { readQuestion } from '@/lib/questions.mjs';
import { attemptScore } from '@/lib/scores';
import { readRetro } from '@/lib/retro';
import RetroEditor from '@/components/RetroEditor';

const STATUS = { draft: '작성 중', pending: '채점 대기', graded: '채점 완료' } as const;

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  await connection(); // 파일을 읽으므로 요청마다 렌더
  const { date: raw } = await params;
  const date = decodeURIComponent(raw);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <p className="text-lg font-semibold">올바르지 않은 날짜예요</p>
        <Link href="/" className="text-blue-600 underline">홈으로</Link>
      </main>
    );
  }

  const attempts = listAttempts(DATA_ROOT).filter((a) => a.date === date);
  const retro = readRetro(DATA_ROOT, date);
  const empty = attempts.length === 0 && !retro.read && !retro.dev && !retro.retro;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">{date}</h1>
        <Link href={`/?m=${date.slice(0, 7)}`} className="text-sm font-bold text-blue-600 underline">달력으로</Link>
      </div>
      {empty && <p className="py-4 opacity-70">이 날은 아직 기록이 없어요</p>}
      <ul className="flex flex-col gap-2">
        {attempts.map((a) => {
          const q = readQuestion(DATA_ROOT, a.question);
          const s = attemptScore(a);
          const min = a.minutes ?? Math.round(a.seconds / 60);
          return (
            <li key={a.path}>
              <Link href={`/study?a=${encodeURIComponent(a.path)}`} className="flex items-center gap-3 rounded-lg border-2 border-[#1c1a17] bg-[#fbf9f4] p-3 text-[#1c1a17]">
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold ${q ? '' : 'italic opacity-60'}`}>{q ? q.text : '삭제된 질문'}</p>
                  <p className="mt-1 text-xs opacity-70">{STATUS[a.status]} · {min}분</p>
                </div>
                <span className={`text-sm font-bold ${s?.by === 'self' ? 'opacity-40' : ''}`} title={s?.by === 'self' ? '자기점수' : 'AI 점수'}>
                  {s ? `${s.score}점` : '-'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <RetroEditor key={date} date={date} initial={retro} />
    </main>
  );
}
