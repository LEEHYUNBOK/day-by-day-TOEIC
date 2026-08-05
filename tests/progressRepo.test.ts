import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDayRecords, saveDayRecord, getWrongNotes, addWrongNote,
  resolveWrongNote, calcStreak,
} from '@/lib/progressRepo';
import type { DayRecord } from '@/lib/types';

const rec = (date: string): DayRecord => ({
  date, completedAt: `${date}T10:00:00.000Z`,
  scores: { word: 90, blank: 80, arrange: 100 },
});

beforeEach(() => localStorage.clear());

describe('progressRepo', () => {
  it('saves and loads day records, overwrites same date', () => {
    saveDayRecord(rec('2026-08-04'));
    saveDayRecord({ ...rec('2026-08-04'), scores: { word: 50, blank: 50, arrange: 50 } });
    const all = getDayRecords();
    expect(Object.keys(all)).toHaveLength(1);
    expect(all['2026-08-04'].scores.word).toBe(50);
  });
  it('addWrongNote increments wrongCount for same item', () => {
    addWrongNote({ type: 'word', itemId: 'w-negotiate', date: '2026-08-04' });
    addWrongNote({ type: 'word', itemId: 'w-negotiate', date: '2026-08-04' });
    expect(getWrongNotes()).toEqual([
      { type: 'word', itemId: 'w-negotiate', date: '2026-08-04', wrongCount: 2 },
    ]);
  });
  it('resolveWrongNote removes the item', () => {
    addWrongNote({ type: 'blank', itemId: 's-0804-1', date: '2026-08-04' });
    resolveWrongNote('blank', 's-0804-1');
    expect(getWrongNotes()).toEqual([]);
  });
  it('returns empty on corrupted storage', () => {
    localStorage.setItem('ddt.wrongNotes', '{broken');
    expect(getWrongNotes()).toEqual([]);
  });
});

describe('calcStreak', () => {
  const recs = (...dates: string[]) =>
    Object.fromEntries(dates.map(d => [d, rec(d)]));
  it('counts consecutive days ending today', () => {
    expect(calcStreak(recs('2026-08-02', '2026-08-03', '2026-08-04'), '2026-08-04')).toBe(3);
  });
  it('today not done yet does not break streak', () => {
    expect(calcStreak(recs('2026-08-02', '2026-08-03'), '2026-08-04')).toBe(2);
  });
  it('gap breaks streak', () => {
    expect(calcStreak(recs('2026-08-01', '2026-08-03'), '2026-08-04')).toBe(1);
  });
  it('empty records → 0', () => {
    expect(calcStreak({}, '2026-08-04')).toBe(0);
  });
});
