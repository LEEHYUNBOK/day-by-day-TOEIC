import Link from 'next/link';
import { connection } from 'next/server';
import { DATA_ROOT } from '@/lib/paths';
import { listAttempts, today } from '@/lib/attempts';
import { dayStats } from '@/lib/scores';

const WEEK = ['월', '화', '수', '목', '금', '토', '일'];
// 시도 횟수 0, 1, 2, 3+ 네 단계
const SHADE = ['bg-[#fbf9f4]', 'bg-[#cfe8df]', 'bg-[#7fc3ae]', 'bg-[#2f9c80]'];
const pad = (n: number) => String(n).padStart(2, '0');

export default async function HomePage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  await connection(); // 파일을 읽으므로 요청마다 렌더
  const { m } = await searchParams;
  const now = today();
  const ok = typeof m === 'string' && /^(\d{4})-(0[1-9]|1[0-2])$/.test(m);
  const [y, mo] = (ok ? m : now.slice(0, 7)).split('-').map(Number);
  const ym = (yy: number, mm: number) => { const d = new Date(yy, mm - 1, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };

  const stats = dayStats(listAttempts(DATA_ROOT));
  const lead = (new Date(y, mo - 1, 1).getDay() + 6) % 7; // 월요일 시작
  const days = new Date(y, mo, 0).getDate();
  const cells = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">{y}년 {mo}월</h1>
        <div className="flex items-center gap-3 text-sm font-bold">
          <Link href={`/?m=${ym(y, mo - 1)}`} className="text-blue-600 underline">이전 달</Link>
          <Link href="/" className="text-blue-600 underline">이번 달</Link>
          <Link href={`/?m=${ym(y, mo + 1)}`} className="text-blue-600 underline">다음 달</Link>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold opacity-70">
        {WEEK.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const date = `${y}-${pad(mo)}-${pad(d)}`;
          const s = stats[date];
          return (
            <Link
              key={date}
              href={`/day/${date}`}
              title={s ? `${s.count}번 공부` : undefined}
              className={`flex aspect-square flex-col justify-between rounded border-2 p-1 text-xs text-[#1c1a17] ${SHADE[Math.min(s?.count ?? 0, 3)]} ${date === now ? 'border-[#0b5d4b] outline-2 outline-[#0b5d4b]' : 'border-[#1c1a17]/30'}`}
            >
              <span className="font-bold">{d}</span>
              {s && <span className="self-end text-sm font-bold">{s.avg ?? '-'}</span>}
            </Link>
          );
        })}
      </div>
      <p className="mt-2 text-xs opacity-60">칸 색은 그날 공부한 횟수, 숫자는 평균 점수예요.</p>
      <Link href="/bank" className="mt-6 inline-block rounded-lg border-2 border-[#1c1a17] bg-[#fbf9f4] px-4 py-2 font-bold text-[#1c1a17]">
        오늘의 질문 고르기
      </Link>
    </main>
  );
}
