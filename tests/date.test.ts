import { describe, it, expect } from 'vitest';
import { toDateStr, addDays } from '@/lib/date';

describe('date helpers', () => {
  it('toDateStr formats local date', () => {
    expect(toDateStr(new Date(2026, 7, 4))).toBe('2026-08-04');
  });
  it('addDays crosses month boundary', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
  });
});
