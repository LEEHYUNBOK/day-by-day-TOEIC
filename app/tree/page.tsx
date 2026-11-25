import { connection } from 'next/server';
import { DATA_ROOT } from '@/lib/paths';
import { listQuestions } from '@/lib/questions.mjs';
import { listAttempts } from '@/lib/attempts';
import { buildTree, questionScore, type TreeNode } from '@/lib/scores';
import StudyButton from '@/components/StudyButton';

export default async function TreePage() {
  await connection(); // 파일을 읽으므로 요청마다 렌더
  const attempts = listAttempts(DATA_ROOT);
  const tree = buildTree(listQuestions(DATA_ROOT));
  const withKids = tree.filter((n) => n.children.length > 0);
  const leaves = tree.filter((n) => n.children.length === 0);

  const row = (n: TreeNode) => {
    const s = questionScore(attempts, n.q.id);
    return (
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 font-semibold">{n.q.text}</span>
        <span className={`w-16 text-right text-sm font-bold ${s?.by === 'self' ? 'opacity-40' : ''}`} title={s?.by === 'self' ? '자기점수' : 'AI 점수'}>{s ? `${s.score}점` : '미학습'}</span>
        <StudyButton questionId={n.q.id} />
      </div>
    );
  };
  const node = (n: TreeNode): React.ReactNode =>
    n.children.length === 0 ? (
      <li key={n.q.id} className="py-2 pl-5">{row(n)}</li>
    ) : (
      <li key={n.q.id}>
        <details open className="py-2">
          <summary className="cursor-pointer">{row(n)}</summary>
          <ul className="ml-4 border-l-2 border-[#1c1a17]/30 pl-2">{n.children.map(node)}</ul>
        </details>
      </li>
    );

  const box = 'rounded-lg border-2 border-[#1c1a17] bg-[#fbf9f4] px-3 text-[#1c1a17]';
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <h1 className="mb-3 text-xl font-bold">꼬리질문 트리 <span className="text-sm font-normal opacity-60">뿌리 {tree.length}개</span></h1>
      {tree.length === 0 && <p className="py-8 text-center opacity-70">질문이 없어요</p>}
      {withKids.length > 0 && <ul className={`${box} mb-4 divide-y divide-[#1c1a17]/15`}>{withKids.map(node)}</ul>}
      {leaves.length > 0 && (
        <details className={box}>
          <summary className="cursor-pointer py-2 font-bold">꼬리질문 없는 질문 {leaves.length}개</summary>
          <ul className="divide-y divide-[#1c1a17]/15">{leaves.map(node)}</ul>
        </details>
      )}
    </main>
  );
}
