import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../public/data');
const errors = [];
const index = JSON.parse(readFileSync(path.join(root, 'index.json'), 'utf8'));
const files = readdirSync(path.join(root, 'days')).filter(f => f.endsWith('.json'));
const indexDates = new Set(index.days.map(d => d.date));
const fileDates = new Set(files.map(f => f.replace('.json', '')));

for (const d of indexDates) if (!fileDates.has(d)) errors.push(`index에 있는 ${d}의 파일이 없음`);
for (const d of fileDates) if (!indexDates.has(d)) errors.push(`days/${d}.json이 index에 없음`);

const allIds = new Set();
for (const f of files) {
  const p = `days/${f}`;
  const day = JSON.parse(readFileSync(path.join(root, 'days', f), 'utf8'));
  if (day.date !== f.replace('.json', '')) errors.push(`${p}: date 필드(${day.date})와 파일명 불일치`);
  if (!day.title) errors.push(`${p}: title 없음`);
  for (const w of day.words ?? []) {
    for (const k of ['id', 'word', 'pos', 'meaning', 'example', 'exampleKo'])
      if (!w[k]) errors.push(`${p} ${w.id ?? w.word}: words.${k} 없음`);
    if (allIds.has(w.id)) errors.push(`${p}: 중복 id ${w.id}`);
    allIds.add(w.id);
  }
  for (const s of day.sentences ?? []) {
    for (const k of ['id', 'text', 'ko', 'blankWord'])
      if (!s[k]) errors.push(`${p} ${s.id}: sentences.${k} 없음`);
    if (allIds.has(s.id)) errors.push(`${p}: 중복 id ${s.id}`);
    allIds.add(s.id);
    const count = (s.text ?? '').split(/\s+/).filter(t => t.replace(/[.,!?;:]/g, '') === s.blankWord).length;
    if (count !== 1) errors.push(`${p} ${s.id}: blankWord "${s.blankWord}"가 text에 ${count}회 등장 (1회여야 함)`);
    if (!Array.isArray(s.distractors) || s.distractors.length !== 3)
      errors.push(`${p} ${s.id}: distractors는 정확히 3개여야 함`);
  }
  if ((day.words ?? []).length !== 10) errors.push(`${p}: 단어 ${day.words?.length}개 (10개여야 함)`);
  if ((day.sentences ?? []).length !== 5) errors.push(`${p}: 문장 ${day.sentences?.length}개 (5개여야 함)`);
}

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`OK — ${files.length}일치 데이터 검증 통과`);
