'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchIndex, fetchDay } from '@/lib/contentRepo';
import { getWrongNotes, addWrongNote, resolveWrongNote } from '@/lib/progressRepo';
import { buildWordQuiz, buildBlankQuiz, type WordQuizItem, type BlankQuizItem } from '@/lib/quiz';
import QuizCard from '@/components/QuizCard';
import type { DayContent, DayIndexEntry, WrongNote, Word, QuizType } from '@/lib/types';

interface LoadedState {
  notes: WrongNote[];
  dayContentByDate: Map<string, DayContent | null>;
  fullWordPool: Word[];
}

type ResolvedEntry =
  | { note: WrongNote; kind: 'word'; word: Word }
  | { note: WrongNote; kind: 'sentence'; text: string }
  | { note: WrongNote; kind: 'dangling' };

const TYPE_LABEL: Record<QuizType, string> = {
  word: '단어',
  blank: '빈칸 채우기',
  arrange: '문장 조합',
};

function noteKey(note: WrongNote): string {
  return `${note.type}:${note.itemId}`;
}

function resolveEntry(note: WrongNote, dayContentByDate: Map<string, DayContent | null>): ResolvedEntry {
  const day = dayContentByDate.get(note.date);
  if (!day) return { note, kind: 'dangling' };
  if (note.type === 'word') {
    const word = day.words.find((w) => w.id === note.itemId);
    return word ? { note, kind: 'word', word } : { note, kind: 'dangling' };
  }
  const sentence = day.sentences.find((s) => s.id === note.itemId);
  return sentence ? { note, kind: 'sentence', text: sentence.text } : { note, kind: 'dangling' };
}

// 다시 풀기용 퀴즈 문항 구성. 단어는 buildWordQuiz(pool=전체 코퍼스), 문장(blank/arrange 공통)은
// buildBlankQuiz로 빈칸 문제를 만든다 (ArrangeCard는 쓰지 않음 — 스펙: 4지선다 또는 빈칸).
function buildRetryItem(
  entry: ResolvedEntry,
  dayContentByDate: Map<string, DayContent | null>,
  fullWordPool: Word[],
): WordQuizItem | BlankQuizItem | null {
  if (entry.kind === 'word') {
    return buildWordQuiz([entry.word], fullWordPool)[0];
  }
  if (entry.kind === 'sentence') {
    const day = dayContentByDate.get(entry.note.date);
    const sentence = day?.sentences.find((s) => s.id === entry.note.itemId);
    if (!sentence) return null;
    return buildBlankQuiz([sentence])[0];
  }
  return null;
}

export default function NotesPage() {
  const [state, setState] = useState<LoadedState | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchIndex().then(async (index: DayIndexEntry[]) => {
      const contents = await Promise.all(index.map((d) => fetchDay(d.date)));
      if (cancelled) return;
      const dayContentByDate = new Map(index.map((d, i) => [d.date, contents[i]] as const));
      const fullWordPool = contents.flatMap((c) => c?.words ?? []);
      setState({ notes: getWrongNotes(), dayContentByDate, fullWordPool });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
      </div>
    );
  }

  function refreshNotes() {
    setState((prev) => (prev ? { ...prev, notes: getWrongNotes() } : prev));
  }

  function removeDangling(note: WrongNote) {
    resolveWrongNote(note.type, note.itemId);
    refreshNotes();
  }

  function handleRetryAnswer(entry: ResolvedEntry, correct: boolean, label: string) {
    if (correct) {
      resolveWrongNote(entry.note.type, entry.note.itemId);
      setFeedback(`${label} — 오답노트에서 제거됨`);
    } else {
      addWrongNote({ type: entry.note.type, itemId: entry.note.itemId, date: entry.note.date });
      setFeedback(`${label} — 아직 오답노트에 남아있어요`);
    }
    setActiveKey(null);
    refreshNotes();
    setTimeout(() => setFeedback(null), 2500);
  }

  const entries = state.notes.map((note) => resolveEntry(note, state.dayContentByDate));

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 p-4 dark:bg-black">
      <div className="w-full max-w-xl py-8">
        <h1 className="mb-6 text-2xl font-bold">오답노트</h1>

        {feedback && (
          <div className="mb-4 rounded-lg bg-blue-50 p-3 text-center text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {feedback}
          </div>
        )}

        {entries.length === 0 && (
          <div className="rounded-2xl border border-gray-200 p-6 text-center text-lg text-gray-500 dark:border-gray-800 dark:text-gray-400">
            오답이 없어요 🎉
          </div>
        )}

        <div className="flex flex-col gap-3">
          {entries.map((entry) => {
            const key = noteKey(entry.note);
            const isActive = activeKey === key;
            const label = entry.kind === 'word' ? entry.word.word : entry.kind === 'sentence' ? entry.text : '삭제된 콘텐츠';

            return (
              <div key={key} className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                {entry.kind === 'dangling' ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-400 dark:text-gray-500">삭제된 콘텐츠</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {TYPE_LABEL[entry.note.type]} · 오답 {entry.note.wrongCount}회 · {entry.note.date}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDangling(entry.note)}
                      className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm font-medium text-gray-500 hover:border-red-300 hover:text-red-600 dark:border-gray-700 dark:text-gray-400"
                    >
                      제거
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">
                          {entry.kind === 'word' ? `${entry.word.word} — ${entry.word.meaning}` : entry.text}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {TYPE_LABEL[entry.note.type]} · 오답 {entry.note.wrongCount}회 · {entry.note.date}
                        </p>
                      </div>
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => setActiveKey(key)}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          다시 풀기
                        </button>
                      )}
                    </div>

                    {isActive &&
                      (() => {
                        const item = buildRetryItem(entry, state.dayContentByDate, state.fullWordPool);
                        if (!item) {
                          return (
                            <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">문항을 만들 수 없어요</p>
                          );
                        }
                        const prompt = item.type === 'word' ? item.word.word : item.blankedText;
                        const subPrompt = item.type === 'word' ? item.word.pos : undefined;
                        return (
                          <div className="mt-4">
                            <QuizCard
                              key={key}
                              prompt={prompt}
                              subPrompt={subPrompt}
                              choices={item.choices}
                              onNext={(correct) => handleRetryAnswer(entry, correct, label)}
                            />
                          </div>
                        );
                      })()}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <Link
          href="/"
          className="mt-6 inline-block text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}
