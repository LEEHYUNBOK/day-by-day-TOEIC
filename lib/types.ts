export type Kind = 'concept' | 'experience';
export type Source = 'real' | 'mock' | 'self' | 'followup';
export interface Question {
  id: string;
  topic: string;
  kind: Kind;
  source: Source;
  from: string | null;
  parent: string | null;
  created: string;
  text: string;
  answer: string | null;
}
export type Status = 'draft' | 'pending' | 'graded';
export interface Rubric {
  concept: number;
  tradeoff: number;
}
export interface Attempt {
  path: string;
  question: string;
  date: string;
  status: Status;
  seconds: number;
  minutes: number | null;
  mode: 'write' | 'voice' | null;
  self: Rubric | null;
  self_score: number | null;
  ai: Rubric | null;
  ai_score: number | null;
  followups: string[];
  links: string[];
  memo: string;
  explanation: string;
  mine: string;
  result: string;
}
