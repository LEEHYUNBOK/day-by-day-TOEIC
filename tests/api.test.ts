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
import { PUT as putRetro } from '@/app/api/retro/route';

const json = (url: string, method: string, body: unknown) =>
  new NextRequest(`http://x${url}`, {
    method,
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

describe('request guards', () => {
  const body = JSON.stringify({ text: 'g', topic: 't', source: 'mock' });
  const mk = (headers: Record<string, string>) => new NextRequest('http://x/api/questions', { method: 'POST', body, headers });
  it('403 on foreign host (DNS rebinding), ok on localhost/127.0.0.1', async () => {
    const j = { 'content-type': 'application/json' };
    expect((await postQuestion(mk({ ...j, host: 'evil.example:3000' }))).status).toBe(403);
    expect((await postQuestion(mk({ ...j, host: 'localhost:3000' }))).status).toBe(200);
    expect((await postQuestion(mk({ ...j, host: '127.0.0.1:3000' }))).status).toBe(200);
  });
  it('415 on non-JSON content type', async () => {
    expect((await postQuestion(mk({ 'content-type': 'text/plain' }))).status).toBe(415);
  });
  it('403 on cross-site, ok on same-origin/none/absent', async () => {
    const j = { 'content-type': 'application/json' };
    expect((await postQuestion(mk({ ...j, 'sec-fetch-site': 'cross-site' }))).status).toBe(403);
    expect((await postQuestion(mk({ ...j, 'sec-fetch-site': 'same-site' }))).status).toBe(403);
    expect((await postQuestion(mk({ ...j, 'sec-fetch-site': 'same-origin' }))).status).toBe(200);
    expect((await postQuestion(mk({ ...j, 'sec-fetch-site': 'none' }))).status).toBe(200);
    expect((await postQuestion(mk(j))).status).toBe(200);
    const a = new NextRequest('http://x/api/audio?path=study/2026-01-01/a.md', {
      method: 'POST', body: new Blob([new Uint8Array([1])]), headers: { 'sec-fetch-site': 'cross-site' },
    });
    expect((await postAudio(a)).status).toBe(403);
  });
  it('audio refuses non-draft attempts (409)', async () => {
    const q = await (await postQuestion(json('/api/questions', 'POST', { text: '제출된 질문', topic: 't', source: 'mock' }))).json();
    const p = (await (await postAttempt(json('/api/attempts', 'POST', { questionId: q.question.id }))).json()).attempt.path;
    await submit(json('/api/attempts/submit', 'POST', { path: p, explanation: 'e', mode: 'write', self: { concept: 0, tradeoff: 0 } }));
    const r = new NextRequest(`http://x/api/audio?path=${encodeURIComponent(p)}`, { method: 'POST', body: new Blob([new Uint8Array([1])]) });
    expect((await postAudio(r)).status).toBe(409);
  });
});

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
    expect((await postQuestion(json('/api/questions', 'POST', { text: 'a', topic: 't', source: 'followup' }))).status).toBe(400);
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

describe('PUT /api/retro', () => {
  it('writes, rejects bad date (400) and non-JSON (415)', async () => {
    const v = { read: 'r', dev: 'd', retro: 'x' };
    expect((await putRetro(json('/api/retro', 'PUT', { date: '2026-11-25', ...v }))).status).toBe(200);
    expect(fs.readFileSync(path.join(tmp, 'study/2026-11-25.md'), 'utf8')).toContain('## 회고\nx');
    expect((await putRetro(json('/api/retro', 'PUT', { date: '../x', ...v }))).status).toBe(400);
    expect((await putRetro(json('/api/retro', 'PUT', { date: '2026-11-25', read: 1, dev: '', retro: '' }))).status).toBe(400);
    const t = new NextRequest('http://x/api/retro', { method: 'PUT', body: '{}', headers: { 'content-type': 'text/plain' } });
    expect((await putRetro(t)).status).toBe(415);
  });
});
