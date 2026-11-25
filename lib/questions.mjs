import fs from 'node:fs';
import path from 'node:path';
import { parse, stringify, getSection, setSection } from './frontmatter.mjs';
import { normalizeText, makeId, seqOf } from './ids.mjs';

const dirOf = (root) => path.join(root, 'questions');

export function inferKind(text) {
  return /경험|실무|직접|겪어/.test(text) ? 'experience' : 'concept';
}

function toQuestion(id, md) {
  const { data, body } = parse(md);
  const cut = body.search(/^## 참고 답안[ \t]*$/m);
  const text = (cut === -1 ? body : body.slice(0, cut)).trim();
  return {
    id,
    topic: data.topic ?? '',
    kind: data.kind ?? inferKind(text),
    source: data.source ?? 'self',
    from: data.from ?? null,
    parent: data.parent ?? null,
    created: String(data.created ?? ''),
    text,
    answer: getSection(body, '참고 답안').trim() || null,
  };
}

export function readQuestion(root, id) {
  const nfc = id.normalize('NFC');
  const dir = dirOf(root);
  if (!fs.existsSync(dir)) return null;
  // match on NFC-normalized readdir names so NFD-stored files are found too
  const file = fs.readdirSync(dir).find((f) => f.normalize('NFC') === nfc + '.md');
  return file ? toQuestion(nfc, fs.readFileSync(path.join(dir, file), 'utf8')) : null;
}

export function listQuestions(root) {
  const dir = dirOf(root);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ id: f.normalize('NFC').slice(0, -3), file: f }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(({ id, file }) => toQuestion(id, fs.readFileSync(path.join(dir, file), 'utf8')));
}

export function createQuestion(root, input) {
  const all = listQuestions(root);
  const key = normalizeText(input.text);
  const dup = all.find((q) => normalizeText(q.text) === key);
  if (dup) return { question: dup, created: false };

  const seq = all.reduce((m, q) => Math.max(m, seqOf(q.id)), 0) + 1;
  const id = makeId(seq, input.text);
  const text = input.text.trim();
  const answer = input.answer?.trim() || null;
  const kind = input.kind ?? inferKind(text);
  const from = input.from ?? null;
  const parent = input.parent ?? null;
  let body = text + '\n';
  if (answer) body = setSection(body, '참고 답안', answer);
  const dir = dirOf(root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, id + '.md'),
    stringify({ id, topic: input.topic, kind, source: input.source, from, parent, created: input.created }, body),
  );
  return { question: { id, topic: input.topic, kind, source: input.source, from, parent, created: input.created, text, answer }, created: true };
}
