'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildWordQuiz, buildBlankQuiz, buildArrangeQuiz, type QuizItem } from '@/lib/quiz';
import { scoreOf, type AnswerLog } from '@/lib/session';
import { saveDayRecord, addWrongNote } from '@/lib/progressRepo';
import type { DayContent, QuizType } from '@/lib/types';
import QuizCard from './QuizCard';
import ArrangeCard from './ArrangeCard';
import WordBrowse from './WordBrowse';

export interface LastResult {
  date: string;
  scores: { word: number; blank: number; arrange: number };
  wrongs: { type: QuizType; itemId: string; label: string }[];
}

type Phase = 'browse' | 'quiz' | 'retry' | 'done';

interface SessionRunnerProps {
  day: DayContent;
}

export default function SessionRunner({ day }: SessionRunnerProps) {
  const router = useRouter();
  const [items] = useState<QuizItem[]>(() => [
    ...buildWordQuiz(day.words, day.words),
    ...buildBlankQuiz(day.sentences),
    ...buildArrangeQuiz(day.sentences),
  ]);
  const [phase, setPhase] = useState<Phase>('browse');
  const [idx, setIdx] = useState(0);
  const [logs, setLogs] = useState<AnswerLog[]>([]);
  const [retryQueue, setRetryQueue] = useState<QuizItem[]>([]);
  const [retryStarted, setRetryStarted] = useState(false);

  function labelOf(l: AnswerLog): string {
    if (l.type === 'word') {
      return day.words.find((w) => w.id === l.itemId)?.word ?? l.itemId;
    }
    return day.sentences.find((s) => s.id === l.itemId)?.text ?? l.itemId;
  }

  function finish(finalLogs: AnswerLog[]) {
    const scores = {
      word: scoreOf(finalLogs, 'word'),
      blank: scoreOf(finalLogs, 'blank'),
      arrange: scoreOf(finalLogs, 'arrange'),
    };
    saveDayRecord({ date: day.date, completedAt: new Date().toISOString(), scores });
    const wrongs = finalLogs.filter((l) => !l.correctOnFirstTry);
    wrongs.forEach((l) => addWrongNote({ type: l.type, itemId: l.itemId, date: day.date }));
    const lastResult: LastResult = {
      date: day.date,
      scores,
      wrongs: wrongs.map((l) => ({ type: l.type, itemId: l.itemId, label: labelOf(l) })),
    };
    sessionStorage.setItem('ddt.lastResult', JSON.stringify(lastResult));
    setPhase('done');
    router.push(`/learn/${day.date}/result`);
  }

  // 주의: 마지막 문항의 결과가 setLogs/finish에 모두 반영되도록 지역 변수(newLogs, newRetryQueue)를
  // 만들어 setLogs와 점수 계산·재도전 진입 판단에 동일하게 사용한다 (stale state 방지).
  function handleAnswer(correct: boolean) {
    if (phase === 'quiz') {
      const item = items[idx];
      const newLogs: AnswerLog[] = [
        ...logs,
        { type: item.type, itemId: item.itemId, correctOnFirstTry: correct },
      ];
      const newRetryQueue = correct ? retryQueue : [...retryQueue, item];
      setLogs(newLogs);
      setRetryQueue(newRetryQueue);
      if (idx + 1 < items.length) {
        setIdx(idx + 1);
      } else if (newRetryQueue.length > 0) {
        setPhase('retry');
        setIdx(0);
      } else {
        finish(newLogs);
      }
      return;
    }

    // 재도전: 기록하지 않음
    if (idx + 1 < retryQueue.length) {
      setIdx(idx + 1);
    } else {
      finish(logs);
    }
  }

  const total = items.length;
  const current = phase === 'quiz' ? items[idx] : phase === 'retry' ? retryQueue[idx] : null;

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 p-4 dark:bg-black">
      <div className="flex w-full max-w-xl items-center justify-between py-4">
        <span className="text-sm text-gray-400 dark:text-gray-500">
          {phase === 'browse' && '단어 학습'}
          {phase === 'quiz' && `${idx + 1} / ${total}`}
          {phase === 'retry' && !retryStarted && '재도전 준비'}
          {phase === 'retry' && retryStarted && `재도전 ${idx + 1} / ${retryQueue.length}`}
          {phase === 'done' && ' '}
        </span>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          나가기
        </button>
      </div>

      <div className="w-full max-w-xl flex-1">
        {phase === 'browse' && (
          <WordBrowse
            words={day.words}
            onDone={() => {
              setPhase('quiz');
              setIdx(0);
            }}
          />
        )}

        {phase === 'quiz' && current && renderItem(current, current.itemId + phase, handleAnswer)}

        {phase === 'retry' && !retryStarted && (
          <div className="rounded-2xl border border-gray-200 p-6 text-center dark:border-gray-800">
            <p className="mb-2 text-xl font-semibold">틀린 문제 다시 풀기</p>
            <p className="mb-6 text-base text-gray-500 dark:text-gray-400">
              {retryQueue.length}문제를 다시 풀어볼게요. 이번 결과는 점수에 반영되지 않아요.
            </p>
            <button
              type="button"
              onClick={() => setRetryStarted(true)}
              className="min-h-14 w-full rounded-lg bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
            >
              시작하기
            </button>
          </div>
        )}

        {phase === 'retry' && retryStarted && current && renderItem(current, current.itemId + phase, handleAnswer)}

        {phase === 'done' && (
          <p className="text-center text-gray-400 dark:text-gray-500">결과로 이동 중...</p>
        )}
      </div>
    </div>
  );
}

function renderItem(item: QuizItem, key: string, onNext: (correct: boolean) => void) {
  if (item.type === 'word') {
    return (
      <QuizCard key={key} prompt={item.word.word} subPrompt={item.word.pos} choices={item.choices} onNext={onNext} />
    );
  }
  if (item.type === 'blank') {
    return <QuizCard key={key} prompt={item.blankedText} choices={item.choices} onNext={onNext} />;
  }
  return (
    <ArrangeCard key={key} ko={item.sentence.ko} tokens={item.tokens} answerTokens={item.answerTokens} onNext={onNext} />
  );
}
