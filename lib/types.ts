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
  type: QuizType; itemId: string;
  // itemId가 속한 콘텐츠(day)의 날짜. 틀린 날짜(실수한 날짜)가 아니다 — /notes와 /review가
  // 이 값으로 dayContentByDate를 조회해 원문을 찾으므로, 항상 콘텐츠 포인터로 취급해야 한다.
  date: string;
  wrongCount: number;
}
export interface ReviewRecord {
  takenAt: string; // ISO
  scope: 'recent7' | 'all' | 'wrong';
  correct: number; total: number;
}
