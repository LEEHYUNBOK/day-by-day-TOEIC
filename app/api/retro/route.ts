import { DATA_ROOT } from '@/lib/paths';
import { writeRetro } from '@/lib/retro';
import { bad, readJson, respond } from '@/lib/api';

export function PUT(req: Request) {
  return respond(req, async () => {
    const b = await readJson(req);
    if (typeof b.date !== 'string') throw bad('date must be a string');
    for (const k of ['read', 'dev', 'retro']) if (typeof b[k] !== 'string') throw bad(`${k} must be a string`);
    writeRetro(DATA_ROOT, b.date, { read: b.read as string, dev: b.dev as string, retro: b.retro as string });
    return { ok: true };
  });
}
