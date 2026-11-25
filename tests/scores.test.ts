import { describe, it, expect } from 'vitest';
import { attemptScore, illusion, questionScore, dayStats, topicAverages, buildTree } from '@/lib/scores';
import type { Attempt, Question } from '@/lib/types';

const mk = (p: Partial<Attempt>): Attempt => ({
  path: `study/${p.date ?? '2026-11-25'}/${p.question ?? 'q'}.md`, question: 'q', date: '2026-11-25', status: 'draft',
  seconds: 0, minutes: null, mode: null, self: null, self_score: null, ai: null, ai_score: null,
  followups: [], links: [], memo: '', explanation: '', mine: '', result: '', ...p,
});
const qq = (id: string, parent: string | null, topic = 't'): Question => ({
  id, topic, kind: 'concept', source: 'self', from: null, parent, created: '2026-11-25', text: id, answer: null,
});

describe('scores', () => {
  it('prefers ai score and ignores drafts', () => {
    expect(attemptScore(mk({ status: 'graded', self_score: 70, ai_score: 65 }))).toEqual({ score: 65, by: 'ai' });
    expect(attemptScore(mk({ status: 'pending', self_score: 70 }))).toEqual({ score: 70, by: 'self' });
    expect(attemptScore(mk({ status: 'draft' }))).toBeNull();
  });
  it('computes illusion only when graded', () => {
    expect(illusion(mk({ status: 'graded', self_score: 80, ai_score: 55 }))).toBe(25);
    expect(illusion(mk({ status: 'pending', self_score: 80 }))).toBeNull();
  });
  const as = [
    mk({ question: 'q', date: '2026-11-25', path: 'study/2026-11-25/q.md', status: 'graded', self_score: 70, ai_score: 65 }),
    mk({ question: 'q', date: '2026-11-25', path: 'study/2026-11-25/q-2.md', status: 'pending', self_score: 80 }),
    mk({ question: 'q', date: '2026-11-26', path: 'study/2026-11-26/q.md', status: 'draft' }),
  ];
  it('question score uses the latest scored attempt, suffix breaks same-day ties', () => {
    expect(questionScore(as, 'q')).toEqual({ score: 80, by: 'self' });
    expect(questionScore(as, 'none')).toBeNull();
    expect(dayStats(as)['2026-11-25']).toEqual({ count: 2, avg: 73 });
    expect(dayStats(as)['2026-11-26']).toEqual({ count: 1, avg: null });
  });
  it('averages per topic over scored questions only', () => {
    const qs = [qq('q', null, 'os'), qq('r', null, 'os'), qq('s', null, 'net')];
    const att = [...as, mk({ question: 'r', path: 'study/2026-11-25/r.md', status: 'graded', self_score: 50, ai_score: 40 })];
    expect(topicAverages(qs, att)).toEqual([{ topic: 'os', avg: 60, n: 2 }]);
  });
  it('builds a tree and survives a cycle', () => {
    const qs = [qq('a', null), qq('b', 'a'), qq('c', 'b'), qq('x', 'y'), qq('y', 'x')];
    const t = buildTree(qs);
    expect(t.find(n => n.q.id === 'a')!.children[0].children[0].q.id).toBe('c');
    const ids: string[] = [];
    const walk = (ns: typeof t) => ns.forEach(n => { ids.push(n.q.id); walk(n.children); });
    walk(t);
    expect(ids.sort()).toEqual(['a', 'b', 'c', 'x', 'y']);
  });
});
