import type { SrsCard, Box, QuizType } from './types';
import { addDays } from './date';

export interface CardIdentity {
  itemId: string;
  type: QuizType;
  sourceDate: string;
}

export interface SrsUpdate {
  card: SrsCard | null;
  mastered: boolean;
}

/** box에 도달했을 때 며칠 뒤에 다시 낼지 */
export const DUE_DAYS: Record<Box, number> = { 0: 1, 1: 3, 2: 7, 3: 14 };

export function cardKey(type: QuizType, itemId: string): string {
  return `${type}:${itemId}`;
}

/**
 * 한 문항의 답을 반영한 다음 상태를 돌려준다.
 * 틀리면 어느 단계에서든 box 0(내일)로 떨어진다. 맞히면 한 칸 올라가고,
 * box 3에서 맞히면 졸업한다. current가 null이면 아직 카드가 없는 신규 항목이다.
 */
export function nextState(
  current: SrsCard | null,
  correct: boolean,
  today: string,
  identity: CardIdentity,
): SrsUpdate {
  if (!correct) {
    return { card: { ...identity, box: 0, dueDate: addDays(today, DUE_DAYS[0]) }, mastered: false };
  }
  const nextBox = current === null ? 1 : current.box + 1;
  if (nextBox > 3) return { card: null, mastered: true };
  const box = nextBox as Box;
  return { card: { ...identity, box, dueDate: addDays(today, DUE_DAYS[box]) }, mastered: false };
}
