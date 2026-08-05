'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchIndex, fetchDay } from '@/lib/contentRepo';
import { getDayRecords, getReviewRecords, calcStreak } from '@/lib/progressRepo';
import { todayStr } from '@/lib/date';
import type { DayIndexEntry, DayRecord, ReviewRecord } from '@/lib/types';

const SCOPE_LABEL: Record<ReviewRecord['scope'], string> = {
  recent7: '최근 7일',
  all: '전체',
  wrong: '오답만',
};

interface LoadedState {
  index: DayIndexEntry[];
  records: Record<string, DayRecord>;
  reviewRecords: ReviewRecord[];
  wordCountByDate: Map<string, number>;
}

export default function StatsPage() {
  const [state, setState] = useState<LoadedState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchIndex().then(async (index) => {
      const records = getDayRecords();
      const doneDates = Object.keys(records);
      const contents = await Promise.all(doneDates.map((date) => fetchDay(date)));
      if (cancelled) return;
      const wordCountByDate = new Map(doneDates.map((date, i) => [date, contents[i]?.words.length ?? 0] as const));
      setState({
        index,
        records,
        reviewRecords: getReviewRecords(),
        wordCountByDate,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
      </div>
    );
  }

  const { index, records, reviewRecords, wordCountByDate } = state;
  const titleByDate = new Map(index.map((d) => [d.date, d.title] as const));
  const streak = calcStreak(records, todayStr());
  const doneCount = Object.keys(records).length;
  const totalWords = [...wordCountByDate.values()].reduce((sum, n) => sum + n, 0);

  const dayRows = Object.values(records).sort((a, b) => b.date.localeCompare(a.date));
  const reviewRows = [...reviewRecords].sort((a, b) => b.takenAt.localeCompare(a.takenAt));

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 p-4 dark:bg-black">
      <div className="flex w-full max-w-xl flex-col gap-6 py-8">
        <h1 className="text-2xl font-bold">통계</h1>

        <div className="grid grid-cols-3 gap-3">
          <SummaryTile label="연속 학습" value={`🔥 ${streak}일`} />
          <SummaryTile label="완료일" value={`${doneCount}일`} />
          <SummaryTile label="누적 단어" value={`${totalWords}개`} />
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">날짜별 정답률</h2>
          {dayRows.length === 0 ? (
            <EmptyCard text="아직 완료한 학습이 없어요" />
          ) : (
            <div className="flex flex-col gap-3">
              {dayRows.map((r) => {
                const avg = Math.round((r.scores.word + r.scores.blank + r.scores.arrange) / 3);
                return (
                  <div key={r.date} className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400 dark:text-gray-500">{r.date}</p>
                        <p className="font-semibold">{titleByDate.get(r.date) ?? r.date}</p>
                      </div>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{avg}점</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <ScoreBar label="단어" score={r.scores.word} />
                      <ScoreBar label="빈칸 채우기" score={r.scores.blank} />
                      <ScoreBar label="문장 조합" score={r.scores.arrange} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">복습 기록</h2>
          {reviewRows.length === 0 ? (
            <EmptyCard text="아직 복습 기록이 없어요" />
          ) : (
            <div className="flex flex-col gap-2">
              {reviewRows.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-2xl border border-gray-200 p-4 dark:border-gray-800"
                >
                  <div>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      {new Date(r.takenAt).toLocaleString('ko-KR')}
                    </p>
                    <p className="font-semibold">{SCOPE_LABEL[r.scope]}</p>
                  </div>
                  <p className="text-xl font-bold">
                    {r.correct} / {r.total}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 p-4 text-center dark:border-gray-800">
      <p className="mb-1 text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-gray-400 dark:text-gray-500">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className="h-2 rounded-full bg-blue-600 dark:bg-blue-400"
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-medium">{score}</span>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 p-6 text-center text-gray-500 dark:border-gray-800 dark:text-gray-400">
      {text}
    </div>
  );
}
