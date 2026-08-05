import { describe, it, expect } from 'vitest';
import { shuffle, buildWordQuiz, buildBlankQuiz, buildArrangeQuiz } from '@/lib/quiz';
import type { Word, Sentence } from '@/lib/types';

const w = (id: string, word: string, meaning: string): Word =>
  ({ id, word, pos: 'v.', meaning, example: '', exampleKo: '' });
const words = [
  w('w-a', 'alpha', '첫째'), w('w-b', 'beta', '둘째'), w('w-c', 'gamma', '셋째'),
  w('w-d', 'delta', '넷째'), w('w-e', 'epsilon', '다섯째'),
];
const sent: Sentence = {
  id: 's-1', text: 'Please revise the report today.', ko: '오늘 보고서를 수정해 주세요.',
  blankWord: 'revise', distractors: ['reside', 'resign', 'remove'],
};
const fixedRng = () => 0.42;

describe('shuffle', () => {
  it('keeps elements, does not mutate input', () => {
    const arr = [1, 2, 3, 4];
    const out = shuffle(arr, fixedRng);
    expect(out.slice().sort()).toEqual([1, 2, 3, 4]);
    expect(arr).toEqual([1, 2, 3, 4]);
  });
});

describe('buildWordQuiz', () => {
  it('4 choices, exactly one correct, correct is the meaning', () => {
    const items = buildWordQuiz(words, words, fixedRng);
    expect(items).toHaveLength(5);
    for (const it of items) {
      expect(it.choices).toHaveLength(4);
      expect(it.choices.filter(c => c.correct)).toHaveLength(1);
      expect(it.choices.find(c => c.correct)!.text).toBe(it.word.meaning);
    }
  });
  it('excludes duplicate meanings from distractors', () => {
    const pool = [...words, w('w-a2', 'omega', '첫째')]; // '첫째' 뜻 중복
    const items = buildWordQuiz([words[0]], pool, fixedRng);
    const texts = items[0].choices.map(c => c.text);
    expect(texts.filter(t => t === '첫째')).toHaveLength(1);
  });
});

describe('buildBlankQuiz', () => {
  it('replaces blankWord with ____ and offers 4 choices', () => {
    const [item] = buildBlankQuiz([sent], fixedRng);
    expect(item.blankedText).toBe('Please ____ the report today.');
    expect(item.choices.map(c => c.text).sort())
      .toEqual(['remove', 'reside', 'resign', 'revise']);
    expect(item.choices.find(c => c.correct)!.text).toBe('revise');
  });
});

describe('buildArrangeQuiz', () => {
  it('tokens are a permutation of answer, not in answer order', () => {
    const [item] = buildArrangeQuiz([sent], fixedRng);
    expect(item.answerTokens).toEqual(['Please', 'revise', 'the', 'report', 'today.']);
    expect(item.tokens.slice().sort()).toEqual(item.answerTokens.slice().sort());
    expect(item.tokens).not.toEqual(item.answerTokens);
  });
});
