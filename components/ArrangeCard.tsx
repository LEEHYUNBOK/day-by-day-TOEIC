'use client';

import { useState } from 'react';

interface ArrangeCardProps {
  ko: string; // 한글 해석 (프롬프트)
  tokens: string[]; // 섞인 칩
  answerTokens: string[];
  onNext: (correct: boolean) => void;
}

export default function ArrangeCard({ ko, tokens, answerTokens, onNext }: ArrangeCardProps) {
  const [placed, setPlaced] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);

  const allPlaced = placed.length === tokens.length;

  function placeToken(i: number) {
    if (checked || placed.includes(i)) return;
    setPlaced([...placed, i]);
  }

  function removeToken(pos: number) {
    if (checked) return;
    setPlaced(placed.filter((_, idx) => idx !== pos));
  }

  function handleConfirm() {
    const answer = placed.map((i) => tokens[i]).join(' ');
    setCorrect(answer === answerTokens.join(' '));
    setChecked(true);
  }

  const answerBoxStyle = !checked
    ? 'border-gray-300 dark:border-gray-700'
    : correct
      ? 'border-green-500 bg-green-50 dark:bg-green-950'
      : 'border-red-500 bg-red-50 dark:bg-red-950';

  return (
    <div className="rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
      <p className="text-xl font-semibold text-center mb-6">{ko}</p>

      <div
        className={`min-h-14 rounded-lg border-2 border-dashed p-3 flex flex-wrap gap-2 mb-4 ${answerBoxStyle}`}
      >
        {placed.map((i, pos) => (
          <button
            key={i}
            type="button"
            disabled={checked}
            onClick={() => removeToken(pos)}
            className="min-h-11 rounded-lg border-2 border-gray-300 bg-white px-3 text-base font-medium dark:border-gray-600 dark:bg-gray-900"
          >
            {tokens[i]}
          </button>
        ))}
      </div>

      {checked && !correct && (
        <p className="mb-4 rounded-lg bg-green-50 p-3 text-center text-base font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
          {answerTokens.join(' ')}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {tokens.map((t, i) => (
          <button
            key={i}
            type="button"
            disabled={checked || placed.includes(i)}
            onClick={() => placeToken(i)}
            className="min-h-11 rounded-lg border-2 border-gray-200 bg-white px-3 text-base font-medium disabled:opacity-30 hover:border-gray-300 dark:border-gray-700 dark:bg-transparent dark:hover:border-gray-600"
          >
            {t}
          </button>
        ))}
      </div>

      {!checked ? (
        <button
          type="button"
          disabled={!allPlaced}
          onClick={handleConfirm}
          className="min-h-14 w-full rounded-lg bg-blue-600 text-lg font-semibold text-white disabled:bg-gray-200 disabled:text-gray-400 hover:enabled:bg-blue-700 dark:disabled:bg-gray-800 dark:disabled:text-gray-600"
        >
          확인
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onNext(correct)}
          className="min-h-14 w-full rounded-lg bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
        >
          다음
        </button>
      )}
    </div>
  );
}
