// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listQuestions, readQuestion, createQuestion } from '@/lib/questions.mjs';
import { seqOf } from '@/lib/ids.mjs';

let tmp: string;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-')); });

describe('questions', () => {
  it('returns [] when data dir missing', () => { expect(listQuestions(tmp)).toEqual([]); });
  it('creates with next sequence and dedups by text', () => {
    const a = createQuestion(tmp, { text: '프로세스와 스레드의 차이는?', topic: '운영체제', source: 'mock', created: '2026-11-25' });
    const b = createQuestion(tmp, { text: '프로세스와 스레드의 차이는', topic: '운영체제', source: 'mock', created: '2026-11-25' });
    const c = createQuestion(tmp, { text: 'WebFlux를 사용해 보신 경험이 있으신가요?', topic: 'Spring', source: 'mock', created: '2026-11-25' });
    expect(a.created).toBe(true); expect(b).toMatchObject({ created: false, question: { id: a.question.id } });
    expect(seqOf(c.question.id)).toBe(2); expect(c.question.kind).toBe('experience');
  });
  it('stores and reads the reference answer', () => {
    const { question } = createQuestion(tmp, { text: 'q', topic: 't', source: 'self', answer: '**답**', created: '2026-11-25' });
    expect(readQuestion(tmp, question.id)).toMatchObject({ text: 'q', answer: '**답**', parent: null });
  });
  it('lists NFD-named files as NFC ids', () => {
    const { question } = createQuestion(tmp, { text: '뮤텍스', topic: 't', source: 'self', created: '2026-11-25' });
    const dir = path.join(tmp, 'questions');
    fs.renameSync(path.join(dir, question.id + '.md'), path.join(dir, question.id.normalize('NFD') + '.md'));
    expect(listQuestions(tmp).map(q => q.id)).toContain(question.id);
    expect(createQuestion(tmp, { text: '뮤텍스', topic: 't', source: 'self', created: '2026-11-25' }).created).toBe(false);
  });
});
