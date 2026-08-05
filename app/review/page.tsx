'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchIndex, fetchDay } from '@/lib/contentRepo';
import { getDayRecords, getWrongNotes, addReviewRecord, addWrongNote, resolveWrongNote } from '@/lib/progressRepo';
import { buildWordQuiz, buildBlankQuiz, shuffle, type QuizItem } from '@/lib/quiz';
import { todayStr, addDays } from '@/lib/date';
import QuizCard from '@/components/QuizCard';
import type { DayContent, DayIndexEntry, DayRecord, WrongNote, Word, Sentence, QuizType } from '@/lib/types';

type Scope = 'recent7' | 'all' | 'wrong';
type Phase = 'scope' | 'quiz' | 'result';

interface ReviewLog {
  type: QuizType;
  itemId: string;
  correct: boolean;
}

interface LoadedState {
  index: DayIndexEntry[];
  records: Record<string, DayRecord>;
  wrongNotes: WrongNote[];
  dayContentByDate: Map<string, DayContent | null>;
  fullWordPool: Word[];
}

const SCOPE_LABEL: Record<Scope, string> = {
  recent7: '최근 7일',
  all: '전체',
  wrong: '오답만',
};
const TYPE_LABEL: Record<QuizType, string> = {
  word: '단어',
  blank: '빈칸 채우기',
  arrange: '문장 조합',
};

// scope에 해당하는 "완료한 날짜" 목록. recent7은 최근 7일로 추가 필터.
function completedDatesForScope(scope: Scope, state: LoadedState): string[] {
  const completed = state.index.map((d) => d.date).filter((date) => state.records[date]);
  if (scope === 'recent7') {
    const start = addDays(todayStr(), -6);
    const end = todayStr();
    return completed.filter((d) => d >= start && d <= end);
  }
  return completed;
}

// scope에 포함될 단어/문장 풀 구성. wrong 스코프는 오답노트에 있는 항목만 남긴다.
// (문장은 blank/arrange 구분 없이 동일한 Sentence 콘텐츠이므로 둘 다 대상에 포함한다.)
function buildScopePool(scope: Scope, state: LoadedState): { words: Word[]; sentences: Sentence[] } {
  const dates = completedDatesForScope(scope, state);
  let words: Word[] = [];
  let sentences: Sentence[] = [];
  for (const date of dates) {
    const day = state.dayContentByDate.get(date);
    if (!day) continue;
    words = words.concat(day.words);
    sentences = sentences.concat(day.sentences);
  }
  if (scope === 'wrong') {
    const wordIds = new Set(state.wrongNotes.filter((n) => n.type === 'word').map((n) => n.itemId));
    const sentenceIds = new Set(state.wrongNotes.filter((n) => n.type !== 'word').map((n) => n.itemId));
    words = words.filter((w) => wordIds.has(w.id));
    sentences = sentences.filter((s) => sentenceIds.has(s.id));
  }
  return { words, sentences };
}

// 문항 = 단어 뜻 퀴즈 + 문장 빈칸 퀴즈, 셔플 후 앞 20개.
// buildWordQuiz의 pool은 항상 전체 코퍼스(fullWordPool)를 넘겨 오답 보기 부족으로 인한 예외를 피한다.
function buildQuizItems(scope: Scope, state: LoadedState): QuizItem[] {
  const { words, sentences } = buildScopePool(scope, state);
  const items: QuizItem[] = [...buildWordQuiz(words, state.fullWordPool), ...buildBlankQuiz(sentences)];
  return shuffle(items).slice(0, 20);
}

function labelOf(item: QuizItem): string {
  return item.type === 'word' ? item.word.word : item.sentence.text;
}

// 문항이 오답노트에 이미 올라와 있는 항목이면 그 노트의 원래 type(들)을 그대로 쓴다.
// buildBlankQuiz는 항상 type:'blank'로 문항을 만들지만, 그 문장이 실제로는 'arrange'(문장 조합)
// 오답으로 기록되어 있을 수도 있으므로, 퀴즈 문항의 type이 아니라 노트 저장소의 type을 기준으로
// resolveWrongNote/addWrongNote를 호출해야 같은 항목이 중복 행으로 쌓이지 않는다.
// 아직 노트가 없는 항목(신규 오답)은 이번에 실제로 푼 문항 형식(item.type)을 그대로 쓴다.
function originNoteTypes(item: QuizItem, existingNotes: WrongNote[]): QuizType[] {
  if (item.type === 'word') return ['word'];
  const matches = existingNotes.filter((n) => n.itemId === item.itemId && n.type !== 'word');
  return matches.length > 0 ? matches.map((n) => n.type) : [item.type];
}

