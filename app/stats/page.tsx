'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import { getCards, getMastered, getSessions, calcStreak, countDueOn } from '@/lib/srsRepo';
import { todayStr, addDays } from '@/lib/date';
import type { Box, SrsCard, MasteredItem, SessionRecord } from '@/lib/types';

const BOX_LABEL: Record<Box, string> = {
  0: '기초 단계',
  1: '익히는 중',
  2: '거의 외움',
  3: '마지막 확인',
};
const BOXES: Box[] = [0, 1, 2, 3];

interface LoadedState {
  cards: SrsCard[];
  mastered: MasteredItem[];
  sessions: SessionRecord[];
}

export default function StatsPage() {
  const [state, setState] = useState<LoadedState | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setState({ cards: getCards(), mastered: getMastered(), sessions: getSessions() });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) {
    return (
      <div className="flex flex-1 flex-col">
        <Nav />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
        </div>
      </div>
    );
  }

  const { cards, mastered, sessions } = state;

  if (cards.length === 0 && mastered.length === 0 && sessions.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <Nav />
        <div className="flex flex-1 flex-col items-center bg-zinc-50 p-4 dark:bg-black">
          <div className="w-full max-w-xl py-8">
            <h1 className="mb-6 text-2xl font-bold">통계</h1>
            <div className="rounded-2xl border border-gray-200 p-6 text-center dark:border-gray-800">
              <p className="mb-4 text-gray-500 dark:text-gray-400">아직 학습 기록이 없어요</p>
              <Link
                href="/"
                className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                게임 하러 가기
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const today = todayStr();
  const streak = calcStreak(sessions, today);
  const dueToday = countDueOn(cards, today);
  const dueTomorrow = countDueOn(cards, addDays(today, 1));

  const boxCounts: Record<Box, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const c of cards) boxCounts[c.box] += 1;
  const maxBoxCount = Math.max(1, ...BOXES.map((b) => boxCounts[b]));

  const sortedSessions = [...sessions].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <div className="flex flex-1 flex-col items-center bg-zinc-50 p-4 dark:bg-black">
        <div className="flex w-full max-w-xl flex-col gap-6 py-8">
          <h1 className="text-2xl font-bold">통계</h1>

          <div className="grid grid-cols-3 gap-3">
            <SummaryTile label="연속 학습" value={`🔥 ${streak}일`} />
            <SummaryTile label="졸업한 단어" value={`${mastered.length}개`} />
            <SummaryTile label="학습 중" value={`${cards.length}개`} />
            <SummaryTile label="오늘 복습 예정" value={`${dueToday}개`} />
            <SummaryTile label="내일 예정" value={`${dueTomorrow}개`} />
          </div>

          <section>
            <h2 className="mb-3 text-lg font-semibold">단계별 분포</h2>
            <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
              {BOXES.map((box) => (
                <StageBar key={box} label={BOX_LABEL[box]} count={boxCounts[box]} max={maxBoxCount} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">세션 기록</h2>
            {sortedSessions.length === 0 ? (
              <EmptyCard text="아직 완료한 판이 없어요" />
            ) : (
              <div className="flex flex-col gap-2">
                {sortedSessions.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-2xl border border-gray-200 p-4 dark:border-gray-800"
                  >
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      {new Date(s.finishedAt).toLocaleString('ko-KR')}
                    </p>
                    <p className="text-xl font-bold">
                      {s.correct} / {s.total}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 p-4 text-center dark:border-gray-800">
      <p className="mb-1 text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function StageBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max === 0 ? 0 : (count / max) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-gray-400 dark:text-gray-500">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-gray-100 dark:bg-gray-800">
        <div className="h-2 rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-medium">{count}</span>
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
