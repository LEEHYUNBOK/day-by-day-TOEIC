import type { QuizType } from './types';

export interface AnswerLog { type: QuizType; itemId: string; correctOnFirstTry: boolean; }

export function scoreOf(logs: AnswerLog[], type: QuizType): number {
  const of = logs.filter(l => l.type === type);
  if (of.length === 0) return 100;
  return Math.round((of.filter(l => l.correctOnFirstTry).length / of.length) * 100);
}
