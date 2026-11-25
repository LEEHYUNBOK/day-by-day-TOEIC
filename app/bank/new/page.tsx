import { connection } from 'next/server';
import { DATA_ROOT } from '@/lib/paths';
import { listQuestions } from '@/lib/questions.mjs';
import NewQuestionForm from '@/components/NewQuestionForm';

export default async function NewQuestionPage() {
  await connection();
  const topics = [...new Set(listQuestions(DATA_ROOT).map((q) => q.topic))].sort();
  return <NewQuestionForm topics={topics} />;
}
