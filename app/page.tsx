'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchContent } from '@/lib/contentRepo';
import { getCards, getMasteredKeys, countDueOn } from '@/lib/srsRepo';
import { buildQueue } from '@/lib/queue';
import { buildWordQuiz, buildBlankQuiz, buildArrangeQuiz } from '@/lib/quiz';
import { todayStr, addDays } from '@/lib/date';
import GameRunner, { type GameItem } from '@/components/GameRunner';

interface Session {
  items: GameItem[];
  today: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'no-content' }
  | { status: 'empty'; dueTomorrow: number; nextDueDate: string | null }
  | { status: 'ready'; session: Session };

function formatMonthDay(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}월 ${Number(d)}일`;
}

export default function HomePage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [seed, setSeed] = useState(0);

  // '한 판 더'와 오류 화면의 '다시 시도' 모두 이걸 호출한다: 큐를 다시 구성해 새 판을 시작한다.
  const restart = useCallback(() => {
    setState({ status: 'loading' });
    setSeed((s) => s + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const bundle = await fetchContent();
        if (cancelled) return;

        if (bundle === null) {
          setState({ status: 'error' });
          return;
        }

        if (bundle.words.length === 0 && bundle.sentences.length === 0) {
          setState({ status: 'no-content' });
          return;
        }

        const wordById = new Map(bundle.words.map((w) => [w.id, w]));
        const sentenceById = new Map(bundle.sentences.map((s) => [s.id, s]));

        const today = todayStr();
        const cards = getCards();
        const masteredKeys = getMasteredKeys();
        const queue = buildQueue(cards, bundle.candidates, masteredKeys, today);

        const items: GameItem[] = [];
        for (const identity of queue) {
          if (identity.type === 'word') {
            const word = wordById.get(identity.itemId);
            if (!word) continue; // 콘텐츠가 지워진 경우 조용히 건너뛴다
            // buildWordQuiz는 서로 다른 뜻 3개를 pool에서 못 찾으면 예외를 던진다.
            // 항상 전체 단어(140개)를 pool로 넘긴다.
            items.push({ identity, quiz: buildWordQuiz([word], bundle.words)[0], word });
          } else if (identity.type === 'blank') {
            const sentence = sentenceById.get(identity.itemId);
            if (!sentence) continue;
            items.push({ identity, quiz: buildBlankQuiz([sentence])[0], sentence });
          } else {
            const sentence = sentenceById.get(identity.itemId);
            if (!sentence) continue;
            items.push({ identity, quiz: buildArrangeQuiz([sentence])[0], sentence });
          }
        }

        if (cancelled) return;

        if (items.length === 0) {
          const nextDueDate =
            cards.length > 0 ? cards.reduce((min, c) => (c.dueDate < min ? c.dueDate : min), cards[0].dueDate) : null;
          setState({ status: 'empty', dueTomorrow: countDueOn(cards, addDays(today, 1)), nextDueDate });
          return;
        }

        setState({ status: 'ready', session: { items, today } });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
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

  if (state.status === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center bg-zinc-50 p-4 dark:bg-black">
        <div className="flex w-full max-w-xl flex-col gap-6 py-8">
          <div className="rounded-2xl border border-gray-200 p-6 text-center dark:border-gray-800">
            <p className="mb-2 text-xl font-semibold">불러오지 못했어요</p>
            <p className="mb-6 text-gray-500 dark:text-gray-400">
              네트워크 상태를 확인하고 다시 시도해주세요
            </p>
            <button
              type="button"
              onClick={restart}
              className="flex min-h-14 w-full items-center justify-center rounded-lg bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === 'no-content') {
    return (
      <div className="flex flex-1 flex-col items-center bg-zinc-50 p-4 dark:bg-black">
        <div className="flex w-full max-w-xl flex-col gap-6 py-8">
          <div className="rounded-2xl border border-gray-200 p-6 text-center dark:border-gray-800">
            <p className="mb-2 text-xl font-semibold">아직 학습할 내용이 없어요</p>
          </div>
        </div>
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
              {state.nextDueDate === null
                ? '모든 단어를 다 익혔어요'
                : state.dueTomorrow > 0
                  ? `내일 ${state.dueTomorrow}개 볼 예정이에요`
                  : `다음 복습은 ${formatMonthDay(state.nextDueDate)}이에요`}
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
      onExit={() => router.push('/stats')}
      onRestart={restart}
    />
  );
}
