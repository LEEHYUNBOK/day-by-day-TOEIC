import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { createQuestion } from '../lib/questions.mjs';

export const BANK_FILES = [
  '음성모의면접_문항_미리디_CS전체_20260930.js',
  '음성모의면접_문항_미리디_약점12_20260929.js',
  '음성모의면접_문항.js',
];

export function loadBank(file) {
  const src = fs.readFileSync(file, 'utf8');
  const cfg = runInNewContext(src + '\n;CFG', {});
  return { title: cfg.title, bank: cfg.bank };
}

export function htmlToMd(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?b>/gi, '**')
    .replace(/<\/?code>/gi, '`')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

export function importBanks(root, files, created) {
  let made = 0;
  let skipped = 0;
  for (const file of files) {
    const { title, bank } = loadBank(file);
    for (const b of bank) {
      const r = createQuestion(root, {
        text: b.q,
        topic: b.t,
        source: 'mock',
        from: title,
        answer: htmlToMd(b.a ?? '') || null,
        created,
      });
      if (r.created) made++;
      else skipped++;
    }
  }
  return { created: made, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = process.argv[2];
  const files = arg && BANK_FILES.map((f) => path.join(arg, '04_면접·코테', f));
  if (!files || !files.every((f) => fs.existsSync(f))) {
    console.error('사용법: npm run import -- <RESUME 경로> (문항 파일을 찾지 못함)');
    process.exit(1);
  }
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const r = importBanks(path.join(process.cwd(), 'data'), files, today);
  console.log(`가져옴 ${r.created} · 건너뜀 ${r.skipped}`);
}
