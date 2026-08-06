import { describe, it, expect } from 'vitest';
import { cardKey, nextState, DUE_DAYS } from '@/lib/srs';
import type { SrsCard, Box } from '@/lib/types';

const TODAY = '2026-08-06';
const id = { itemId: 'w-negotiate', type: 'word' as const, sourceDate: '2026-08-04' };
const card = (box: Box, dueDate = TODAY): SrsCard => ({ ...id, box, dueDate });

describe('cardKey', () => {
  it('joins type and itemId', () => {
    expect(cardKey('blank', 's-0804-1')).toBe('blank:s-0804-1');
  });
  it('distinguishes the two cards of one sentence', () => {
    expect(cardKey('blank', 's-0804-1')).not.toBe(cardKey('arrange', 's-0804-1'));
  });
});

describe('DUE_DAYS', () => {
  it('matches the spec intervals', () => {
    expect(DUE_DAYS).toEqual({ 0: 1, 1: 3, 2: 7, 3: 14 });
  });
});

describe('nextState — correct answers', () => {
  it('new item answered right starts at box 1, due in 3 days', () => {
    const r = nextState(null, true, TODAY, id);
    expect(r.mastered).toBe(false);
    expect(r.card).toEqual({ ...id, box: 1, dueDate: '2026-08-09' });
  });
  it('box 0 -> box 1, due in 3 days', () => {
    const r = nextState(card(0), true, TODAY, id);
    expect(r.card).toEqual({ ...id, box: 1, dueDate: '2026-08-09' });
  });
  it('box 1 -> box 2, due in 7 days', () => {
    const r = nextState(card(1), true, TODAY, id);
    expect(r.card).toEqual({ ...id, box: 2, dueDate: '2026-08-13' });
  });
  it('box 2 -> box 3, due in 14 days', () => {
    const r = nextState(card(2), true, TODAY, id);
    expect(r.card).toEqual({ ...id, box: 3, dueDate: '2026-08-20' });
  });
  it('box 3 answered right graduates', () => {
    const r = nextState(card(3), true, TODAY, id);
    expect(r.mastered).toBe(true);
    expect(r.card).toBeNull();
  });
});

describe('nextState — wrong answers', () => {
  it('new item answered wrong lands in box 0, due tomorrow', () => {
    const r = nextState(null, false, TODAY, id);
    expect(r.mastered).toBe(false);
    expect(r.card).toEqual({ ...id, box: 0, dueDate: '2026-08-07' });
  });
  it('resets to box 0 from every box', () => {
    for (const b of [0, 1, 2, 3] as Box[]) {
      const r = nextState(card(b, '2026-07-01'), false, TODAY, id);
      expect(r.card).toEqual({ ...id, box: 0, dueDate: '2026-08-07' });
      expect(r.mastered).toBe(false);
    }
  });
});

describe('nextState — identity and dates', () => {
  it('carries identity from the identity argument, not the old card', () => {
    const stale: SrsCard = { itemId: 'w-old', type: 'blank', sourceDate: '2026-01-01', box: 1, dueDate: TODAY };
    const r = nextState(stale, true, TODAY, id);
    expect(r.card).toMatchObject({ itemId: 'w-negotiate', type: 'word', sourceDate: '2026-08-04' });
  });
  it('computes dueDate from today, crossing a month boundary', () => {
    const r = nextState(card(2), true, '2026-08-31', id);
    expect(r.card!.dueDate).toBe('2026-09-14');
  });
  it('does not mutate the card passed in', () => {
    const original = card(1);
    const snapshot = { ...original };
    nextState(original, true, TODAY, id);
    expect(original).toEqual(snapshot);
  });
});
