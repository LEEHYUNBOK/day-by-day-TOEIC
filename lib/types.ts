export interface Word {
  id: string; word: string; pos: string; meaning: string;
  example: string; exampleKo: string;
}
export interface Sentence {
  id: string; text: string; ko: string;
  blankWord: string; distractors: string[];
}
export type QuizType = 'word' | 'blank' | 'arrange';

export type Box = 0 | 1 | 2 | 3;

export interface SrsCard {
  itemId: string;      // 'w-negotiate' 또는 's-0804-1'
  type: QuizType;
  box: Box;
  dueDate: string;     // YYYY-MM-DD, 이 날부터 출제 대상
}

export interface MasteredItem {
  itemId: string;
  type: QuizType;
  masteredAt: string;  // ISO
}

export interface SessionRecord {
  finishedAt: string;  // ISO
  date: string;        // YYYY-MM-DD (로컬)
  correct: number;
  total: number;
}
