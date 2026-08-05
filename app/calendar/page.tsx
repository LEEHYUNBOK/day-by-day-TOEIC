'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchIndex } from '@/lib/contentRepo';
import { getDayRecords } from '@/lib/progressRepo';
import { todayStr } from '@/lib/date';
import MonthCalendar from '@/components/MonthCalendar';
import type { DayIndexEntry, DayRecord } from '@/lib/types';

interface LoadedState {
  index: DayIndexEntry[];
  records: Record<string, DayRecord>;
}

interface YearMonth {
  year: number;
  month: number; // 1~12
}

export default function CalendarPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadedState | null>(null);
  const [ym, setYm] = useState<YearMonth>(() => {
    const [year, month] = todayStr().split('-').map(Number);
    return { year, month };
  });

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

  function goPrevMonth() {
    setYm(({ year, month }) => (month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }));
  }
  function goNextMonth() {
    setYm(({ year, month }) => (month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }));
  }

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
      </div>
    );
  }

  const contentDates = new Set(state.index.map((d) => d.date));
  const doneDates = new Set(Object.keys(state.records));

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 p-4 dark:bg-black">
      <div className="flex w-full max-w-xl flex-col gap-4 py-8">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={goPrevMonth}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="이전 달"
          >
            ◀
          </button>
          <h1 className="text-xl font-bold">
            {ym.year}년 {ym.month}월
          </h1>
          <button
            type="button"
            onClick={goNextMonth}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="다음 달"
          >
            ▶
          </button>
        </div>

        <MonthCalendar
          year={ym.year}
          month={ym.month}
          contentDates={contentDates}
          doneDates={doneDates}
          today={todayStr()}
          onSelect={(date) => router.push(`/learn/${date}`)}
        />
      </div>
    </div>
  );
}
