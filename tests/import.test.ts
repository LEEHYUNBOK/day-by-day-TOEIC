// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { importBanks, htmlToMd, loadBank, BANK_FILES } from '@/scripts/import.mjs';
import { listQuestions } from '@/lib/questions.mjs';

const A = path.join(process.cwd(), 'tests/fixtures/bank-a.js');
const B = path.join(process.cwd(), 'tests/fixtures/bank-b.js');
let tmp: string;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-')); });

describe('import', () => {
  it('imports bank only, dedups across files, and is idempotent', () => {
    expect(importBanks(tmp, [A, B], '2026-11-25')).toEqual({ created: 3, skipped: 1 });
    expect(importBanks(tmp, [A, B], '2026-11-25')).toEqual({ created: 0, skipped: 4 });
    const qs = listQuestions(tmp);
    expect(qs.map(q => q.text)).not.toContain('자기소개');
    expect(qs[0]).toMatchObject({ source: 'mock', from: 'A', topic: 'OS', answer: '**공유** `x`' });
    expect(qs[1].answer).toBeNull();
  });
  it('htmlToMd converts tags and entities', () => {
    expect(htmlToMd('a &lt;b&gt;<br>c<i>d</i>')).toBe('a <b>\ncd');
  });
  it('loads title and bank; lists three files', () => {
    expect(loadBank(A).title).toBe('A');
    expect(BANK_FILES).toHaveLength(3);
  });
});
