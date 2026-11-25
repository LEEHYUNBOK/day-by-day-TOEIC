import type { Question, Kind, Source } from './types';

export function listQuestions(root: string): Question[];
export function readQuestion(root: string, id: string): Question | null;
export function inferKind(text: string): Kind;
export function createQuestion(
  root: string,
  input: {
    text: string;
    topic: string;
    source: Source;
    from?: string | null;
    parent?: string | null;
    answer?: string | null;
    kind?: Kind;
    created: string;
  },
): { question: Question; created: boolean };
