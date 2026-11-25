import fs from 'node:fs';
import path from 'node:path';
import { parse, stringify, getSection, setSection } from './frontmatter.mjs';
import { readQuestion } from './questions.mjs';
import type { Attempt, Rubric, Status } from './types';

export class NotDraftError extends Error {
  constructor() { super('attempt is not a draft'); this.name = 'NotDraftError'; }
}
export class BadPathError extends Error {
  constructor() { super('bad attempt path'); this.name = 'BadPathError'; }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ATTEMPT_PATH = /^study\/\d{4}-\d{2}-\d{2}\/[^/]+\.md$/;
const CONCEPT = [0, 30, 60];
const TRADEOFF = [0, 20, 40];

export function today(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function assertAttemptPath(p: string): string {
  const n = p.normalize('NFC');
  if (n.includes('..') || n.includes('\0') || !ATTEMPT_PATH.test(n)) throw new BadPathError();
  return n;
}

// Case-insensitive/NFD filesystems: find the real on-disk name for an NFC path.
function realFile(root: string, p: string): string | null {
  const dir = path.join(root, path.dirname(p));
  if (!fs.existsSync(dir)) return null;
  const name = path.basename(p);
  const hit = fs.readdirSync(dir).find((f) => f.normalize('NFC') === name);
  return hit ? path.join(dir, hit) : null;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const rubric = (v: unknown): Rubric | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Rubric) : null;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

function toAttempt(p: string, md: string): Attempt {
  const { data, body } = parse(md);
  return {
    path: p,
    question: str(data.question).normalize('NFC'),
    date: String(data.date ?? p.split('/')[1]),
    status: (['draft', 'pending', 'graded'].includes(str(data.status)) ? data.status : 'draft') as Status,
    seconds: num(data.seconds) ?? 0,
    minutes: num(data.minutes),
    mode: data.mode === 'write' || data.mode === 'voice' ? data.mode : null,
    self: rubric(data.self),
    self_score: num(data.self_score),
    ai: rubric(data.ai),
    ai_score: num(data.ai_score),
    followups: strs(data.followups),
    links: strs(data.links),
    memo: getSection(body, '공부 메모'),
    explanation: getSection(body, '내 설명'),
    mine: getSection(body, '내 사례 (선택)'),
    result: getSection(body, '채점 결과'),
  };
}

export function readAttempt(root: string, p: string): Attempt | null {
  const n = assertAttemptPath(p);
  const f = realFile(root, n);
  return f ? toAttempt(n, fs.readFileSync(f, 'utf8')) : null;
}

export function attemptOrder(a: Attempt): [string, number] {
  const base = path.posix.basename(a.path, '.md');
  const m = /^(.*)-(\d+)$/.exec(base);
  return [a.date, m && m[1] === a.question ? Number(m[2]) : 1];
}

export function listAttempts(root: string): Attempt[] {
  const study = path.join(root, 'study');
  if (!fs.existsSync(study)) return [];
  const out: Attempt[] = [];
  for (const d of fs.readdirSync(study, { withFileTypes: true })) {
    const date = d.name.normalize('NFC');
    if (!d.isDirectory() || !DATE.test(date)) continue;
    for (const f of fs.readdirSync(path.join(study, d.name))) {
      const name = f.normalize('NFC');
      if (!name.endsWith('.md')) continue;
      out.push(toAttempt(`study/${date}/${name}`, fs.readFileSync(path.join(study, d.name, f), 'utf8')));
    }
  }
  return out.sort((a, b) => {
    const [da, na] = attemptOrder(a);
    const [db, nb] = attemptOrder(b);
    return da < db ? -1 : da > db ? 1 : na - nb || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  });
}

// Atomic replace so a crash never leaves a half-written attempt.
function write(file: string, data: Record<string, unknown>, body: string) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, stringify(data, body));
  fs.renameSync(tmp, file);
}

export function startAttempt(root: string, questionId: string, date: string): Attempt {
  const qid = questionId.normalize('NFC');
  if (!readQuestion(root, qid)) throw new Error(`question not found: ${qid}`);
  if (!DATE.test(date)) throw new BadPathError();
  const open = listAttempts(root).find((a) => a.date === date && a.path.split('/')[1] === date && a.question === qid && a.status === 'draft');
  if (open) return open;

  const dir = path.join(root, 'study', date);
  fs.mkdirSync(dir, { recursive: true });
  const taken = new Set(fs.readdirSync(dir).map((f) => f.normalize('NFC')));
  let n = 1;
  while (taken.has(n === 1 ? `${qid}.md` : `${qid}-${n}.md`)) n++;
  const name = n === 1 ? `${qid}.md` : `${qid}-${n}.md`;
  const p = assertAttemptPath(`study/${date}/${name}`);
  let body = setSection('', '공부 메모', '');
  body = setSection(body, '내 설명', '');
  write(path.join(root, p), { question: qid, date, status: 'draft', seconds: 0, links: [] }, body);
  return readAttempt(root, p)!;
}

type Patch = Partial<Pick<Attempt, 'seconds' | 'links' | 'memo' | 'explanation' | 'mine' | 'mode'>>;

function loadDraft(root: string, p: string) {
  const n = assertAttemptPath(p);
  const file = realFile(root, n);
  if (!file) throw new Error(`attempt not found: ${n}`);
  const { data, body } = parse(fs.readFileSync(file, 'utf8'));
  if (data.status !== 'draft') throw new NotDraftError();
  return { n, file, data, body };
}

export function saveDraft(root: string, p: string, patch: Patch): Attempt {
  const { n, file, data, body: b0 } = loadDraft(root, p);
  let body = b0;
  if (patch.seconds !== undefined) {
    if (!Number.isFinite(patch.seconds) || patch.seconds < 0) throw new Error('invalid seconds');
    data.seconds = Math.floor(patch.seconds);
  }
  if (patch.links !== undefined) data.links = patch.links;
  if (patch.mode !== undefined) data.mode = patch.mode;
  if (patch.memo !== undefined) body = setSection(body, '공부 메모', patch.memo);
  if (patch.explanation !== undefined) body = setSection(body, '내 설명', patch.explanation);
  if (patch.mine !== undefined) body = setSection(body, '내 사례 (선택)', patch.mine);
  write(file, data, body);
  return readAttempt(root, n)!;
}

export function submitAttempt(
  root: string,
  p: string,
  input: { explanation: string; mode: 'write' | 'voice'; self: Rubric; mine?: string },
): Attempt {
  const { n, file, data, body: b0 } = loadDraft(root, p);
  const explanation = input.explanation.trim();
  if (!explanation) throw new Error('explanation is empty');
  if (!CONCEPT.includes(input.self?.concept) || !TRADEOFF.includes(input.self?.tradeoff)) throw new Error('invalid self score');
  if (input.mode !== 'write' && input.mode !== 'voice') throw new Error('invalid mode');

  const seconds = num(data.seconds) ?? 0;
  delete data.seconds;
  data.status = 'pending';
  data.minutes = Math.round(seconds / 60);
  data.mode = input.mode;
  data.self = { concept: input.self.concept, tradeoff: input.self.tradeoff };
  data.self_score = input.self.concept + input.self.tradeoff;
  let body = setSection(b0, '내 설명', explanation);
  if (input.mine !== undefined) body = setSection(body, '내 사례 (선택)', input.mine.trim());
  write(file, data, body);
  return readAttempt(root, n)!;
}

export function audioPathFor(p: string): string {
  return assertAttemptPath(p).replace(/\.md$/, '.webm');
}
