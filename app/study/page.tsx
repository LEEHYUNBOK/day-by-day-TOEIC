import Link from 'next/link';
import { connection } from 'next/server';
import { DATA_ROOT } from '@/lib/paths';
import { assertAttemptPath, readAttempt } from '@/lib/attempts';
import { readQuestion } from '@/lib/questions.mjs';
import { attemptScore, illusion } from '@/lib/scores';
import StudyRunner from '@/components/StudyRunner';

function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
      <p className="text-lg font-semibold">기록을 찾을 수 없어요</p>
      <Link href="/bank" className="text-blue-600 underline">질문 목록으로</Link>
    </main>
  );
}

export default async function StudyPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  await connection(); // 파일을 읽으므로 요청마다 렌더
  const { a } = await searchParams;
  let attempt = null;
  if (typeof a === 'string') {
    try {
      attempt = readAttempt(DATA_ROOT, assertAttemptPath(a.normalize('NFC')));
    } catch {
      attempt = null;
    }
  }
  const question = attempt && readQuestion(DATA_ROOT, attempt.question);
  if (!attempt || !question) return <NotFound />;

  const followups = attempt.followups.map((id) => ({ id, text: readQuestion(DATA_ROOT, id)?.text ?? id }));
  return (
    <StudyRunner
      key={attempt.path}
      attempt={attempt}
      question={question}
      score={attemptScore(attempt)}
      illusion={illusion(attempt)}
      followups={followups}
    />
  );
}
