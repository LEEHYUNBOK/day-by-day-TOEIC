import { describe, it, expect } from 'vitest';
import { scoreOf } from '@/lib/session';
import type { AnswerLog } from '@/lib/session';

const log = (type: 'word' | 'blank', ok: boolean): AnswerLog =>
  ({ type, itemId: 'x', correctOnFirstTry: ok });

describe('scoreOf', () => {
  it('rounds percentage of first-try corrects per type', () => {
    const logs = [log('word', true), log('word', true), log('word', false), log('blank', false)];
    expect(scoreOf(logs, 'word')).toBe(67);
    expect(scoreOf(logs, 'blank')).toBe(0);
  });
  it('returns 100 when no items of that type', () => {
    expect(scoreOf([], 'arrange')).toBe(100);
  });
});
