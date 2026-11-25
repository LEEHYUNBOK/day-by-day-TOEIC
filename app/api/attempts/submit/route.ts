import { DATA_ROOT } from '@/lib/paths';
import { assertAttemptPath, readAttempt, submitAttempt } from '@/lib/attempts';
import { HttpError, bad, nonEmpty, readJson, respond } from '@/lib/api';

export function POST(req: Request) {
  return respond(req, async () => {
    const b = await readJson(req);
    const p = assertAttemptPath(nonEmpty(b.path, 'path'));
    const explanation = nonEmpty(b.explanation, 'explanation');
    if (b.mode !== 'write' && b.mode !== 'voice') throw bad('invalid mode');
    const s = b.self as { concept?: unknown; tradeoff?: unknown } | null;
    if (!s || typeof s !== 'object' || typeof s.concept !== 'number' || typeof s.tradeoff !== 'number') throw bad('invalid self score');
    if (b.mine !== undefined && typeof b.mine !== 'string') throw bad('mine must be a string');
    if (!readAttempt(DATA_ROOT, p)) throw new HttpError(404, 'attempt not found');
    // submitAttempt re-checks the concept/tradeoff value sets (ValidationError -> 400).
    return { attempt: submitAttempt(DATA_ROOT, p, { explanation, mode: b.mode, self: { concept: s.concept, tradeoff: s.tradeoff }, mine: b.mine }) };
  });
}
