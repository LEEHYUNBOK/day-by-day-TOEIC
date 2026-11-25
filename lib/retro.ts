import fs from 'node:fs';
import path from 'node:path';
import { parse, stringify, getSection, setSection } from './frontmatter.mjs';
import { ValidationError } from './attempts';

export type Retro = { read: string; dev: string; retro: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const file = (root: string, date: string) => path.join(root, 'study', `${date}.md`);

export function readRetro(root: string, date: string): Retro {
  const empty = { read: '', dev: '', retro: '' };
  if (!DATE.test(date) || !fs.existsSync(file(root, date))) return empty;
  const { body } = parse(fs.readFileSync(file(root, date), 'utf8'));
  return { read: getSection(body, '읽은 글'), dev: getSection(body, '개발한 것'), retro: getSection(body, '회고') };
}

export function writeRetro(root: string, date: string, v: Retro): void {
  if (!DATE.test(date)) throw new ValidationError('invalid date');
  let body = '';
  body = setSection(body, '읽은 글', v.read.trim());
  body = setSection(body, '개발한 것', v.dev.trim());
  body = setSection(body, '회고', v.retro.trim());
  fs.mkdirSync(path.join(root, 'study'), { recursive: true });
  const f = file(root, date);
  const tmp = `${f}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, stringify({ date }, body));
  fs.renameSync(tmp, f);
}
