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
  it('prefers same-day words over the wider pool for distractors', () => {
    const target = w('t-1', 'target', '표적');
    const dayWords = [
      target,
      w('t-2', 'apple', '사과'),
      w('t-3', 'banana', '바나나'),
      w('t-4', 'cherry', '체리'),
    ];
    const poolOnly = [
      w('p-1', 'durian', '두리안'),
      w('p-2', 'egg', '계란'),
      w('p-3', 'fig', '무화과'),
    ];
    const pool = [...dayWords, ...poolOnly];
    const items = buildWordQuiz(dayWords, pool, fixedRng);
    const item = items.find(i => i.itemId === 't-1')!;
    const distractorTexts = item.choices.filter(c => !c.correct).map(c => c.text);
    expect(distractorTexts.slice().sort()).toEqual(['바나나', '사과', '체리']);
  });
  it('throws when the pool cannot supply 3 distinct wrong meanings', () => {
    const target = w('t-1', 'target', '표적');
    const tooSmallPool = [target, w('t-2', 'only-other', '유일한')];
    expect(() => buildWordQuiz([target], tooSmallPool, fixedRng)).toThrow();
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
  it('terminates and still differs from the answer when the rng keeps producing identity order', () => {
    // rng = 0.99 makes every Fisher-Yates draw pick j === i, so the very first
    // shuffle (and every retry) reproduces the answer order verbatim. This forces
    // the bounded-retry loop to exhaust and fall back to the guaranteed swap.
    const identityRng = () => 0.99;
    const [item] = buildArrangeQuiz([sent], identityRng);
    expect(item.tokens.slice().sort()).toEqual(item.answerTokens.slice().sort());
    expect(item.tokens).not.toEqual(item.answerTokens);
  }, 1000);
  it('terminates on all-identical tokens even though no different arrangement exists', () => {
    const degenerate: Sentence = {
      id: 's-2', text: 'x x x', ko: '', blankWord: 'x', distractors: [],
    };
    const [item] = buildArrangeQuiz([degenerate], fixedRng);
    expect(item.tokens).toEqual(['x', 'x', 'x']);
  }, 1000);
});
