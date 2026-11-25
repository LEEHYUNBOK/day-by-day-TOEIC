import { DATA_ROOT } from '@/lib/paths';
import { createQuestion } from '@/lib/questions.mjs';
import { today } from '@/lib/attempts';
import { bad, nonEmpty, readJson, respond } from '@/lib/api';

const SOURCES = ['real', 'mock', 'self', 'followup'] as const;
const KINDS = ['concept', 'experience'] as const;

export function POST(req: Request) {
  return respond(req, async () => {
    const b = await readJson(req);
    const text = nonEmpty(b.text, 'text');
    const topic = nonEmpty(b.topic, 'topic');
    const source = SOURCES.find((s) => s === b.source);
    if (!source) throw bad('invalid source');
    if (b.from != null && typeof b.from !== 'string') throw bad('from must be a string');
    const kind = b.kind == null ? undefined : KINDS.find((k) => k === b.kind);
    if (b.kind != null && !kind) throw bad('invalid kind');
    // parent/answer are never client-settable.
    return createQuestion(DATA_ROOT, { text, topic, source, from: b.from ?? null, kind, created: today() });
  });
}