export default function ReviewPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadedState | null>(null);
  const [phase, setPhase] = useState<Phase>('scope');
  const [scope, setScope] = useState<Scope | null>(null);
  const [items, setItems] = useState<QuizItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [logs, setLogs] = useState<ReviewLog[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchIndex().then(async (index) => {
      const contents = await Promise.all(index.map((d) => fetchDay(d.date)));
      if (cancelled) return;
      const dayContentByDate = new Map(index.map((d, i) => [d.date, contents[i]] as const));
      const fullWordPool = contents.flatMap((c) => c?.words ?? []);
      setState({
        index,
        records: getDayRecords(),
        wrongNotes: getWrongNotes(),
        dayContentByDate,
        fullWordPool,
      });
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

  function startScope(s: Scope) {
    if (!state) return;
    const built = buildQuizItems(s, state);
    setScope(s);
    setItems(built);
    setIdx(0);
    setLogs([]);
    setPhase('quiz');
  }

  function finish(finalLogs: ReviewLog[]) {
    if (!scope) return;
    const correct = finalLogs.filter((l) => l.correct).length;
    addReviewRecord({ takenAt: new Date().toISOString(), scope, correct, total: finalLogs.length });
    const existingNotes = getWrongNotes();
    finalLogs.forEach((l, i) => {
      const noteTypes = originNoteTypes(items[i], existingNotes);
      if (l.correct) {
        if (scope === 'wrong') noteTypes.forEach((t) => resolveWrongNote(t, l.itemId));
      } else {
        noteTypes.forEach((t) => addWrongNote({ type: t, itemId: l.itemId, date: todayStr() }));
      }
    });
    setState((prev) => (prev ? { ...prev, wrongNotes: getWrongNotes(), records: getDayRecords() } : prev));
    setPhase('result');
  }

  function handleAnswer(correct: boolean) {
    const item = items[idx];
    const newLogs = [...logs, { type: item.type as QuizType, itemId: item.itemId, correct }];
    setLogs(newLogs);
    if (idx + 1 < items.length) {
      setIdx(idx + 1);
    } else {
      finish(newLogs);
    }
  }

  function backToScope() {
    setPhase('scope');
    setScope(null);
    setItems([]);
    setIdx(0);
    setLogs([]);
  }

  if (phase === 'scope') {
    return (
      <div className="flex min-h-screen flex-col items-center bg-zinc-50 p-4 dark:bg-black">
        <div className="w-full max-w-xl py-8">
          <h1 className="mb-6 text-2xl font-bold">복습 시험</h1>
          <div className="flex flex-col gap-3">
            {(['recent7', 'all', 'wrong'] as Scope[]).map((s) => {
              const { words, sentences } = buildScopePool(s, state);
              const count = Math.min(words.length + sentences.length, 20);
              const disabled = count === 0;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={disabled}
                  onClick={() => startScope(s)}
                  className={`rounded-2xl border-2 p-6 text-left transition-colors ${
                    disabled
                      ? 'cursor-not-allowed border-gray-100 opacity-50 dark:border-gray-800'
                      : 'border-gray-200 hover:border-blue-400 dark:border-gray-700 dark:hover:border-blue-500'
                  }`}
                >
                  <p className="text-lg font-semibold">{SCOPE_LABEL[s]}</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    {count > 0 ? `${count}문항` : '풀 문항이 없어요'}
                  </p>
                </button>
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

  if (phase === 'quiz') {
    const total = items.length;
    const current = items[idx];
    return (
      <div className="flex min-h-screen flex-col items-center bg-zinc-50 p-4 dark:bg-black">
        <div className="flex w-full max-w-xl items-center justify-between py-4">
          <span className="text-sm text-gray-400 dark:text-gray-500">
            {idx + 1} / {total}
          </span>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            나가기
          </button>
        </div>
        <div className="mb-4 h-1 w-full max-w-xl rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className="h-1 rounded-full bg-blue-600 transition-all dark:bg-blue-400"
            style={{ width: `${(idx / total) * 100}%` }}
          />
        </div>
        <div className="w-full max-w-xl flex-1">
          {current.type === 'word' && (
            <QuizCard
              key={current.itemId}
              prompt={current.word.word}
              subPrompt={current.word.pos}
              choices={current.choices}
              onNext={handleAnswer}
            />
          )}
          {current.type === 'blank' && (
            <QuizCard
              key={current.itemId}
              prompt={current.blankedText}
              choices={current.choices}
              onNext={handleAnswer}
            />
          )}
        </div>
      </div>
    );
  }

  // phase === 'result'
  const total = logs.length;
  const correct = logs.filter((l) => l.correct).length;
  const missed = logs
    .map((l, i) => ({ log: l, item: items[i] }))
    .filter((x) => !x.log.correct);

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 p-4 dark:bg-black">
      <div className="w-full max-w-xl py-8">
        <h1 className="mb-2 text-center text-2xl font-bold">복습 완료!</h1>
        <p className="mb-8 text-center text-5xl font-bold text-blue-600 dark:text-blue-400">
          {correct} / {total}
        </p>

        {missed.length > 0 && (
          <div className="mb-8 rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
            <p className="mb-4 font-semibold">틀린 문항 ({missed.length}개)</p>
            <ul className="flex flex-col gap-2">
              {missed.map(({ log, item }, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span>{labelOf(item)}</span>
                  <span className="text-gray-400 dark:text-gray-500">{TYPE_LABEL[log.type]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/"
            className="flex min-h-14 items-center justify-center rounded-lg border-2 border-gray-200 text-lg font-medium dark:border-gray-700"
          >
            홈으로
          </Link>
          <button
            type="button"
            onClick={backToScope}
            className="flex min-h-14 items-center justify-center rounded-lg bg-blue-600 text-lg font-semibold text-white hover:bg-blue-700"
          >
            다른 범위 풀기
          </button>
        </div>
      </div>
    </div>
  );
}
