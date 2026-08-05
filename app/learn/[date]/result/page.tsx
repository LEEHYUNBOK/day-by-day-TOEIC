'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import type { LastResult } from '@/components/SessionRunner';

const TYPE_LABEL: Record<'word' | 'blank' | 'arrange', string> = {
  word: '단어',
  blank: '빈칸 채우기',
  arrange: '문장 조합',
};

function subscribeNever() {
  return () => {};
}
function getSnapshot() {
  return sessionStorage.getItem('ddt.lastResult');
}
function getServerSnapshot() {
  return null;
}

export default function ResultPage() {
  // sessionStorage는 서버에 없는 외부 저장소이므로 useSyncExternalStore로 읽는다
  // (SSR 스냅샷은 null, 클라이언트 마운트 후 실제 값으로 자동 동기화됨).
  const raw = useSyncExternalStore(subscribeNever, getSnapshot, getServerSnapshot);
  const result = raw ? (JSON.parse(raw) as LastResult) : null;

  if (!result) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <p className="text-gray-500 dark:text-gray-400">결과 정보가 없어요</p>
        <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">
          홈으로
        </Link>
      </div>
    );
  }

  const { scores, wrongs } = result;
  const overall = Math.round((scores.word + scores.blank + scores.arrange) / 3);

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 p-4 dark:bg-black">
      <div className="w-full max-w-xl py-8">
        <h1 className="mb-2 text-center text-2xl font-bold">학습 완료!</h1>
        <p className="mb-8 text-center text-5xl font-bold text-blue-600 dark:text-blue-400">{overall}점</p>

        <div className="mb-8 grid grid-cols-3 gap-3">
          <ScoreTile label="단어" score={scores.word} />
          <ScoreTile label="빈칸 채우기" score={scores.blank} />
          <ScoreTile label="문장 조합" score={scores.arrange} />
        </div>

        {wrongs.length > 0 && (
          <div className="mb-8 rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
            <p className="mb-4 font-semibold">틀린 문항 ({wrongs.length}개)</p>
            <ul className="mb-4 flex flex-col gap-2">
              {wrongs.map((w, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span>{w.label}</span>
                  <span className="text-gray-400 dark:text-gray-500">{TYPE_LABEL[w.type]}</span>
                </li>
              ))}
            </ul>
            <Link href="/notes" className="text-xs text-gray-400 underline hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
              오답노트에 저장됨
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/"
            className="flex min-h-14 items-center justify-center rounded-lg border-2 border-gray-200 text-lg font-medium dark:border-gray-700"
          >
            홈으로
          </Link>
          <Link
            href={`/learn/${result.date}`}
            className="flex min-h-14 items-center justify-center rounded-lg bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
          >
            다시 학습
          </Link>
        </div>
      </div>
    </div>
  );
}

function ScoreTile({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 p-4 text-center dark:border-gray-800">
      <p className="text-sm text-gray-400 dark:text-gray-500">{label}</p>
      <p className="text-2xl font-bold">{score}</p>
    </div>
  );
}
