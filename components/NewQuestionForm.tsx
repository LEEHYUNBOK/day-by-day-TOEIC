'use client';

import Link from 'next/link';
import { useState } from 'react';
import StudyButton from '@/components/StudyButton';

const SOURCES = [['real', '실전'], ['mock', '모의면접'], ['self', '직접 추가']] as const;

export default function NewQuestionForm({ topics }: { topics: string[] }) {
  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [source, setSource] = useState('self');
  const [from, setFrom] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ id: string; text: string; created: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setDone(null);
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, topic, source, from: from.trim() || undefined }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.question) throw new Error(j?.error ?? `요청을 처리하지 못했어요 (${res.status})`);
      setDone({ id: j.question.id, text: j.question.text, created: j.created });
      if (j.created) { setText(''); setFrom(''); }
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  const field = 'w-full rounded border-2 border-[#1c1a17] bg-transparent px-2 py-1';
  return (
    <main className="mx-auto w-full max-w-xl flex-1 p-4">
      <h1 className="mb-3 text-xl font-bold">질문 추가</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">질문
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">토픽
          <input list="topics" value={topic} onChange={(e) => setTopic(e.target.value)} className={field} />
          <datalist id="topics">{topics.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
        <fieldset className="text-sm">
          <legend className="font-semibold">출처</legend>
          <div className="mt-1 flex gap-4">
            {SOURCES.map(([k, v]) => (
              <label key={k} className="flex items-center gap-1"><input type="radio" name="source" value={k} checked={source === k} onChange={() => setSource(k)} /> {v}</label>
            ))}
          </div>
          <p className="mt-1 opacity-70">실제 면접에서 받은 질문만 real. 예상질문·직접 만든 질문은 self.</p>
        </fieldset>
        <label className="flex flex-col gap-1 text-sm font-semibold">from (선택)
          <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="회사나 링크" className={field} />
        </label>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        <button disabled={busy} className="self-start rounded-lg border-2 border-[#1c1a17] px-4 py-2 text-sm font-bold disabled:opacity-40">추가</button>
      </form>
      {done && (
        <div role="status" className="mt-4 flex items-center justify-between gap-3 rounded-lg border-2 border-[#1c1a17] p-3 text-sm">
          <span>
            <b>{done.created ? `추가했어요 (${done.id})` : '이미 있는 질문입니다'}</b>
            <span className="block">{done.text}</span>
            <Link href="/bank" className="text-blue-600 underline">질문 목록</Link>
          </span>
          <StudyButton questionId={done.id} />
        </div>
      )}
    </main>
  );
}
