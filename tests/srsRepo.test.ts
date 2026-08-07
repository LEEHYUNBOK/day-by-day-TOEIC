import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCards, getMastered, getMasteredKeys, getSessions,
  findCard, commitSession, calcStreak, countDueOn,
} from '@/lib/srsRepo';
import { cardKey } from '@/lib/srs';
import type { SrsCard, SessionRecord, QuizType } from '@/lib/types';

const TODAY = '2026-08-06';
const NOW = '2026-08-06T10:00:00.000Z';
const ident = (itemId: string, type: QuizType = 'word') =>
  ({ itemId, type });

beforeEach(() => localStorage.clear());

describe('empty and corrupted storage', () => {
  it('returns empty collections when nothing is stored', () => {
    expect(getCards()).toEqual([]);
    expect(getMastered()).toEqual([]);
    expect(getSessions()).toEqual([]);
    expect(getMasteredKeys().size).toBe(0);
  });
  it('degrades to empty on corrupted JSON for every key', () => {
    localStorage.setItem('ddt.srs', '{broken');
    localStorage.setItem('ddt.mastered', 'nope');
    localStorage.setItem('ddt.sessions', '[[[');
    expect(getCards()).toEqual([]);
    expect(getMastered()).toEqual([]);
    expect(getSessions()).toEqual([]);
  });
  it('degrades to empty on valid JSON that is not an array, for every key', () => {
    localStorage.setItem('ddt.srs', '{}');
    localStorage.setItem('ddt.mastered', '42');
    localStorage.setItem('ddt.sessions', '"nope"');
    expect(getCards()).toEqual([]);
    expect(getMastered()).toEqual([]);
    expect(getSessions()).toEqual([]);
  });
});

describe('findCard', () => {
  const cards: SrsCard[] = [
    { itemId: 's-1', type: 'blank', box: 1, dueDate: TODAY },
    { itemId: 's-1', type: 'arrange', box: 2, dueDate: TODAY },
  ];
  it('matches on both type and itemId', () => {
    expect(findCard(cards, 'arrange', 's-1')!.box).toBe(2);
  });
  it('returns null when absent', () => {
    expect(findCard(cards, 'word', 's-1')).toBeNull();
  });
});

