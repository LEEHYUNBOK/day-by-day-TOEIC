import { DATA_ROOT } from '@/lib/paths';
import { readQuestion } from '@/lib/questions.mjs';
import { assertAttemptPath, readAttempt, saveDraft, startAttempt, today } from '@/lib/attempts';
import { HttpError, bad, nonEmpty, readJson, respond } from '@/lib/api';

export function POST(req: Request) {
  return respond(req, async () => {
    const b = await readJson(req);
    const id = nonEmpty(b.questionId, 'questionId').normalize('NFC');
    if (!readQuestion(DATA_ROOT, id)) throw new HttpError(404, 'question not found');
    return { attempt: startAttempt(DATA_ROOT, id, today()) };
  });
}

export function PATCH(req: Request) {
  return respond(req, async () => {
    const b = await readJson(req);
    const p = assertAttemptPath(nonEmpty(b.path, 'path'));
    const raw = b.patch;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw bad('patch must be an object');
    const r = raw as Record<string, unknown>;
    const patch: Parameters<typeof saveDraft>[2] = {};
    for (const k of ['memo', 'explanation', 'mine'] as const) {
      if (r[k] === undefined) continue;
      if (typeof r[k] !== 'string') throw bad(`${k} must be a string`);
      patch[k] = r[k] as string;
    }
    if (r.seconds !== undefined) {
      if (typeof r.seconds !== 'number' || !Number.isFinite(r.seconds) || r.seconds < 0) throw bad('invalid seconds');
      patch.seconds = r.seconds;
    }
    if (r.links !== undefined) {
      if (!Array.isArray(r.links) || !r.links.every((l) => typeof l === 'string')) throw bad('links must be string[]');
      patch.links = r.links as string[];
    }
    if (r.mode !== undefined) {
      if (r.mode !== 'write' && r.mode !== 'voice') throw bad('invalid mode');
      patch.mode = r.mode;
    }
    if (!readAttempt(DATA_ROOT, p)) throw new HttpError(404, 'attempt not found');
    return { attempt: saveDraft(DATA_ROOT, p, patch) };
  });
}
