'use client';

import { useState } from 'react';

type Retro = { read: string; dev: string; retro: string };
const FIELDS = [
  { k: 'read', label: '읽은 글', hint: '- [제목](링크) — 한 줄 메모' },
  { k: 'dev', label: '개발한 것', hint: '' },
  { k: 'retro', label: '회고', hint: '' },
] as const;

export default function RetroEditor({ date, initial }: { date: string; initial: Retro }) {
  const [v, setV] = useState(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [err, setErr] = useState('');
  async function save() {
    setState('saving');
    setErr('');
    try {
      const res = await fetch('/api/retro', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, ...v }) });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error ?? `요청을 처리하지 못했어요 (${res.status})`);
      setState('saved');
    } catch (e) {
      setErr((e as Error).message);
      setState('error');
    }
  }
  return (
    <section className="mt-8 flex flex-col gap-3">
      <h2 className="text-lg font-bold">하루 회고</h2>
      {FIELDS.map((f) => (
        <label key={f.k} className="flex flex-col gap-1 text-sm font-bold">
          {f.label}
          <textarea
            value={v[f.k]}
            placeholder={f.hint}
            rows={4}
            onChange={(e) => { setV({ ...v, [f.k]: e.target.value }); setState('idle'); }}
            className="rounded border-2 border-[#1c1a17] bg-transparent p-2 text-sm font-normal"
          />
        </label>
      ))}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={state === 'saving'} className="rounded-lg border-2 border-[#1c1a17] px-4 py-1 font-bold disabled:opacity-40">저장</button>
        {state === 'saved' && <span className="text-sm text-[#0b5d4b]">저장했어요</span>}
        {state === 'error' && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </section>
  );
}
