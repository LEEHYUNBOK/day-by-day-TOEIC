import type { DayRecord, WrongNote, ReviewRecord, QuizType } from './types';
import { addDays } from './date';

const KEYS = {
  dayRecords: 'ddt.dayRecords',
  wrongNotes: 'ddt.wrongNotes',
  reviewRecords: 'ddt.reviewRecords',
} as const;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getDayRecords(): Record<string, DayRecord> {
  return load(KEYS.dayRecords, {});
}
export function saveDayRecord(r: DayRecord): void {
  const all = getDayRecords();
  all[r.date] = r;
  save(KEYS.dayRecords, all);
}

export function getWrongNotes(): WrongNote[] {
  return load(KEYS.wrongNotes, []);
}
export function addWrongNote(n: Omit<WrongNote, 'wrongCount'>): void {
  const notes = getWrongNotes();
  const found = notes.find(x => x.type === n.type && x.itemId === n.itemId);
  if (found) found.wrongCount += 1;
  else notes.push({ ...n, wrongCount: 1 });
  save(KEYS.wrongNotes, notes);
}
export function resolveWrongNote(type: QuizType, itemId: string): void {
  save(KEYS.wrongNotes, getWrongNotes().filter(x => !(x.type === type && x.itemId === itemId)));
}

export function getReviewRecords(): ReviewRecord[] {
  return load(KEYS.reviewRecords, []);
}
export function addReviewRecord(r: ReviewRecord): void {
  save(KEYS.reviewRecords, [...getReviewRecords(), r]);
}

export function calcStreak(records: Record<string, DayRecord>, today: string): number {
  let cursor = records[today] ? today : addDays(today, -1);
  let streak = 0;
  while (records[cursor]) { streak += 1; cursor = addDays(cursor, -1); }
  return streak;
}
