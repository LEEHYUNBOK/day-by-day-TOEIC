export interface Word {
  id: string; word: string; pos: string; meaning: string;
  example: string; exampleKo: string;
}
export interface Sentence {
  id: string; text: string; ko: string;
  blankWord: string; distractors: string[];
}
export interface DayContent {
  date: string; title: string; words: Word[]; sentences: Sentence[];
}
export interface DayIndexEntry { date: string; title: string; }

export type QuizType = 'word' | 'blank' | 'arrange';

export interface DayRecord {
  date: string;
  completedAt: string; // ISO
  scores: { word: number; blank: number; arrange: number }; // 0~100 정수
}
export interface WrongNote {
  type: QuizType; itemId: string; date: string; wrongCount: number;
}
export interface ReviewRecord {
  takenAt: string; // ISO
  scope: 'recent7' | 'all' | 'wrong';
  correct: number; total: number;
}
