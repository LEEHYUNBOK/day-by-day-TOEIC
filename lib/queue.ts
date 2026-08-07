import type { SrsCard } from './types';
import { cardKey, type CardIdentity } from './srs';
import { shuffle } from './quiz';

/** 한 판의 문항 수 */
export const SESSION_SIZE = 20;

/**
 * 한 판에 낼 항목을 고른다.
 * 밀린 복습을 먼저 갚고(오래 밀린 것부터), 남는 자리를 아직 안 본 항목으로 채운다.
 * 후보가 모자라면 size보다 적게 돌려준다.
 */
export function buildQueue(
  cards: SrsCard[],
  candidates: CardIdentity[],
  masteredKeys: Set<string>,
  today: string,
  size: number = SESSION_SIZE,
  rng: () => number = Math.random,
): CardIdentity[] {
  const due = cards
    .filter((c) => c.dueDate <= today)
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, size)
    .map((c) => ({ itemId: c.itemId, type: c.type }));

  const seen = new Set(cards.map((c) => cardKey(c.type, c.itemId)));
  const fresh: CardIdentity[] = [];
  for (const c of candidates) {
    if (due.length + fresh.length >= size) break;
    const key = cardKey(c.type, c.itemId);
    if (seen.has(key) || masteredKeys.has(key)) continue;
    fresh.push(c);
  }

  return shuffle([...due, ...fresh], rng);
}
