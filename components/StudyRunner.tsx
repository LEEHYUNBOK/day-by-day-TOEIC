'use client';

// 디자인: 시험지 · 몰입 · 무채색+녹색 1색. 참조점: 잡다 인적성 검사 화면.
// 종이색 배경, 먹색 글자, 주색 짙은 녹색(#0b5d4b), 경고 적색(#b3261e). radius 8px, 면 구분은 2px 경계선.
// 폰트는 앱 기본 한글 스택(Apple SD Gothic Neo / Noto Sans KR) 사용 — 새 웹폰트 없음.

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Attempt, Question } from '@/lib/types';

type Tab = 'write' | 'voice';
type Extra = 'memo' | 'links' | 'mine';
type Score = { score: number; by: 'ai' | 'self' } | null;
type Followup = { id: string; text: string };

// 마크다운 최소 렌더: **굵게**, `코드`, 줄바꿈. React 가 텍스트를 이스케이프하므로 HTML 주입이 없다.
function Md({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((t, j): ReactNode => {
            if (t.startsWith('**') && t.endsWith('**') && t.length > 4) return <strong key={j}>{t.slice(2, -2)}</strong>;
            if (t.startsWith('`') && t.endsWith('`') && t.length > 2)
              return <code key={j} className="rounded bg-black/10 px-1 font-mono text-[0.92em]">{t.slice(1, -1)}</code>;
            return t;
          })}
        </Fragment>
      ))}
    </>
  );
}

const hms = (s: number) => {
  const n = Math.floor(s);
  return [n / 3600, (n % 3600) / 60, n % 60].map((v) => String(Math.floor(v)).padStart(2, '0')).join(':');
};

const LABELS = {
  concept: {
    concept: '틀린 말 없이 핵심을 짚었나',
    experience: '무엇을 했는지 구체적으로(상황·행동·결과) 말했나',
  },
  tradeoff: {
    concept: '왜 쓰는지, 무엇을 포기하는지 말했나',
    experience: '왜 그렇게 했는지, 다른 선택지와 무엇을 맞바꿨나',
  },
};

const post = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// 브라우저에 타입이 없는 Web Speech API 의 필요한 부분만.
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

const PANEL = 'rounded-lg border-2 border-[#1c1a17] bg-[#fbf9f4]';
const BTN = 'rounded-lg border-2 border-[#1c1a17] px-4 py-2 text-sm font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#0b5d4b] disabled:cursor-not-allowed disabled:opacity-40';
const AREA = 'w-full resize-y rounded-lg border-2 border-[#1c1a17] bg-white p-3 text-base leading-relaxed focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#0b5d4b]';

