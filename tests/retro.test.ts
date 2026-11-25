// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readRetro, writeRetro } from '@/lib/retro';
import { listAttempts, ValidationError } from '@/lib/attempts';

let tmp: string;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-')); });

describe('retro', () => {
  it('round-trips a retro and rejects bad dates', () => {
    expect(readRetro(tmp, '2026-11-25')).toEqual({ read: '', dev: '', retro: '' });
    writeRetro(tmp, '2026-11-25', { read: '- [글](https://a.io) — 한 줄', dev: 'x', retro: 'y' });
    expect(readRetro(tmp, '2026-11-25').read).toBe('- [글](https://a.io) — 한 줄');
    expect(() => writeRetro(tmp, '../x', { read: '', dev: '', retro: '' })).toThrow();
  });
  it('rejects section-heading lines', () => {
    expect(() => writeRetro(tmp, '2026-11-25', { read: '', dev: '## 회고', retro: '' })).toThrow(ValidationError);
    expect(fs.existsSync(path.join(tmp, 'study', '2026-11-25.md'))).toBe(false);
  });
  it('retro files are not listed as attempts', () => {
    writeRetro(tmp, '2026-11-25', { read: '', dev: '', retro: 'y' });
    expect(listAttempts(tmp)).toEqual([]);
  });
  it('readRetro on a bad date returns empties', () => {
    expect(readRetro(tmp, '../x')).toEqual({ read: '', dev: '', retro: '' });
  });
});
