'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import { fetchIndex, fetchDay } from '@/lib/contentRepo';
import { getCards, getMastered } from '@/lib/srsRepo';
import { cardKey } from '@/lib/srs';
import { todayStr } from '@/lib/date';
import type { Box, QuizType, SrsCard, MasteredItem, DayContent, DayIndexEntry } from '@/lib/types';

interface LoadedState {
  cards: SrsCard[];
  mastered: MasteredItem[];
  dayContentByDate: Map<string, DayContent | null>;
}

const BOX_LABEL: Record<Box, string> = {
  0: '새로 배움',
  1: '익히는 중',
  2: '거의 외움',
  3: '마지막 확인',
};
const TYPE_LABEL: Record<QuizType, string> = {
  word: '단어',
  blank: '빈칸 채우기',
  arrange: '문장 조합',
};

// SrsCard는 sourceDate를 들고 있으므로 그 날짜의 콘텐츠에서만 찾는다.
function resolveBySourceDate(
  type: QuizType,
  itemId: string,
  sourceDate: string,
  dayContentByDate: Map<string, DayContent | null>,
): string | null {
  const day = dayContentByDate.get(sourceDate);
  if (!day) return null;
  if (type === 'word') {
    const word = day.words.find((w) => w.id === itemId);
    return word ? `${word.word} — ${word.meaning}` : null;
  }
  const sentence = day.sentences.find((s) => s.id === itemId);
  return sentence ? sentence.text : null;
}

// MasteredItem에는 sourceDate가 없으므로 전체 날짜를 훑어 itemId로 찾는다.
function resolveByScanningAllDays(
  type: QuizType,
  itemId: string,
  dayContentByDate: Map<string, DayContent | null>,
): string | null {
  for (const day of dayContentByDate.values()) {
    if (!day) continue;
    if (type === 'word') {
      const word = day.words.find((w) => w.id === itemId);
      if (word) return `${word.word} — ${word.meaning}`;
    } else {
      const sentence = day.sentences.find((s) => s.id === itemId);
      if (sentence) return sentence.text;
    }
  }
  return null;
}

export default function VocabPage() {
  const [state, setState] = useState<LoadedState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchIndex().then(async (index: DayIndexEntry[]) => {
      const contents = await Promise.all(index.map((d) => fetchDay(d.date)));
      if (cancelled) return;
      const dayContentByDate = new Map(index.map((d, i) => [d.date, contents[i]] as const));
      setState({ cards: getCards(), mastered: getMastered(), dayContentByDate });
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

  const { cards, mastered, dayContentByDate } = state;

  if (cards.length === 0 && mastered.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <Nav />
        <div className="flex flex-1 flex-col items-center bg-zinc-50 p-4 dark:bg-black">
          <div className="w-full max-w-xl py-8">
            <h1 className="mb-6 text-2xl font-bold">내 단어장</h1>
            <div className="rounded-2xl border border-gray-200 p-6 text-center dark:border-gray-800">
              <p className="mb-4 text-gray-500 dark:text-gray-400">아직 학습한 단어가 없어요</p>
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
  const sortedCards = [...cards].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const sortedMastered = [...mastered].sort((a, b) => b.masteredAt.localeCompare(a.masteredAt));

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <div className="flex flex-1 flex-col items-center bg-zinc-50 p-4 dark:bg-black">
        <div className="flex w-full max-w-xl flex-col gap-6 py-8">
          <h1 className="text-2xl font-bold">내 단어장</h1>

          <section>
            <h2 className="mb-3 text-lg font-semibold">학습 중</h2>
            {sortedCards.length === 0 ? (
              <EmptyCard text="아직 학습 중인 항목이 없어요" />
            ) : (
              <div className="flex flex-col gap-3">
                {sortedCards.map((card) => {
                  const label = resolveBySourceDate(card.type, card.itemId, card.sourceDate, dayContentByDate);
                  const dueToday = card.dueDate <= today;
                  return (
                    <div
                      key={cardKey(card.type, card.itemId)}
                      className={`rounded-2xl border p-4 ${
                        dueToday
                          ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/40'
                          : 'border-gray-200 dark:border-gray-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`truncate font-semibold ${label ? '' : 'text-gray-400 dark:text-gray-500'}`}>
                            {label ?? '삭제된 콘텐츠'}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {TYPE_LABEL[card.type]} · {BOX_LABEL[card.box]}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={`text-sm font-medium ${
                              dueToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                            }`}
                          >
                            {card.dueDate}
                          </p>
                          {dueToday && (
                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">오늘 복습 예정</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">졸업</h2>
            {sortedMastered.length === 0 ? (
              <EmptyCard text="아직 졸업한 항목이 없어요" />
            ) : (
              <div className="flex flex-col gap-3">
                {sortedMastered.map((item, i) => {
                  const label = resolveByScanningAllDays(item.type, item.itemId, dayContentByDate);
                  return (
                    <div
                      key={`${cardKey(item.type, item.itemId)}-${i}`}
                      className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`truncate font-semibold ${label ? '' : 'text-gray-400 dark:text-gray-500'}`}>
                            {label ?? '삭제된 콘텐츠'}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{TYPE_LABEL[item.type]}</p>
                        </div>
                        <p className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                          {new Date(item.masteredAt).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                    </div>
                  );
                })}
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

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 p-6 text-center text-gray-500 dark:border-gray-800 dark:text-gray-400">
      {text}
    </div>
  );
}
