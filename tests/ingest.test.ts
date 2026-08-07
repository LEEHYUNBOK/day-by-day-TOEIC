import { describe, it, expect } from 'vitest';
import { validateInput } from '../scripts/ingest.mjs';

const word = (id = 'w-renew') => ({
  id, word: 'renew', pos: 'v.', meaning: '갱신하다',
  example: 'We need to renew the lease.', exampleKo: '임대차 계약을 갱신해야 한다.',
});
const sentence = (id = 's-1', over: Record<string, unknown> = {}) => ({
  id,
  text: 'The tenant will renew the lease next month.',
  ko: '세입자가 다음 달에 임대차 계약을 갱신할 것이다.',
  blankWord: 'renew',
  distractors: ['reduce', 'remove', 'reverse'],
  ...over,
});
const input = (over: Record<string, unknown> = {}) => ({
  title: 'Day 15 — 계약 갱신', words: [word()], sentences: [sentence()], ...over,
});

describe('validateInput — 통과하는 경우', () => {
  it('정상 입력', () => {
    expect(validateInput(input(), new Set())).toEqual({ ok: true });
  });
  it('문장 0개도 허용한다', () => {
    expect(validateInput(input({ sentences: [] }), new Set())).toEqual({ ok: true });
  });
  it('단어 1개면 통과한다 (분량 제한 없음)', () => {
    expect(validateInput(input({ words: [word()] }), new Set()).ok).toBe(true);
  });
});

describe('validateInput — 필수 필드', () => {
  it('title 없으면 거부', () => {
    const r = validateInput(input({ title: '' }), new Set());
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/title/);
  });
  it('단어가 0개면 거부', () => {
    const r = validateInput(input({ words: [] }), new Set());
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/단어/);
  });
  it('단어 필드가 빠지면 거부', () => {
    const bad = { ...word(), meaning: '' };
    const r = validateInput(input({ words: [bad] }), new Set());
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/meaning/);
  });
});

describe('validateInput — blankWord 규칙', () => {
  it('text에 없으면 거부', () => {
    const r = validateInput(input({ sentences: [sentence('s-1', { blankWord: 'absent' })] }), new Set());
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/blankWord/);
  });
  it('두 번 나오면 거부', () => {
    const r = validateInput(input({
      sentences: [sentence('s-1', { text: 'We renew and renew the lease.', blankWord: 'renew' })],
    }), new Set());
    expect(r.ok).toBe(false);
  });
  it('문장 첫 단어면 거부 (검증기가 대소문자를 구분한다)', () => {
    const r = validateInput(input({
      sentences: [sentence('s-1', { text: 'Renew the lease today.', blankWord: 'Renew' })],
    }), new Set());
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/첫 단어/);
  });
  it('구두점이 붙어도 독립 토큰으로 인정한다', () => {
    const r = validateInput(input({
      sentences: [sentence('s-1', { text: 'We should renew.', blankWord: 'renew' })],
    }), new Set());
    expect(r.ok).toBe(true);
  });
});

describe('validateInput — distractors', () => {
  it('3개가 아니면 거부', () => {
    const r = validateInput(input({
      sentences: [sentence('s-1', { distractors: ['a', 'b'] })],
    }), new Set());
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/distractors/);
  });
});

describe('validateInput — id 중복', () => {
  it('파일 안에서 중복되면 거부', () => {
    const r = validateInput(input({ words: [word('w-x'), word('w-x')] }), new Set());
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/w-x/);
  });
  it('DB에 이미 있으면 거부', () => {
    const r = validateInput(input(), new Set(['w-renew']));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/w-renew/);
  });
  it('단어와 문장 id가 서로 겹쳐도 거부', () => {
    const r = validateInput(input({ words: [word('dup')], sentences: [sentence('dup')] }), new Set());
    expect(r.ok).toBe(false);
  });
});
