import { describe, it, expect } from 'vitest';
import { buildQueue, SESSION_SIZE } from '@/lib/queue';
import { cardKey } from '@/lib/srs';
import type { SrsCard, QuizType } from '@/lib/types';

const TODAY = '2026-08-06';
// 셔플을 결정적으로 만들되 정지 상태로 두지 않는 rng
const rng = () => { let i = 0; return () => ((i = (i + 3) % 7) / 7); };

const cand = (itemId: string, type: QuizType = 'word') =>
  ({ itemId, type });
const card = (itemId: string, dueDate: string, type: QuizType = 'word'): SrsCard =>
  ({ itemId, type, box: 1, dueDate });

const keys = (items: { itemId: string; type: QuizType }[]) =>
  items.map((i) => cardKey(i.type, i.itemId)).sort();

describe('SESSION_SIZE', () => {
  it('is 20', () => expect(SESSION_SIZE).toBe(20));
});

describe('buildQueue — new items only', () => {
  it('takes the first `size` candidates in order when there are no cards', () => {
    const candidates = Array.from({ length: 30 }, (_, i) => cand(`w-${i}`));
    const out = buildQueue([], candidates, new Set(), TODAY, 20, rng());
    expect(out).toHaveLength(20);
    expect(keys(out)).toEqual(keys(candidates.slice(0, 20)));
  });
  it('returns fewer than size when candidates run out', () => {
    const candidates = [cand('w-1'), cand('w-2')];
    const out = buildQueue([], candidates, new Set(), TODAY, 20, rng());
    expect(out).toHaveLength(2);
  });
  it('returns empty when there is nothing to do', () => {
    expect(buildQueue([], [], new Set(), TODAY, 20, rng())).toEqual([]);
  });
});

describe('buildQueue — due cards', () => {
  it('includes cards due today and overdue, excludes future ones', () => {
    const cards = [
      card('w-overdue', '2026-08-01'),
      card('w-today', TODAY),
      card('w-future', '2026-08-20'),
    ];
    const out = buildQueue(cards, [], new Set(), TODAY, 20, rng());
    expect(keys(out)).toEqual(keys([cand('w-overdue'), cand('w-today')]));
  });
  it('prefers the most overdue cards when more are due than fit', () => {
    const cards = [
      card('w-a', '2026-08-05'),
      card('w-b', '2026-08-01'),
      card('w-c', '2026-08-03'),
    ];
    const out = buildQueue(cards, [], new Set(), TODAY, 2, rng());
    expect(keys(out)).toEqual(keys([cand('w-b'), cand('w-c')]));
  });
  it('leaves no room for new items when due cards fill the session', () => {
    const cards = Array.from({ length: 25 }, (_, i) => card(`w-due-${i}`, '2026-08-01'));
    const out = buildQueue(cards, [cand('w-new')], new Set(), TODAY, 20, rng());
    expect(out).toHaveLength(20);
    expect(out.some((i) => i.itemId === 'w-new')).toBe(false);
  });
  it('fills the remainder with new items after due cards', () => {
    const cards = [card('w-due', '2026-08-01')];
    const candidates = [cand('w-new-1'), cand('w-new-2'), cand('w-new-3')];
    const out = buildQueue(cards, candidates, new Set(), TODAY, 3, rng());
    expect(keys(out)).toEqual(keys([cand('w-due'), cand('w-new-1'), cand('w-new-2')]));
  });
});

describe('buildQueue — exclusions', () => {
  it('never offers a candidate that already has a card', () => {
    const cards = [card('w-1', '2026-08-20')];   // 미래 만기 — 복습 대상도 아님
    const out = buildQueue(cards, [cand('w-1'), cand('w-2')], new Set(), TODAY, 20, rng());
    expect(keys(out)).toEqual(keys([cand('w-2')]));
  });
  it('never offers a mastered candidate', () => {
    const mastered = new Set([cardKey('word', 'w-1')]);
    const out = buildQueue([], [cand('w-1'), cand('w-2')], mastered, TODAY, 20, rng());
    expect(keys(out)).toEqual(keys([cand('w-2')]));
  });
  it('treats blank and arrange for one sentence as separate items', () => {
    const cards = [card('s-1', '2026-08-20', 'blank')];
    const candidates = [cand('s-1', 'blank'), cand('s-1', 'arrange')];
    const out = buildQueue(cards, candidates, new Set(), TODAY, 20, rng());
    expect(keys(out)).toEqual(keys([cand('s-1', 'arrange')]));
  });
});

describe('buildQueue — output shape', () => {
  it('does not mutate its inputs', () => {
    const cards = [card('w-1', '2026-08-01')];
    const candidates = [cand('w-2')];
    const cardsSnapshot = JSON.stringify(cards);
    const candSnapshot = JSON.stringify(candidates);
    buildQueue(cards, candidates, new Set(), TODAY, 20, rng());
    expect(JSON.stringify(cards)).toBe(cardsSnapshot);
    expect(JSON.stringify(candidates)).toBe(candSnapshot);
  });
  it('contains no duplicates', () => {
    const cards = [card('w-1', '2026-08-01')];
    const candidates = Array.from({ length: 25 }, (_, i) => cand(`w-${i}`));
    const out = buildQueue(cards, candidates, new Set(), TODAY, 20, rng());
    expect(new Set(keys(out)).size).toBe(out.length);
  });
});
