'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchIndex } from '@/lib/contentRepo';
import { getDayRecords, calcStreak } from '@/lib/progressRepo';
import { todayStr } from '@/lib/date';
import MonthCalendar from '@/components/MonthCalendar';
import type { DayIndexEntry, DayRecord } from '@/lib/types';

interface LoadedState {
  index: DayIndexEntry[];
  records: Record<string, DayRecord>;
}

export default function HomePage() {
  const router = useRouter();
  const [state, setState] = useState<LoadedState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchIndex().then((index) => {
      if (cancelled) return;
      setState({ index, records: getDayRecords() });
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

  const { index, records } = state;
  const today = todayStr();
  const [year, month] = today.split('-').map(Number);
  const contentDates = new Set(index.map((d) => d.date));
  const doneDates = new Set(Object.keys(records));

  const todayEntry = index.find((d) => d.date === today);
  const todayRecord = records[today];
  const streak = calcStreak(records, today);
  const doneCount = Object.keys(records).length;

  const nextUpEntry = [...index]
    .filter((d) => d.date <= today && !records[d.date])
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 p-4 dark:bg-black">
      <div className="flex w-full max-w-xl flex-col gap-6 py-8">
        <h1 className="text-2xl font-bold">홈</h1>

        {todayEntry && !todayRecord && (
          <div className="rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
            <p className="mb-1 text-sm text-gray-400 dark:text-gray-500">오늘</p>
            <p className="mb-4 text-xl font-semibold">{todayEntry.title}</p>
            <Link
              href={`/learn/${today}`}
              className="flex min-h-14 w-full items-center justify-center rounded-lg bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
            >
              학습 시작
            </Link>
          </div>
        )}

        {todayEntry && todayRecord && (
          <div className="rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
            <p className="mb-1 text-sm text-gray-400 dark:text-gray-500">오늘</p>
            <p className="mb-4 text-xl font-semibold">{todayEntry.title}</p>
            <p className="mb-4 text-4xl font-bold text-blue-600 dark:text-blue-400">
              {Math.round((todayRecord.scores.word + todayRecord.scores.blank + todayRecord.scores.arrange) / 3)}점
            </p>
            <Link
              href={`/learn/${today}`}
              className="flex min-h-14 w-full items-center justify-center rounded-lg border-2 border-gray-200 text-lg font-medium dark:border-gray-700"
            >
              다시 학습
            </Link>
          </div>
        )}

        {!todayEntry && (
          <div className="rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
            <p className="mb-4 text-lg text-gray-500 dark:text-gray-400">오늘 콘텐츠가 없어요</p>
            {nextUpEntry ? (
              <>
                <p className="mb-1 text-sm text-gray-400 dark:text-gray-500">가장 최근에 놓친 학습</p>
                <p className="mb-4 text-xl font-semibold">{nextUpEntry.title}</p>
                <Link
                  href={`/learn/${nextUpEntry.date}`}
                  className="flex min-h-14 w-full items-center justify-center rounded-lg bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
                >
                  학습 시작
                </Link>
              </>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">놓친 학습이 없어요</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
          <div>
            <p className="text-sm text-gray-400 dark:text-gray-500">연속 학습</p>
            <p className="text-3xl font-bold">🔥 {streak}일 연속</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400 dark:text-gray-500">누적 완료</p>
            <p className="text-3xl font-bold">{doneCount}일</p>
          </div>
        </div>

        <MonthCalendar
          year={year}
          month={month}
          contentDates={contentDates}
          doneDates={doneDates}
          today={today}
          onSelect={(date) => router.push(`/learn/${date}`)}
          compact
        />
      </div>
    </div>
  );
}
