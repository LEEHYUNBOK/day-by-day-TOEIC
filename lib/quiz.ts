import type { Word, Sentence } from './types';

export interface Choice { text: string; correct: boolean; }
export interface WordQuizItem  { type: 'word';    itemId: string; word: Word; choices: Choice[]; }
export interface BlankQuizItem { type: 'blank';   itemId: string; sentence: Sentence; blankedText: string; choices: Choice[]; }
export interface ArrangeQuizItem { type: 'arrange'; itemId: string; sentence: Sentence; tokens: string[]; answerTokens: string[]; }
export type QuizItem = WordQuizItem | BlankQuizItem | ArrangeQuizItem;

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildWordQuiz(words: Word[], pool: Word[], rng: () => number = Math.random): WordQuizItem[] {
  return words.map(word => {
    const sameDay = words.filter(w => w.id !== word.id && w.meaning !== word.meaning);
    const others = pool.filter(w =>
      w.id !== word.id && w.meaning !== word.meaning && !sameDay.some(s => s.id === w.id));
    const candidates = [...shuffle(sameDay, rng), ...shuffle(others, rng)];
    const distractors: string[] = [];
    for (const c of candidates) {
      if (distractors.length === 3) break;
      if (!distractors.includes(c.meaning)) distractors.push(c.meaning);
    }
    if (distractors.length < 3) {
      throw new Error(
        `buildWordQuiz: pool has only ${distractors.length} distinct wrong meaning(s) available for "${word.word}", need 3`,
      );
    }
    const choices = shuffle(
      [{ text: word.meaning, correct: true }, ...distractors.map(text => ({ text, correct: false }))],
      rng,
    );
    return { type: 'word' as const, itemId: word.id, word, choices };
  });
}

export function buildBlankQuiz(sentences: Sentence[], rng: () => number = Math.random): BlankQuizItem[] {
  return sentences.map(sentence => {
    const re = new RegExp(`\\b${sentence.blankWord}\\b`);
    const blankedText = sentence.text.replace(re, '____');
    const choices = shuffle(
      [{ text: sentence.blankWord, correct: true },
       ...sentence.distractors.map(text => ({ text, correct: false }))],
      rng,
    );
    return { type: 'blank' as const, itemId: sentence.id, sentence, blankedText, choices };
  });
}

const MAX_ARRANGE_RETRIES = 10;

export function buildArrangeQuiz(sentences: Sentence[], rng: () => number = Math.random): ArrangeQuizItem[] {
  return sentences.map(sentence => {
    const answerTokens = sentence.text.split(/\s+/);
    let tokens = shuffle(answerTokens, rng);
    if (answerTokens.length > 1) {
      let attempts = 0;
      while (tokens.join(' ') === answerTokens.join(' ') && attempts < MAX_ARRANGE_RETRIES) {
        tokens = shuffle(answerTokens, rng);
        attempts++;
      }
      if (tokens.join(' ') === answerTokens.join(' ')) {
        // Bounded retries exhausted (degenerate rng or degenerate tokens). Force a
        // deterministic swap of the first two distinct-valued tokens if one exists;
        // if every token is identical, no different arrangement exists, so return as-is.
        const firstDistinct = tokens.findIndex(t => t !== tokens[0]);
        if (firstDistinct > 0) {
          tokens = [...tokens];
          [tokens[0], tokens[firstDistinct]] = [tokens[firstDistinct], tokens[0]];
        }
      }
    }
    return { type: 'arrange' as const, itemId: sentence.id, sentence, tokens, answerTokens };
  });
}
