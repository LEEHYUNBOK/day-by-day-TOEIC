import { describe, it, expect } from 'vitest';
import { parse, stringify, getSection, setSection } from '@/lib/frontmatter.mjs';

describe('frontmatter', () => {
  it('round-trips scalars, objects, arrays', () => {
    const data = { id: '0006-프로세스와-스레드', date: '2026-11-25', minutes: 75, parent: null,
      self: { concept: 30, tradeoff: 40 }, followups: ['0012-a', '0038-b'] };
    expect(parse(stringify(data, 'body\n')).data).toEqual(data);
  });
  it('round-trips awkward strings', () => {
    const data = { from: '미리디: 기술 "스크리닝" #1', link: 'https://a.com/x?y=1#z', text: '첫 줄\n둘째 줄', num: '0006' };
    expect(parse(stringify(data, '')).data).toEqual(data);
  });
  it('writes plain ids without quotes', () => {
    expect(stringify({ id: '0006-프로세스' }, '')).toContain('id: 0006-프로세스\n');
  });
  it('returns body as-is after the closing fence', () => {
    expect(parse(stringify({ a: 1 }, '## x\nhi\n')).body).toBe('## x\nhi\n');
    expect(parse('no frontmatter')).toEqual({ data: {}, body: 'no frontmatter' });
  });
  it('reads and replaces sections', () => {
    const body = '## 공부 메모\n메모\n\n## 내 설명\n설명\n';
    expect(getSection(body, '내 설명')).toBe('설명');
    expect(getSection(setSection(body, '공부 메모', '새 메모'), '공부 메모')).toBe('새 메모');
    expect(getSection(setSection(body, '공부 메모', '새 메모'), '내 설명')).toBe('설명');
    expect(getSection(setSection(body, '채점 결과', '- x'), '채점 결과')).toBe('- x');
    expect(getSection(body, '없음')).toBe('');
  });
});
