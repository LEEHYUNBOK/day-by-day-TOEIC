'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Choice } from '@/lib/quiz';

interface QuizCardProps {
  prompt: string; // 단어 또는 빈칸 문장
  subPrompt?: string; // 품사 등 보조 표시
  choices: Choice[];
  onNext: (correct: boolean) => void;
  explanation?: ReactNode; // 틀렸을 때만 렌더된다
}

export default function QuizCard({ prompt, subPrompt, choices, onNext, explanation }: QuizCardProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const locked = selected !== null;
  const correct = locked ? choices[selected].correct : false;

  function handleChoice(i: number) {
    if (locked) return;
    setSelected(i);
  }

  return (
    <div className="rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
      <div className="text-center mb-6">
        {subPrompt && (
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">{subPrompt}</p>
        )}
        <p className="text-2xl font-semibold leading-snug">{prompt}</p>
      </div>

      <div className="flex flex-col gap-3">
        {choices.map((choice, i) => {
          let style = 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-transparent dark:hover:border-gray-600';
          if (locked) {
            if (choice.correct) {
              style = 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300';
            } else if (i === selected) {
              style = 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300';
            } else {
              style = 'border-gray-100 bg-white text-gray-400 dark:border-gray-800 dark:text-gray-600';
            }
          }
          const showCorrectBadge = locked && choice.correct;
          const showWrongBadge = locked && i === selected && !choice.correct;
          return (
            <button
              key={i}
              type="button"
              disabled={locked}
              onClick={() => handleChoice(i)}
              className={`min-h-14 w-full rounded-lg border-2 px-4 text-lg font-medium transition-colors flex items-center justify-center gap-2 ${style}`}
            >
              <span>{choice.text}</span>
              {showCorrectBadge && (
                <span className="text-sm font-semibold whitespace-nowrap">
                  <span aria-hidden="true">✓</span> 정답
                </span>
              )}
              {showWrongBadge && (
                <span className="text-sm font-semibold whitespace-nowrap">
                  <span aria-hidden="true">✗</span> 오답
                </span>
              )}
            </button>
          );
        })}
      </div>

      {locked && !correct && explanation && (
        <div className="mt-4 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
          {explanation}
        </div>
      )}

      {locked && (
        <button
          type="button"
          onClick={() => onNext(correct)}
          className="mt-4 min-h-14 w-full rounded-lg bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
        >
          다음
        </button>
      )}
    </div>
  );
}
