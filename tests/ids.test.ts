import { describe, it, expect } from 'vitest';
import { normalizeText, slugify, makeId, seqOf } from '@/lib/ids.mjs';

describe('ids', () => {
  it('makes the spec example id', () => {
    expect(makeId(6, '프로세스와 스레드의 차이를 설명해 주시겠어요?')).toBe('0006-프로세스와-스레드의-차이를-설명해-주시겠어요');
  });
  it('caps slug at 30 chars without a trailing dash', () => {
    const s = slugify('가'.repeat(29) + ' 나다');
    expect(s.length).toBeLessThanOrEqual(30); expect(s.endsWith('-')).toBe(false);
  });
  it('treats NFD and spacing/punctuation variants as the same text', () => {
    const a = '뮤텍스와 세마포어의 차이는?'; const b = '뮤텍스와세마포어의 차이는'.normalize('NFD');
    expect(normalizeText(a)).toBe(normalizeText(b));
  });
  it('keeps + and # so C, C++, C# stay distinct', () => {
    const a = normalizeText('C와 C++의 차이'), b = normalizeText('C와 C#의 차이'), c = normalizeText('C와 C의 차이');
    expect(a).not.toBe(b); expect(b).not.toBe(c); expect(a).not.toBe(c);
  });
  it('slugify whitelists letters, digits and dashes', () => {
    const s = slugify('C++ 와 C#의 차이?');
    expect(s).not.toMatch(/[+#?]/);
  });
  it('cuts by code points without lone surrogates', () => {
    const s = slugify('가'.repeat(29) + '😀😀나');
    expect(Array.from(s).length).toBeLessThanOrEqual(30);
    expect(Array.from(s).every(ch => ch.length === 1 || ch.codePointAt(0)! > 0xFFFF)).toBe(true);
  });
  it('makeId with empty slug is just the seq', () => { expect(makeId(6, '???')).toBe('0006'); });
  it('reads sequence numbers', () => { expect(seqOf('0038-x')).toBe(38); expect(seqOf('x')).toBe(0); });
});
