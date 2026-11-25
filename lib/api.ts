import { NextResponse } from 'next/server';
import { BadPathError, NotDraftError, ValidationError } from '@/lib/attempts';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const bad = (message: string) => new HttpError(400, message);

// Runs a write handler body. Rejects cross-site browser requests first, maps known
// errors to statuses, logs and 500s the rest.
export async function respond(req: Request, fn: () => Promise<unknown> | unknown): Promise<NextResponse> {
  try {
    const host = req.headers.get('host');
    if (host !== null && !['127.0.0.1', 'localhost'].includes(host.replace(/:\d+$/, ''))) throw new HttpError(403, 'bad host');
    const site = req.headers.get('sec-fetch-site');
    if (site !== null && site !== 'same-origin' && site !== 'none') throw new HttpError(403, 'cross-site request refused');
    return NextResponse.json(await fn());
  } catch (e) {
    const err = e as Error;
    const status =
      e instanceof HttpError ? e.status
      : e instanceof BadPathError || e instanceof ValidationError ? 400
      : e instanceof NotDraftError ? 409
      : 500;
    if (status === 500) console.error(e);
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  if (!(req.headers.get('content-type') ?? '').startsWith('application/json')) {
    throw new HttpError(415, 'content-type must be application/json');
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw bad('invalid JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw bad('body must be an object');
  return body as Record<string, unknown>;
}

export const nonEmpty = (v: unknown, name: string): string => {
  if (typeof v !== 'string' || !v.trim()) throw bad(`${name} must be a non-empty string`);
  return v.trim();
};
