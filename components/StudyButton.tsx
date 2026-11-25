'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StudyButton({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function start() {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/attempts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? '시작하지 못했어요');
      router.push(`/study?a=${encodeURIComponent(j.attempt.path)}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <span className="flex flex-col items-end gap-1">
      <button onClick={start} disabled={busy} className="rounded-lg border-2 border-[#1c1a17] px-3 py-1 text-sm font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#0b5d4b] disabled:opacity-40">
        공부하기
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </span>
  );
}
