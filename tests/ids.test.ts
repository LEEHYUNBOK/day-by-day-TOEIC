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
  it('reads sequence numbers', () => { expect(seqOf('0038-x')).toBe(38); expect(seqOf('x')).toBe(0); });
});
