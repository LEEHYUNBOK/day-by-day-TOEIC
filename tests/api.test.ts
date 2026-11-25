// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const tmp = await vi.hoisted(async () => {
  const [fs, os, path] = await Promise.all([import('node:fs'), import('node:os'), import('node:path')]);
  return fs.mkdtempSync(path.join(os.tmpdir(), 'api-'));
});
vi.mock('@/lib/paths', () => ({ DATA_ROOT: tmp }));

import { NextRequest } from 'next/server';
import { POST as postQuestion } from '@/app/api/questions/route';
import { POST as postAttempt, PATCH as patchAttempt } from '@/app/api/attempts/route';
import { POST as submit } from '@/app/api/attempts/submit/route';
import { POST as postAudio } from '@/app/api/audio/route';

const json = (url: string, method: string, body: unknown) =>
  new NextRequest(`http://x${url}`, { method, body: typeof body === 'string' ? body : JSON.stringify(body) });

describe('write APIs', () => {
  it('question -> attempt -> patch -> submit -> patch 409', async () => {
    const q = await (await postQuestion(json('/api/questions', 'POST', { text: '프로세스와 스레드의 차이는?', topic: '운영체제', source: 'self', parent: 'x', answer: 'y' }))).json();
    expect(q.created).toBe(true);
    expect(q.question.parent).toBeNull();
    expect(q.question.answer).toBeNull();
    const a = await (await postAttempt(json('/api/attempts', 'POST', { questionId: q.question.id }))).json();
    const p = a.attempt.path;
    const r = await patchAttempt(json('/api/attempts', 'PATCH', { path: p, patch: { memo: 'm', seconds: 10, links: ['https://a.b'] } }));
    expect(r.status).toBe(200);
    expect((await r.json()).attempt.memo).toBe('m');
    expect((await patchAttempt(json('/api/attempts', 'PATCH', { path: p, patch: { seconds: -1 } }))).status).toBe(400);
    expect((await patchAttempt(json('/api/attempts', 'PATCH', { path: p, patch: { links: 'x' } }))).status).toBe(400);
    expect((await submit(json('/api/attempts/submit', 'POST', { path: p, explanation: ' ', mode: 'write', self: { concept: 30, tradeoff: 20 } }))).status).toBe(400);
    expect((await submit(json('/api/attempts/submit', 'POST', { path: p, explanation: 'e', mode: 'write', self: { concept: 31, tradeoff: 20 } }))).status).toBe(400);
    const s = await submit(json('/api/attempts/submit', 'POST', { path: p, explanation: 'e', mode: 'write', self: { concept: 30, tradeoff: 20 } }));
    expect(s.status).toBe(200);
    expect((await s.json()).attempt.status).toBe('pending');
    expect((await patchAttempt(json('/api/attempts', 'PATCH', { path: p, patch: { memo: 'z' } }))).status).toBe(409);
    expect((await submit(json('/api/attempts/submit', 'POST', { path: p, explanation: 'e', mode: 'write', self: { concept: 30, tradeoff: 20 } }))).status).toBe(409);
  });

  it('rejects bad input', async () => {
    expect((await patchAttempt(json('/api/attempts', 'PATCH', { path: '../x.md', patch: {} }))).status).toBe(400);
    expect((await patchAttempt(json('/api/attempts', 'PATCH', { path: 'study/2026-01-01/none.md', patch: {} }))).status).toBe(404);
    expect((await postQuestion(json('/api/questions', 'POST', { text: '', topic: 't', source: 'mock' }))).status).toBe(400);
    expect((await postQuestion(json('/api/questions', 'POST', { text: 'a', topic: 't', source: 'bad' }))).status).toBe(400);
    expect((await postQuestion(json('/api/questions', 'POST', '{bad'))).status).toBe(400);
    expect((await postAttempt(json('/api/attempts', 'POST', { questionId: 'nope' }))).status).toBe(404);
  });

  it('audio', async () => {
    const q = await (await postQuestion(json('/api/questions', 'POST', { text: '오디오 질문', topic: 't', source: 'mock' }))).json();
    const p = (await (await postAttempt(json('/api/attempts', 'POST', { questionId: q.question.id }))).json()).attempt.path;
    const req = (qs: string, body: number[]) =>
      new NextRequest(`http://x/api/audio?path=${encodeURIComponent(qs)}`, { method: 'POST', body: new Blob([new Uint8Array(body)]) });
    expect((await postAudio(req(p, [1, 2, 3]))).status).toBe(200);
    expect(fs.readFileSync(path.join(tmp, p.replace(/\.md$/, '.webm')))).toEqual(Buffer.from([1, 2, 3]));
    expect((await postAudio(req(p, []))).status).toBe(400);
    expect((await postAudio(req('../x.md', [1]))).status).toBe(400);
    expect((await postAudio(req('study/2026-01-01/none.md', [1]))).status).toBe(404);
    const big = new NextRequest(`http://x/api/audio?path=${encodeURIComponent(p)}`, { method: 'POST', body: new Uint8Array(1), headers: { 'content-length': String(51 * 1024 * 1024) } });
    expect((await postAudio(big)).status).toBe(413);
  });
});
