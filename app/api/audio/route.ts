import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { DATA_ROOT } from '@/lib/paths';
import { audioPathFor, readAttempt } from '@/lib/attempts';
import { HttpError, bad, respond } from '@/lib/api';

const MAX = 50 * 1024 * 1024;

export function POST(req: NextRequest) {
  return respond(async () => {
    const p = req.nextUrl.searchParams.get('path');
    if (!p) throw bad('path is required');
    const audio = audioPathFor(p); // throws BadPathError -> 400
    if (!readAttempt(DATA_ROOT, p)) throw new HttpError(404, 'attempt not found');
    if (Number(req.headers.get('content-length')) > MAX) throw new HttpError(413, 'audio too large');
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length === 0) throw bad('empty body');
    if (buf.length > MAX) throw new HttpError(413, 'audio too large');
    fs.writeFileSync(path.join(DATA_ROOT, audio), buf);
    return { ok: true };
  });
}