export default function StudyRunner(props: { attempt: Attempt; question: Question; score: Score; illusion: number | null; followups: Followup[] }) {
  const { attempt, question, score, illusion, followups } = props;
  const router = useRouter();
  const draft = attempt.status === 'draft';

  const [seconds, setSeconds] = useState(attempt.seconds);
  const [running, setRunning] = useState(false);
  const [memo, setMemo] = useState(attempt.memo);
  const [links, setLinks] = useState(attempt.links);
  const [linkInput, setLinkInput] = useState('');
  const [mine, setMine] = useState(attempt.mine);
  const [explanation, setExplanation] = useState(attempt.explanation);
  const [tab, setTab] = useState<Tab>(attempt.mode ?? 'write');
  const [extra, setExtra] = useState<Extra>('memo');
  const [concept, setConcept] = useState<number | null>(null);
  const [tradeoff, setTradeoff] = useState<number | null>(null);
  const [recState, setRecState] = useState<'idle' | 'pending' | 'rec'>('idle');
  const recording = recState !== 'idle';
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [interim, setInterim] = useState('');
  const [busy, setBusy] = useState(false);

  // 타이머: 벽시계 기준으로 계산해서 다른 탭에서 타이머가 늦춰져도 시간이 어긋나지 않는다.
  const base = useRef({ seconds: attempt.seconds, startedAt: 0 });
  const live = useRef({ memo, links, mine, explanation, tab });
  useEffect(() => {
    live.current = { memo, links, mine, explanation, tab };
  });
  const elapsed = () => base.current.seconds + (base.current.startedAt ? (Date.now() - base.current.startedAt) / 1000 : 0);

  const snap = (l: typeof live.current) => JSON.stringify([l.memo, l.links, l.mine, l.explanation, l.tab]);
  const saved = useRef(JSON.stringify([attempt.memo, attempt.links, attempt.mine, attempt.explanation, attempt.mode ?? 'write']));
  const dead = useRef(false); // 409 를 받으면 true: 이후 저장·알림 없음

  const patchBody = () => {
    const l = live.current;
    return JSON.stringify({
      path: attempt.path,
      patch: { seconds: elapsed(), memo: l.memo, links: l.links, explanation: l.explanation, mine: l.mine, mode: l.tab },
    });
  };

  const save = useCallback(async (): Promise<boolean> => {
    if (dead.current) return false;
    const sent = snap(live.current);
    const res = await fetch('/api/attempts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: patchBody() });
    if (res.status === 409) {
      if (!dead.current) {
        dead.current = true;
        setRunning(false);
        alert('이미 제출된 기록입니다');
        router.refresh();
      }
      return false;
    }
    if (res.ok) saved.current = sent;
    return res.ok;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.path, router]);

  // 타이머가 멈춰 있어도 입력은 1.5초 뒤 저장한다.
  useEffect(() => {
    if (!draft || snap(live.current) === saved.current) return;
    const t = setTimeout(() => void save(), 1500);
    return () => clearTimeout(t);
  }, [draft, memo, links, mine, explanation, tab, save]);

  // 탭을 닫거나 이동할 때 마지막 저장.
  useEffect(() => {
    if (!draft) return;
    const h = () => {
      if (dead.current) return;
      void fetch('/api/attempts', { method: 'PATCH', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: patchBody() });
    };
    window.addEventListener('pagehide', h);
    return () => window.removeEventListener('pagehide', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, attempt.path]);

  useEffect(() => {
    if (!running || !draft) return;
    base.current.startedAt = Date.now();
    const tick = setInterval(() => setSeconds(elapsed()), 1000);
    const autosave = setInterval(() => void save(), 30000);
    return () => {
      clearInterval(tick);
      clearInterval(autosave);
      base.current = { seconds: elapsed(), startedAt: 0 };
    };
  }, [running, draft, save]);

  const pause = async () => {
    setRunning(false);
    await new Promise((r) => setTimeout(r)); // 정리 effect 가 누적 초를 확정한 뒤 저장
    setSeconds(base.current.seconds);
    await save();
  };

  // ---- 녹음 + 받아쓰기 ----
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recog = useRef<Recognition | null>(null);
  const recordingRef = useRef(false);
  const fellBack = useRef(false);

  const fallback = () => {
    if (fellBack.current) return;
    fellBack.current = true;
    setNotice('받아쓰기를 못 해서 글 쓰기로 바꿨어요');
    setTab('write');
  };

  const token = useRef(0); // 권한 대기 중 취소를 알아차리기 위한 번호

  const startRecording = async () => {
    fellBack.current = false;
    setNotice('');
    const id = ++token.current;
    setRecState('pending');
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      if (token.current === id) {
        setRecState('idle');
        fallback(); // 마이크 거부·미지원
      }
      return;
    }
    if (token.current !== id) {
      s.getTracks().forEach((t) => t.stop()); // 대기 중에 정지를 눌렀다
      return;
    }
    const chunks: Blob[] = [];
    let mr: MediaRecorder;
    try {
      mr = new MediaRecorder(s, { mimeType: 'audio/webm' });
    } catch {
      s.getTracks().forEach((t) => t.stop());
      setRecState('idle');
      fallback();
      return;
    }
    stream.current = s;
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = async () => {
      s.getTracks().forEach((t) => t.stop());
      if (!chunks.length) return;
      setUploading(true);
      try {
        const res = await fetch(`/api/audio?path=${encodeURIComponent(attempt.path)}`, { method: 'POST', body: new Blob(chunks, { type: 'audio/webm' }) });
        if (!res.ok) setNotice('녹음 파일을 저장하지 못했어요');
      } catch {
        setNotice('녹음 파일을 저장하지 못했어요');
      } finally {
        setUploading(false);
      }
    };
    mr.start();
    recorder.current = mr;
    recordingRef.current = true;
    setRecState('rec');
    setTab('voice');
    const SR = (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
    if (!SR) return fallback();
    const r = new SR();
    r.lang = 'ko-KR';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let fin = '';
      let tmp = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t;
        else tmp += t;
      }
      setInterim(tmp);
      if (fin) setExplanation((p) => (p && !/\s$/.test(p) ? p + ' ' : p) + fin.trim());
    };
    r.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        recog.current = null; // 다시 시작하지 않는다. 녹음은 계속한다.
        fallback();
      }
    };
    r.onend = () => {
      setInterim('');
      if (recordingRef.current && recog.current === r) {
        try { r.start(); } catch { /* 이미 시작됨 */ }
      }
    };
    recog.current = r;
    try { r.start(); } catch { fallback(); }
  };

  const stopRecording = () => {
    token.current++;
    recordingRef.current = false;
    setRecState('idle');
    const r = recog.current;
    recog.current = null;
    r?.stop();
    if (recorder.current?.state === 'recording') recorder.current.stop();
    recorder.current = null;
  };

  useEffect(() => () => {
    recordingRef.current = false;
    token.current++;
    recog.current?.stop();
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const exit = async () => {
    if (recording) stopRecording();
    if (draft) {
      setRunning(false);
      await new Promise((r) => setTimeout(r));
      if (!(await save())) return;
    }
    router.push('/bank');
  };

  const submit = async () => {
    setBusy(true);
    setRunning(false);
    await new Promise((r) => setTimeout(r));
    try {
      if (!(await save())) return;
      const res = await post('/api/attempts/submit', {
        path: attempt.path,
        explanation,
        mode: tab,
        self: { concept, tradeoff },
        mine,
      });
      if (res.status === 409) {
        alert('이미 제출된 기록입니다');
      } else if (!res.ok) {
        alert('제출하지 못했어요. 다시 시도해 주세요');
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const startAttempt = async (questionId: string) => {
    setBusy(true);
    try {
      const res = await post('/api/attempts', { questionId });
      if (!res.ok) throw new Error();
      const { attempt: a } = (await res.json()) as { attempt: Attempt };
      router.push(`/study?a=${encodeURIComponent(a.path)}`);
    } catch {
      alert('기록을 만들지 못했어요');
    } finally {
      setBusy(false);
    }
  };

  const addLink = () => {
    const v = linkInput.trim();
    if (v && !links.includes(v)) setLinks([...links, v]);
    setLinkInput('');
  };

  const kind = question.kind;
  const canSubmit = explanation.trim() !== '' && concept !== null && tradeoff !== null && !recording && !uploading && !busy;

  const header = (
    <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-[#1c1a17] bg-[#f5f2ea] px-4 py-3 sm:px-8">
      <div className="min-w-0 flex-1 text-sm font-semibold">
        {question.topic} · {{ real: '실전', mock: '모의면접', self: '직접 추가', followup: '꼬리질문' }[question.source]}
      </div>
      {draft ? (
        <>
          <div aria-label="경과 시간" className={`font-mono text-2xl font-bold tabular-nums ${running ? 'text-[#0b5d4b]' : ''}`}>{hms(seconds)}</div>
          <button type="button" className={`${BTN} ${running ? 'bg-white' : 'bg-[#0b5d4b] text-white'}`} onClick={() => (running ? void pause() : setRunning(true))}>
            {running ? '일시정지' : '시작'}
          </button>
        </>
      ) : (
        <div className="font-mono text-lg font-bold tabular-nums">{attempt.minutes ?? 0}분</div>
      )}
      <button type="button" className={`${BTN} bg-white`} onClick={() => void exit()}>나가기</button>
    </header>
  );

  const questionBlock = (
    <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <p className="mb-3 text-sm font-bold text-[#0b5d4b]">{kind === 'experience' ? '경험 질문' : '개념 질문'}</p>
      <h1 className="text-2xl font-bold leading-snug sm:text-3xl">{question.text}</h1>
    </section>
  );

  const shell = (children: ReactNode) => (
    <div className="fixed inset-0 z-20 flex flex-col overflow-y-auto bg-[#f5f2ea] text-[#1c1a17]">
      {header}
      {questionBlock}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-16">{children}</div>
    </div>
  );

  if (!draft) {
    return shell(
      <>
        <section className={`${PANEL} p-4`}>
          <p className="text-sm font-bold">
            {attempt.status === 'graded' ? '채점 완료' : '채점 대기'} · 자기점수 {attempt.self_score ?? '-'}
            {score && score.by === 'ai' && <> · AI 점수 {score.score}</>}
            {illusion !== null && <> · 착각 지수 {illusion > 0 ? '+' : ''}{illusion}</>}
          </p>
          {attempt.status === 'pending' && <p className="mt-1 text-sm">Claude Code에서 /채점 을 실행하면 AI 점수가 기록돼요.</p>}
        </section>

        <Block title="참고 답안">
          {question.answer ? <Md text={question.answer} /> : <span className="opacity-70">참고 답안이 없는 질문이에요. /채점이 자기 지식으로 채점합니다.</span>}
        </Block>
        <Block title="내 설명">{attempt.explanation ? <Md text={attempt.explanation} /> : '-'}</Block>
        {attempt.memo && <Block title="공부 메모"><Md text={attempt.memo} /></Block>}
        {attempt.mine && <Block title="내 사례"><Md text={attempt.mine} /></Block>}
        {attempt.links.length > 0 && (
          <Block title="링크">
            <ul className="list-disc pl-5">
              {attempt.links.map((l) => <li key={l} className="break-all">{l}</li>)}
            </ul>
          </Block>
        )}
        {attempt.status === 'graded' && (
          <>
            <Block title={`AI 채점 · ${attempt.ai?.concept ?? '-'} / 60 + ${attempt.ai?.tradeoff ?? '-'} / 40`}>
              {attempt.result ? <Md text={attempt.result} /> : '-'}
            </Block>
            {followups.length > 0 && (
              <Block title="꼬리질문">
                <ul className="flex flex-col gap-2">
                  {followups.map((f) => (
                    <li key={f.id} className="flex items-center gap-3">
                      <span className="flex-1">{f.text}</span>
                      <button type="button" disabled={busy} className={`${BTN} bg-white`} onClick={() => void startAttempt(f.id)}>공부하기</button>
                    </li>
                  ))}
                </ul>
              </Block>
            )}
          </>
        )}
        <div>
          <button type="button" disabled={busy} className={`${BTN} bg-[#0b5d4b] text-white`} onClick={() => void startAttempt(question.id)}>다시 풀기</button>
        </div>
      </>,
    );
  }

  const radio = (name: 'concept' | 'tradeoff', value: number, cur: number | null, set: (v: number) => void) => (
    <label key={value} className="flex min-w-16 cursor-pointer items-center justify-center rounded-lg border-2 border-[#1c1a17] bg-white px-4 py-2 text-base font-bold has-checked:bg-[#0b5d4b] has-checked:text-white has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#0b5d4b]">
      <input type="radio" name={name} className="sr-only" checked={cur === value} onChange={() => set(value)} />
      {value}
    </label>
  );

  return shell(
    <>
      <section className={`${PANEL} p-4`}>
        <div role="tablist" className="mb-3 flex gap-2">
          {([['memo', '공부 메모'], ['links', `링크${links.length ? ` (${links.length})` : ''}`], ['mine', '내 사례 (선택)']] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={extra === k} onClick={() => setExtra(k)} className={`${BTN} ${extra === k ? 'bg-[#1c1a17] text-white' : 'bg-white'}`}>{label}</button>
          ))}
        </div>
        {extra === 'memo' && <textarea aria-label="공부 메모" rows={4} className={AREA} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="공부하며 메모하세요" />}
        {extra === 'mine' && <textarea aria-label="내 사례" rows={4} className={AREA} value={mine} onChange={(e) => setMine(e.target.value)} placeholder="나중에 면접에서 쓸 내 경험 (점수 없음)" />}
        {extra === 'links' && (
          <div>
            <input
              aria-label="링크 추가"
              className={AREA}
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  addLink();
                }
              }}
              placeholder="URL 입력 후 Enter"
            />
            <ul className="mt-2 flex flex-col gap-1">
              {links.map((l) => (
                <li key={l} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 break-all">{l}</span>
                  <button type="button" aria-label={`링크 삭제 ${l}`} className="px-2 font-bold text-[#b3261e]" onClick={() => setLinks(links.filter((x) => x !== l))}>×</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className={`${PANEL} p-4`}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="mr-auto font-bold">설명</h2>
          <button type="button" className={`${BTN} ${tab === 'write' ? 'bg-[#1c1a17] text-white' : 'bg-white'}`} onClick={() => setTab('write')}>글 쓰기</button>
          <button type="button" disabled={uploading} className={`${BTN} ${recState === 'rec' ? 'bg-[#b3261e] text-white' : 'bg-white'}`} onClick={() => (recording ? stopRecording() : void startRecording())}>
            {recState === 'rec' ? '● REC 정지' : recState === 'pending' ? '마이크 권한 대기… (취소)' : '말로 설명'}
          </button>
        </div>
        {notice && <p role="status" className="mb-2 text-sm font-semibold text-[#b3261e]">{notice}</p>}
        {uploading && <p role="status" className="mb-2 text-sm">녹음 저장 중…</p>}
        <textarea aria-label="설명" rows={8} className={AREA} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="면접관에게 말하듯 설명해 보세요" />
        {interim && <p className="mt-1 text-sm opacity-60">{interim}</p>}
      </section>

      <section className={`${PANEL} flex flex-col gap-5 p-4`}>
        <h2 className="font-bold">자기채점</h2>
        <fieldset>
          <legend className="font-bold">개념 <span className="text-sm font-normal">(60)</span></legend>
          <p className="mb-2 text-sm opacity-75">{LABELS.concept[kind]}</p>
          <div className="flex gap-2">{[0, 30, 60].map((v) => radio('concept', v, concept, setConcept))}</div>
        </fieldset>
        <fieldset>
          <legend className="font-bold">트레이드오프 <span className="text-sm font-normal">(40)</span></legend>
          <p className="mb-2 text-sm opacity-75">{LABELS.tradeoff[kind]}</p>
          <div className="flex gap-2">{[0, 20, 40].map((v) => radio('tradeoff', v, tradeoff, setTradeoff))}</div>
        </fieldset>
      </section>

      <div className="flex items-center justify-end gap-3">
        {!canSubmit && <span className="text-sm opacity-70">설명과 자기채점 두 항목을 모두 채우면 제출할 수 있어요</span>}
        <button type="button" disabled={!canSubmit} className={`${BTN} bg-[#0b5d4b] px-8 py-3 text-base text-white`} onClick={() => void submit()}>제출</button>
      </div>
    </>,
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${PANEL} p-4`}>
      <h2 className="mb-2 font-bold">{title}</h2>
      <div className="leading-relaxed">{children}</div>
    </section>
  );
}
