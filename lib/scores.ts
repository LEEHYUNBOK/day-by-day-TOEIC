import { attemptOrder } from './attempts';
import type { Attempt, Question } from './types';

export type Score = { score: number; by: 'ai' | 'self' };
export type TreeNode = { q: Question; children: TreeNode[] };

export function attemptScore(a: Attempt): Score | null {
  if (a.status === 'draft') return null;
  if (a.ai_score != null) return { score: a.ai_score, by: 'ai' };
  if (a.self_score != null) return { score: a.self_score, by: 'self' };
  return null;
}

export function illusion(a: Attempt): number | null {
  if (a.status !== 'graded' || a.self_score == null || a.ai_score == null) return null;
  return a.self_score - a.ai_score;
}

function later(a: Attempt, b: Attempt): number {
  const [da, na] = attemptOrder(a);
  const [db, nb] = attemptOrder(b);
  return da < db ? -1 : da > db ? 1 : na - nb;
}

export function questionScore(attempts: Attempt[], questionId: string): Score | null {
  let best: Attempt | null = null;
  for (const a of attempts) {
    if (a.question !== questionId || !attemptScore(a)) continue;
    if (!best || later(a, best) > 0) best = a;
  }
  return best && attemptScore(best);
}

export function dayStats(attempts: Attempt[]): Record<string, { count: number; avg: number | null }> {
  const acc: Record<string, { count: number; sum: number; n: number }> = {};
  for (const a of attempts) {
    const d = (acc[a.date] ??= { count: 0, sum: 0, n: 0 });
    d.count++;
    const s = attemptScore(a);
    if (s) { d.sum += s.score; d.n++; }
  }
  return Object.fromEntries(
    Object.entries(acc).map(([k, d]) => [k, { count: d.count, avg: d.n ? Math.round(d.sum / d.n) : null }]),
  );
}

export function topicAverages(questions: Question[], attempts: Attempt[]): { topic: string; avg: number; n: number }[] {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const q of questions) {
    const s = questionScore(attempts, q.id);
    if (!s) continue;
    const t = acc.get(q.topic) ?? { sum: 0, n: 0 };
    t.sum += s.score;
    t.n++;
    acc.set(q.topic, t);
  }
  return [...acc].map(([topic, t]) => ({ topic, avg: Math.round(t.sum / t.n), n: t.n }));
}

export function buildTree(questions: Question[]): TreeNode[] {
  const ids = new Set(questions.map(q => q.id));
  const kids = new Map<string, Question[]>();
  const roots: Question[] = [];
  for (const q of questions) {
    if (q.parent && ids.has(q.parent)) kids.set(q.parent, [...(kids.get(q.parent) ?? []), q]);
    else roots.push(q);
  }
  const seen = new Set<string>();
  const node = (q: Question): TreeNode => {
    seen.add(q.id);
    return { q, children: (kids.get(q.id) ?? []).filter(c => !seen.has(c.id)).map(node) };
  };
  const tree = roots.map(node);
  // Cycle-only groups have no root; surface them so they don't vanish.
  for (const q of questions) if (!seen.has(q.id)) tree.push(node(q));
  return tree;
}
