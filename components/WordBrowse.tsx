'use client';

import { useState } from 'react';
import type { Word } from '@/lib/types';

interface WordBrowseProps {
  words: Word[];
  onDone: () => void;
}

export default function WordBrowse({ words, onDone }: WordBrowseProps) {
  const [index, setIndex] = useState(0);

  const word = words[index];
  const isLast = index === words.length - 1;

  return (
    <div className="rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
      <p className="text-center text-sm text-gray-400 dark:text-gray-500 mb-4">
        {index + 1} / {words.length}
      </p>

      <div className="text-center mb-8">
        <p className="text-3xl font-bold mb-1">{word.word}</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">{word.pos}</p>
        <p className="text-xl font-semibold mb-4">{word.meaning}</p>
        <p className="text-base text-gray-600 dark:text-gray-300 mb-1">{word.example}</p>
        <p className="text-sm text-gray-400 dark:text-gray-500">{word.exampleKo}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
          className="min-h-14 rounded-lg border-2 border-gray-200 text-lg font-medium disabled:opacity-30 hover:enabled:border-gray-300 dark:border-gray-700 dark:hover:enabled:border-gray-600"
        >
          이전
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={onDone}
            className="min-h-14 rounded-lg bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
          >
            퀴즈 시작
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIndex(index + 1)}
            className="min-h-14 rounded-lg bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
          >
            다음
          </button>
        )}
      </div>
    </div>
  );
}
