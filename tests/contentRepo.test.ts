import { describe, it, expect } from 'vitest';
import { toBundle } from '@/lib/contentRepo';
import type { RawSet, RawWord, RawSentence } from '@/lib/contentRepo';

const sets: RawSet[] = [
  { id: 10, seq: 2 },
  { id: 20, seq: 1 },
];
const rawWord = (item_id: string, set_id: number, seq: number): RawWord => ({
  item_id, set_id, seq,
  word: 'w', pos: 'v.', meaning: '뜻', example: 'e', example_ko: 'ek',
});
const rawSentence = (item_id: string, set_id: number, seq: number): RawSentence => ({
  item_id, set_id, seq,
  text: 'The manager will negotiate the contract.', ko: '해석',
  blank_word: 'negotiate', distractors: ['a', 'b', 'c'],
});

describe('toBundle — 순서', () => {
  it('묶음 seq 순으로 정렬한다 (id 순이 아니다)', () => {
    const words = [rawWord('w-b', 20, 1), rawWord('w-a', 10, 1)];
    const out = toBundle(sets, words, []);
    expect(out.words.map((w) => w.id)).toEqual(['w-b', 'w-a']);
  });
  it('같은 묶음 안에서는 항목 seq 순으로 정렬한다', () => {
    const words = [rawWord('w-2', 10, 2), rawWord('w-1', 10, 1)];
    const out = toBundle(sets, words, []);
    expect(out.words.map((w) => w.id)).toEqual(['w-1', 'w-2']);
  });
  it('문장도 같은 규칙으로 정렬한다', () => {
    const sentences = [rawSentence('s-b', 20, 1), rawSentence('s-a', 10, 1)];
    const out = toBundle(sets, [], sentences);
    expect(out.sentences.map((s) => s.id)).toEqual(['s-b', 's-a']);
  });
  it('알 수 없는 set_id를 가진 항목은 버린다', () => {
    const words = [rawWord('w-orphan', 999, 1), rawWord('w-ok', 10, 1)];
    const out = toBundle(sets, words, []);
    expect(out.words.map((w) => w.id)).toEqual(['w-ok']);
  });
});

describe('toBundle — 필드 매핑', () => {
  it('snake_case를 camelCase로 옮긴다', () => {
    const out = toBundle(sets, [rawWord('w-1', 10, 1)], [rawSentence('s-1', 10, 1)]);
    expect(out.words[0]).toEqual({
      id: 'w-1', word: 'w', pos: 'v.', meaning: '뜻', example: 'e', exampleKo: 'ek',
    });
    expect(out.sentences[0]).toEqual({
      id: 's-1',
      text: 'The manager will negotiate the contract.',
      ko: '해석',
      blankWord: 'negotiate',
      distractors: ['a', 'b', 'c'],
    });
  });
  it('빈 입력은 빈 번들이다', () => {
    expect(toBundle([], [], [])).toEqual({ words: [], sentences: [] });
  });
});
