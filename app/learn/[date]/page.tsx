'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchDay } from '@/lib/contentRepo';
import type { DayContent } from '@/lib/types';
import SessionRunner from '@/components/SessionRunner';

interface FetchState {
  date: string;
  day: DayContent | null;
}

export default function LearnPage() {
  const { date } = useParams<{ date: string }>();
  const [fetched, setFetched] = useState<FetchState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDay(date).then((d) => {
      if (!cancelled) setFetched({ date, day: d });
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  // fetched가 이전 date의 결과일 수 있으므로(예: date가 바뀐 직후) 항상 date와 대조한다.
  const day = fetched?.date === date ? fetched.day : undefined;

  if (day === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
      </div>
    );
  }

  if (day === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-lg text-gray-500 dark:text-gray-400">이 날은 콘텐츠가 없어요</p>
        <Link href="/calendar" className="text-blue-600 hover:underline dark:text-blue-400">
          달력으로 가기
        </Link>
      </div>
    );
  }

  return <SessionRunner day={day} />;
}
