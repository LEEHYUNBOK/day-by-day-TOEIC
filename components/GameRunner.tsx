'use client';

import { useState } from 'react';
import Link from 'next/link';
import QuizCard from './QuizCard';
import ArrangeCard from './ArrangeCard';
import { cardKey, type CardIdentity } from '@/lib/srs';
import { commitSession, getCards, countDueOn, type AnsweredItem } from '@/lib/srsRepo';
import { addDays } from '@/lib/date';
import type { QuizItem } from '@/lib/quiz';
import type { Word, Sentence } from '@/lib/types';

export interface GameItem {
  identity: CardIdentity;
  quiz: QuizItem;
  word?: Word;
  sentence?: Sentence;
}

interface GameRunnerProps {
  items: GameItem[];
  today: string;
  onExit: () => void;
  onRestart: () => void;
}

type Phase = 'quiz' | 'result';

export default function GameRunner({ items, today, onExit, onRestart }: GameRunnerProps) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<AnsweredItem[]>([]);
  const [phase, setPhase] = useState<Phase>('quiz');
  const [masteredCount, setMasteredCount] = useState(0);
  const [dueTomorrow, setDueTomorrow] = useState(0);

  const current = items[idx];

  function handleExit() {
    if (answers.length > 0 && !window.confirm('지금 나가면 이번 판 답이 사라져요. 나갈까요?')) {
      return;
    }
    onExit();
  }

  function handleAnswer(correct: boolean) {
    // 스테일 상태 함정: 마지막 문항에서 setAnswers 이후 answers를 읽으면 방금 답이 빠진다.
    // finalAnswers를 지역 변수로 만들어 setAnswers와 커밋에 같은 값을 쓴다.
    const finalAnswers: AnsweredItem[] = [...answers, { identity: current.identity, correct }];
    setAnswers(finalAnswers);

    if (idx + 1 < items.length) {
      setIdx(idx + 1);
      return;
    }

    const { masteredCount: mastered } = commitSession(finalAnswers, today, new Date().toISOString());
    setMasteredCount(mastered);
    setDueTomorrow(countDueOn(getCards(), addDays(today, 1)));
    setPhase('result');
  }

  if (phase === 'result') {
    const correct = answers.filter((a) => a.correct).length;
    const total = answers.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const wrongItems = items.filter((it) =>
      answers.some(
        (a) => !a.correct && a.identity.type === it.identity.type && a.identity.itemId === it.identity.itemId,
      ),
    );

    return (
      <div className="flex flex-1 flex-col items-center bg-zinc-50 p-4 dark:bg-black">
        <div className="flex w-full max-w-xl flex-col gap-6 py-8">
          <div className="rounded-2xl border border-gray-200 p-6 text-center dark:border-gray-800">
            {masteredCount > 0 && (
              <p className="mb-3 text-sm font-semibold text-blue-600 dark:text-blue-400">
                {masteredCount}개 졸업했어요
              </p>
            )}
            <p className="text-sm text-gray-400 dark:text-gray-500">정답률</p>
            <p className="mb-2 text-5xl font-bold text-blue-600 dark:text-blue-400">{accuracy}%</p>
            <p className="text-gray-500 dark:text-gray-400">
              {correct} / {total} 정답
            </p>
          </div>

          {wrongItems.length > 0 && (
            <div className="rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
              <p className="mb-3 text-sm text-gray-400 dark:text-gray-500">틀린 항목</p>
              <ul className="flex flex-col gap-2">
                {wrongItems.map((it) => (
                  <li key={cardKey(it.identity.type, it.identity.itemId)} className="text-base">
                    {it.word ? `${it.word.word} — ${it.word.meaning}` : it.sentence?.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 p-6 text-center dark:border-gray-800">
            <p className="text-lg font-medium">내일 볼 단어 {dueTomorrow}개</p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={onRestart}
              className="min-h-14 w-full rounded-lg bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
            >
              한 판 더
            </button>
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

  const progress = ((idx + 1) / items.length) * 100;

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 p-4 dark:bg-black">
      <div className="flex w-full max-w-xl flex-col gap-4 py-8">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400 dark:text-gray-500">
            {idx + 1} / {items.length}
          </span>
          <button
            type="button"
            onClick={handleExit}
            className="text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            나가기
          </button>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>

        {renderQuiz(current, handleAnswer)}
      </div>
    </div>
  );
}

function renderQuiz(item: GameItem, onNext: (correct: boolean) => void) {
  const key = cardKey(item.identity.type, item.identity.itemId);

  if (item.quiz.type === 'word' && item.word) {
    const w = item.word;
    return (
      <QuizCard
        key={key}
        prompt={w.word}
        subPrompt={w.pos}
        choices={item.quiz.choices}
        onNext={onNext}
        explanation={
          <div className="text-left">
            <p className="font-semibold">
              {w.word}{' '}
              <span className="text-sm font-normal text-gray-400 dark:text-gray-500">{w.pos}</span>
            </p>
            <p className="mt-1 text-blue-600 dark:text-blue-400">{w.meaning}</p>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{w.example}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">{w.exampleKo}</p>
          </div>
        }
      />
    );
  }

  if (item.quiz.type === 'blank' && item.sentence) {
    const s = item.sentence;
    return (
      <QuizCard
        key={key}
        prompt={item.quiz.blankedText}
        choices={item.quiz.choices}
        onNext={onNext}
        explanation={
          <div className="text-left">
            <p className="font-medium">{s.text}</p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">{s.ko}</p>
          </div>
        }
      />
    );
  }

  if (item.quiz.type === 'arrange' && item.sentence) {
    return (
      <ArrangeCard
        key={key}
        ko={item.sentence.ko}
        tokens={item.quiz.tokens}
        answerTokens={item.quiz.answerTokens}
        onNext={onNext}
      />
    );
  }

  return null;
}
