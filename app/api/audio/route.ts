import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { DATA_ROOT } from '@/lib/paths';
import { NotDraftError, audioPathFor, readAttempt } from '@/lib/attempts';
import { HttpError, bad, respond } from '@/lib/api';

const MAX = 50 * 1024 * 1024;

export function POST(req: NextRequest) {
  return respond(req, async () => {
    const p = req.nextUrl.searchParams.get('path');
    if (!p) throw bad('path is required');
    const audio = audioPathFor(p); // throws BadPathError -> 400
    const attempt = readAttempt(DATA_ROOT, p);
    if (!attempt) throw new HttpError(404, 'attempt not found');
    if (attempt.status !== 'draft') throw new NotDraftError();
    if (Number(req.headers.get('content-length')) > MAX) throw new HttpError(413, 'audio too large');
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length === 0) throw bad('empty body');
    if (buf.length > MAX) throw new HttpError(413, 'audio too large');
    const file = path.join(DATA_ROOT, audio);
    const tmp = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, file);
    return { ok: true };
  });
}