describe('commitSession', () => {
  it('creates cards for new items — right answers land in box 1, wrong in box 0', () => {
    commitSession(
      [{ identity: ident('w-1'), correct: true }, { identity: ident('w-2'), correct: false }],
      TODAY, NOW,
    );
    const cards = getCards();
    expect(cards).toHaveLength(2);
    expect(findCard(cards, 'word', 'w-1')).toMatchObject({ box: 1, dueDate: '2026-08-09' });
    expect(findCard(cards, 'word', 'w-2')).toMatchObject({ box: 0, dueDate: '2026-08-07' });
  });

  it('advances an existing card rather than duplicating it', () => {
    commitSession([{ identity: ident('w-1'), correct: true }], TODAY, NOW);
    commitSession([{ identity: ident('w-1'), correct: true }], '2026-08-09', NOW);
    const cards = getCards();
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ box: 2, dueDate: '2026-08-16' });
  });

  it('graduates a box 3 card: removes it and records it as mastered', () => {
    // box 3까지 올린다: 신규 맞힘(1) -> 2 -> 3
    commitSession([{ identity: ident('w-1'), correct: true }], TODAY, NOW);
    commitSession([{ identity: ident('w-1'), correct: true }], '2026-08-09', NOW);
    commitSession([{ identity: ident('w-1'), correct: true }], '2026-08-16', NOW);
    expect(getCards()[0].box).toBe(3);

    const r = commitSession([{ identity: ident('w-1'), correct: true }], '2026-08-30', NOW);
    expect(r.masteredCount).toBe(1);
    expect(getCards()).toEqual([]);
    expect(getMastered()).toEqual([{ itemId: 'w-1', type: 'word', masteredAt: NOW }]);
    expect(getMasteredKeys().has(cardKey('word', 'w-1'))).toBe(true);
  });

  it('sends a wrong answer back to box 0 from any box', () => {
    commitSession([{ identity: ident('w-1'), correct: true }], TODAY, NOW);
    commitSession([{ identity: ident('w-1'), correct: true }], '2026-08-09', NOW);
    expect(getCards()[0].box).toBe(2);
    commitSession([{ identity: ident('w-1'), correct: false }], '2026-08-16', NOW);
    expect(getCards()[0]).toMatchObject({ box: 0, dueDate: '2026-08-17' });
  });

  it('records one session with the right tally', () => {
    commitSession(
      [
        { identity: ident('w-1'), correct: true },
        { identity: ident('w-2'), correct: true },
        { identity: ident('w-3'), correct: false },
      ],
      TODAY, NOW,
    );
    expect(getSessions()).toEqual([{ finishedAt: NOW, date: TODAY, correct: 2, total: 3 }]);
  });

  it('keeps blank and arrange cards for one sentence separate', () => {
    commitSession(
      [
        { identity: ident('s-1', 'blank'), correct: true },
        { identity: ident('s-1', 'arrange'), correct: false },
      ],
      TODAY, NOW,
    );
    const cards = getCards();
    expect(cards).toHaveLength(2);
    expect(findCard(cards, 'blank', 's-1')!.box).toBe(1);
    expect(findCard(cards, 'arrange', 's-1')!.box).toBe(0);
  });

  it('returns 0 mastered when nobody graduated', () => {
    const r = commitSession([{ identity: ident('w-1'), correct: true }], TODAY, NOW);
    expect(r.masteredCount).toBe(0);
  });

  it('appends sessions rather than replacing them', () => {
    commitSession([{ identity: ident('w-1'), correct: true }], TODAY, NOW);
    commitSession([{ identity: ident('w-2'), correct: true }], '2026-08-07', NOW);
    expect(getSessions()).toHaveLength(2);
  });

  it('resolves a repeated identity within one session using the later answer, keeping one card', () => {
    commitSession(
      [
        { identity: ident('w-1'), correct: true },
        { identity: ident('w-1'), correct: false },
      ],
      TODAY, NOW,
    );
    const cards = getCards();
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ box: 0, dueDate: '2026-08-07' });
    expect(getSessions()).toEqual([{ finishedAt: NOW, date: TODAY, correct: 1, total: 2 }]);
  });
});

describe('calcStreak', () => {
  const s = (date: string): SessionRecord =>
    ({ finishedAt: `${date}T10:00:00.000Z`, date, correct: 10, total: 20 });

  it('counts consecutive days ending today', () => {
    expect(calcStreak([s('2026-08-04'), s('2026-08-05'), s(TODAY)], TODAY)).toBe(3);
  });
  it('does not break when today is not done yet', () => {
    expect(calcStreak([s('2026-08-04'), s('2026-08-05')], TODAY)).toBe(2);
  });
  it('stops at a gap', () => {
    expect(calcStreak([s('2026-08-01'), s('2026-08-05')], TODAY)).toBe(1);
  });
  it('counts two sessions on one day as one', () => {
    expect(calcStreak([s(TODAY), s(TODAY)], TODAY)).toBe(1);
  });
  it('is 0 with no sessions', () => {
    expect(calcStreak([], TODAY)).toBe(0);
  });
});

describe('countDueOn', () => {
  const c = (itemId: string, dueDate: string): SrsCard =>
    ({ itemId, type: 'word', box: 1, dueDate });
  it('counts cards due on or before the given date', () => {
    const cards = [c('a', '2026-08-05'), c('b', '2026-08-07'), c('c', '2026-08-20')];
    expect(countDueOn(cards, '2026-08-07')).toBe(2);
  });
  it('is 0 when nothing is due', () => {
    expect(countDueOn([c('a', '2026-09-01')], TODAY)).toBe(0);
  });
});
