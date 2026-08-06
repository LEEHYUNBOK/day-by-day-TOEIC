import type { SrsCard, MasteredItem, SessionRecord, QuizType } from './types';
import { cardKey, nextState, type CardIdentity } from './srs';
import { addDays } from './date';

const KEYS = {
  cards: 'ddt.srs',
  mastered: 'ddt.mastered',
  sessions: 'ddt.sessions',
} as const;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getCards(): SrsCard[] {
  const v = load<SrsCard[]>(KEYS.cards, []);
  return Array.isArray(v) ? v : [];
}
export function getMastered(): MasteredItem[] {
  const v = load<MasteredItem[]>(KEYS.mastered, []);
  return Array.isArray(v) ? v : [];
}
export function getMasteredKeys(): Set<string> {
  return new Set(getMastered().map((m) => cardKey(m.type, m.itemId)));
}
export function getSessions(): SessionRecord[] {
  const v = load<SessionRecord[]>(KEYS.sessions, []);
  return Array.isArray(v) ? v : [];
}

export function findCard(cards: SrsCard[], type: QuizType, itemId: string): SrsCard | null {
  return cards.find((c) => c.type === type && c.itemId === itemId) ?? null;
}

export interface AnsweredItem {
  identity: CardIdentity;
  correct: boolean;
}

/**
 * 한 판의 결과를 한 번에 반영한다. 문항마다 저장하지 않는 이유는
 * 중간 이탈 시 아무것도 기록하지 않기 위해서다(전부 아니면 전무).
 */
export function commitSession(
  answers: AnsweredItem[],
  today: string,
  finishedAt: string,
): { masteredCount: number } {
  let cards = getCards();
  const mastered = getMastered();
  let masteredCount = 0;

  for (const { identity, correct } of answers) {
    const current = findCard(cards, identity.type, identity.itemId);
    const update = nextState(current, correct, today, identity);
    cards = cards.filter((c) => !(c.type === identity.type && c.itemId === identity.itemId));
    if (update.mastered) {
      mastered.push({ itemId: identity.itemId, type: identity.type, masteredAt: finishedAt });
      masteredCount += 1;
    } else if (update.card) {
      cards.push(update.card);
    }
  }

  save(KEYS.cards, cards);
  save(KEYS.mastered, mastered);
  save(KEYS.sessions, [
    ...getSessions(),
    {
      finishedAt,
      date: today,
      correct: answers.filter((a) => a.correct).length,
      total: answers.length,
    },
  ]);

  return { masteredCount };
}

export function calcStreak(sessions: SessionRecord[], today: string): number {
  const days = new Set(sessions.map((s) => s.date));
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) { streak += 1; cursor = addDays(cursor, -1); }
  return streak;
}

export function countDueOn(cards: SrsCard[], date: string): number {
  return cards.filter((c) => c.dueDate <= date).length;
}
