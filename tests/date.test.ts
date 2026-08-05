import { describe, it, expect } from 'vitest';
import { toDateStr, addDays, monthGrid } from '@/lib/date';

describe('date helpers', () => {
  it('toDateStr formats local date', () => {
    expect(toDateStr(new Date(2026, 7, 4))).toBe('2026-08-04');
  });
  it('addDays crosses month boundary', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
  });
  it('monthGrid: 2026-08 starts on Saturday, has 31 days', () => {
    const g = monthGrid(2026, 8);
    expect(g[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(g[0][6]).toBe('2026-08-01');
    expect(g.flat().filter(Boolean)).toHaveLength(31);
  });
});
