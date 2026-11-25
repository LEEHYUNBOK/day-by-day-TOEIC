// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createQuestion } from '@/lib/questions.mjs';
import {
  today, assertAttemptPath, listAttempts, readAttempt, attemptOrder, startAttempt,
  saveDraft, submitAttempt, audioPathFor, NotDraftError, BadPathError, ValidationError,
} from '@/lib/attempts';

let tmp: string;
let qid: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-'));
  qid = createQuestion(tmp, { text: '프로세스와 스레드의 차이는?', topic: '운영체제', source: 'mock', created: '2026-11-25' }).question.id;
});

describe('attempts', () => {
  it('returns [] when data dir missing', () => { expect(listAttempts(tmp)).toEqual([]); });
  it('resumes a same-day draft, then suffixes after submit', () => {
    const a1 = startAttempt(tmp, qid, '2026-11-25');
    expect(startAttempt(tmp, qid, '2026-11-25').path).toBe(a1.path);
    submitAttempt(tmp, a1.path, { explanation: '설명', mode: 'write', self: { concept: 30, tradeoff: 40 } });
    const a2 = startAttempt(tmp, qid, '2026-11-25');
    expect(a2.path).toBe(`study/2026-11-25/${qid}-2.md`); expect(attemptOrder(a2)).toEqual(['2026-11-25', 2]);
    expect(attemptOrder(a1)).toEqual(['2026-11-25', 1]);
  });
  it('submit fixes score and minutes', () => {
    const a = startAttempt(tmp, qid, '2026-11-25');
    saveDraft(tmp, a.path, { seconds: 4500, memo: 'm', links: ['https://x.io/a?b=1'] });
    const s = submitAttempt(tmp, a.path, { explanation: '설명', mode: 'voice', self: { concept: 60, tradeoff: 20 } });
    expect(s).toMatchObject({ status: 'pending', self_score: 80, minutes: 75, memo: 'm', mode: 'voice', links: ['https://x.io/a?b=1'] });
    expect(fs.readFileSync(path.join(tmp, a.path), 'utf8')).not.toContain('seconds');
    expect(readAttempt(tmp, a.path)).toEqual(s);
  });
  it('rejects section-heading lines in user text', () => {
    const a = startAttempt(tmp, qid, '2026-11-25');
    expect(() => saveDraft(tmp, a.path, { memo: 'a\n## 회고  \nb' })).toThrow(ValidationError);
    expect(() => saveDraft(tmp, a.path, { explanation: '## 내 설명' })).toThrow(ValidationError);
    expect(() => submitAttempt(tmp, a.path, { explanation: 'x', mode: 'write', self: { concept: 0, tradeoff: 0 }, mine: '## 채점 결과' })).toThrow(ValidationError);
    saveDraft(tmp, a.path, { memo: '## 다른 제목' });
    expect(readAttempt(tmp, a.path)!.memo).toBe('## 다른 제목');
  });
  it('saveDraft refuses non-draft', () => {
    const a = startAttempt(tmp, qid, '2026-11-25');
    submitAttempt(tmp, a.path, { explanation: 'x', mode: 'write', self: { concept: 0, tradeoff: 0 } });
    const before = fs.readFileSync(path.join(tmp, a.path), 'utf8');
    expect(() => saveDraft(tmp, a.path, { memo: 'late' })).toThrow(NotDraftError);
    expect(() => submitAttempt(tmp, a.path, { explanation: 'y', mode: 'write', self: { concept: 0, tradeoff: 0 } })).toThrow(NotDraftError);
    expect(fs.readFileSync(path.join(tmp, a.path), 'utf8')).toBe(before);
  });
  it('rejects invalid self scores and empty explanations', () => {
    const a = startAttempt(tmp, qid, '2026-11-25');
    expect(() => submitAttempt(tmp, a.path, { explanation: 'x', mode: 'write', self: { concept: 45, tradeoff: 0 } })).toThrow();
    expect(() => submitAttempt(tmp, a.path, { explanation: '  ', mode: 'write', self: { concept: 0, tradeoff: 0 } })).toThrow();
    expect(readAttempt(tmp, a.path)!.status).toBe('draft');
  });
  it('rejects paths outside study/', () => {
    for (const p of ['../x.md', 'study/2026-11-25/../../a.md', 'questions/a.md', 'study/x/a.md'])
      expect(() => assertAttemptPath(p)).toThrow(BadPathError);
    expect(() => readAttempt(tmp, '../x.md')).toThrow(BadPathError);
  });
  it('preserves keys it does not own and reads grading fields', () => {
    const a = startAttempt(tmp, qid, '2026-11-25');
    const f = path.join(tmp, a.path);
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('status: draft', 'status: draft\nai: {"concept":45,"tradeoff":20}\nai_score: 65\nfollowups: ["a-b"]'));
    saveDraft(tmp, a.path, { memo: 'n', mode: 'write' });
    const r = readAttempt(tmp, a.path)!;
    expect(r).toMatchObject({ ai: { concept: 45, tradeoff: 20 }, ai_score: 65, followups: ['a-b'], mode: 'write', memo: 'n' });
    expect(fs.readFileSync(f, 'utf8')).toContain('ai_score: 65');
  });
  it('lists only date-folder files, NFC paths, skips retro files', () => {
    const a = startAttempt(tmp, qid, '2026-11-25');
    fs.writeFileSync(path.join(tmp, 'study', '2026-11-25.md'), '---\n---\n## 회고\nx\n');
    fs.mkdirSync(path.join(tmp, 'study', 'misc'));
    fs.writeFileSync(path.join(tmp, 'study', 'misc', 'a.md'), 'x');
    const dir = path.join(tmp, 'study', '2026-11-25');
    fs.renameSync(path.join(dir, qid + '.md'), path.join(dir, qid.normalize('NFD') + '.md'));
    expect(listAttempts(tmp).map(x => x.path)).toEqual([a.path]);
    expect(startAttempt(tmp, qid, '2026-11-25').path).toBe(a.path);
  });
  it('today and audioPathFor', () => {
    expect(today(new Date(2026, 10, 5))).toBe('2026-11-05');
    expect(audioPathFor('study/2026-11-25/a-2.md')).toBe('study/2026-11-25/a-2.webm');
  });
  it('throws for unknown question', () => { expect(() => startAttempt(tmp, 'nope', '2026-11-25')).toThrow(); });
});
