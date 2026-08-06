'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchIndex, fetchDay } from '@/lib/contentRepo';
import { getCards, getMasteredKeys, countDueOn } from '@/lib/srsRepo';
import { buildQueue } from '@/lib/queue';
import { buildWordQuiz, buildBlankQuiz, buildArrangeQuiz } from '@/lib/quiz';
import { todayStr, addDays } from '@/lib/date';
import type { CardIdentity } from '@/lib/srs';
import type { DayContent } from '@/lib/types';
import GameRunner, { type GameItem } from '@/components/GameRunner';

interface Session {
  items: GameItem[];
  today: string;
  dueTomorrowBefore: number;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'empty'; dueTomorrow: number }
  | { status: 'ready'; session: Session };

export default function HomePage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [seed, setSeed] = useState(0);

  // '한 판 더'가 호출한다: 큐를 다시 구성해 새 판을 시작한다.
  const restart = useCallback(() => {
    setState({ status: 'loading' });
    setSeed((s) => s + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const index = await fetchIndex();
      const days = await Promise.all(index.map((d) => fetchDay(d.date)));
      const dayContents = days.filter((d): d is DayContent => d !== null);
      const dayByDate = new Map(dayContents.map((d) => [d.date, d]));

      // 전체 후보를 day 파일 순서로 평탄화한다: 한 날짜 안에서는 단어 전부 -> blank -> arrange.
      const candidates: CardIdentity[] = [];
      for (const day of dayContents) {
        for (const w of day.words) {
          candidates.push({ itemId: w.id, type: 'word', sourceDate: day.date });
        }
        for (const s of day.sentences) {
          candidates.push({ itemId: s.id, type: 'blank', sourceDate: day.date });
          candidates.push({ itemId: s.id, type: 'arrange', sourceDate: day.date });
        }
      }

      // buildWordQuiz는 서로 다른 뜻 3개를 pool에서 못 찾으면 예외를 던진다.
      // 항상 전체 14일치 단어(140개)를 pool로 넘긴다.
      const fullWordPool = dayContents.flatMap((d) => d.words);

      const today = todayStr();
      const cards = getCards();
      const masteredKeys = getMasteredKeys();
      const queue = buildQueue(cards, candidates, masteredKeys, today);

      const items: GameItem[] = [];
      for (const identity of queue) {
        const day = dayByDate.get(identity.sourceDate);
        if (!day) continue; // 콘텐츠가 지워진 경우 조용히 건너뛴다

        if (identity.type === 'word') {
          const word = day.words.find((w) => w.id === identity.itemId);
          if (!word) continue;
          items.push({ identity, quiz: buildWordQuiz([word], fullWordPool)[0], word });
        } else if (identity.type === 'blank') {
          const sentence = day.sentences.find((s) => s.id === identity.itemId);
          if (!sentence) continue;
          items.push({ identity, quiz: buildBlankQuiz([sentence])[0], sentence });
        } else {
          const sentence = day.sentences.find((s) => s.id === identity.itemId);
          if (!sentence) continue;
          items.push({ identity, quiz: buildArrangeQuiz([sentence])[0], sentence });
        }
      }

      if (cancelled) return;

      if (items.length === 0) {
        setState({ status: 'empty', dueTomorrow: countDueOn(cards, addDays(today, 1)) });
        return;
      }

      setState({
        status: 'ready',
        session: { items, today, dueTomorrowBefore: countDueOn(cards, addDays(today, 1)) },
      });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [seed]);

  if (state.status === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
      </div>
    );
  }

  if (state.status === 'empty') {
    return (
      <div className="flex flex-1 flex-col items-center bg-zinc-50 p-4 dark:bg-black">
        <div className="flex w-full max-w-xl flex-col gap-6 py-8">
          <div className="rounded-2xl border border-gray-200 p-6 text-center dark:border-gray-800">
            <p className="mb-2 text-xl font-semibold">오늘 할 게 없어요</p>
            <p className="mb-6 text-gray-500 dark:text-gray-400">
              내일 {state.dueTomorrow}개 볼 예정이에요
            </p>
            <Link
              href="/stats"
              className="flex min-h-14 w-full items-center justify-center rounded-lg border-2 border-gray-200 text-lg font-medium dark:border-gray-700"
            >
              통계 보기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GameRunner
      key={seed}
      items={state.session.items}
      today={state.session.today}
      dueTomorrowBefore={state.session.dueTomorrowBefore}
      onExit={() => router.push('/stats')}
      onRestart={restart}
    />
  );
}
