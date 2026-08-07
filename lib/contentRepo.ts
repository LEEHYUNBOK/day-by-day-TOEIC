import type { Word, Sentence } from './types';
import type { CardIdentity } from './srs';
import { getSupabase } from './supabase';

export interface ContentBundle {
  words: Word[];
  sentences: Sentence[];
  candidates: CardIdentity[];   // 묶음별로 단어 -> 빈칸 -> 조합 순서
}

export interface RawSet { id: number; seq: number }
export interface RawWord {
  item_id: string; set_id: number; seq: number;
  word: string; pos: string; meaning: string; example: string; example_ko: string;
}
export interface RawSentence {
  item_id: string; set_id: number; seq: number;
  text: string; ko: string; blank_word: string; distractors: string[];
}

/**
 * DB 행을 앱 타입으로 옮기고 도입 순서로 정렬한다.
 * 순서: 묶음 seq -> 항목 seq. 알 수 없는 set_id 를 가진 항목은 버린다.
 */
export function toBundle(sets: RawSet[], words: RawWord[], sentences: RawSentence[]): ContentBundle {
  const seqOf = new Map(sets.map((s) => [s.id, s.seq]));
  const order = <T extends { set_id: number; seq: number }>(rows: T[]): T[] =>
    rows
      .filter((r) => seqOf.has(r.set_id))
      .sort((a, b) => (seqOf.get(a.set_id)! - seqOf.get(b.set_id)!) || (a.seq - b.seq));

  const orderedWords = order(words);
  const orderedSentences = order(sentences);

  // 묶음 seq별로 단어/문장을 모아, 묶음 순서대로 단어 전부 -> 빈칸 -> 조합을 이어붙인다.
  const wordsBySetSeq = new Map<number, RawWord[]>();
  for (const w of orderedWords) {
    const seq = seqOf.get(w.set_id)!;
    if (!wordsBySetSeq.has(seq)) wordsBySetSeq.set(seq, []);
    wordsBySetSeq.get(seq)!.push(w);
  }
  const sentencesBySetSeq = new Map<number, RawSentence[]>();
  for (const s of orderedSentences) {
    const seq = seqOf.get(s.set_id)!;
    if (!sentencesBySetSeq.has(seq)) sentencesBySetSeq.set(seq, []);
    sentencesBySetSeq.get(seq)!.push(s);
  }
  const setSeqs = [...new Set([...wordsBySetSeq.keys(), ...sentencesBySetSeq.keys()])].sort((a, b) => a - b);

  const candidates: CardIdentity[] = [];
  for (const seq of setSeqs) {
    for (const w of wordsBySetSeq.get(seq) ?? []) {
      candidates.push({ itemId: w.item_id, type: 'word' });
    }
    for (const s of sentencesBySetSeq.get(seq) ?? []) {
      candidates.push({ itemId: s.item_id, type: 'blank' });
      candidates.push({ itemId: s.item_id, type: 'arrange' });
    }
  }

  return {
    words: orderedWords.map((w) => ({
      id: w.item_id, word: w.word, pos: w.pos, meaning: w.meaning,
      example: w.example, exampleKo: w.example_ko,
    })),
    sentences: orderedSentences.map((s) => ({
      id: s.item_id, text: s.text, ko: s.ko,
      blankWord: s.blank_word, distractors: s.distractors,
    })),
    candidates,
  };
}

/** 전체 콘텐츠를 한 번에 가져온다. 조회 실패는 null (콘텐츠 없음과 구분된다). */
export async function fetchContent(): Promise<ContentBundle | null> {
  try {
    const sb = getSupabase();
    const [setsRes, wordsRes, sentencesRes] = await Promise.all([
      sb.from('toeic_sets').select('id,seq'),
      sb.from('toeic_words').select('item_id,set_id,seq,word,pos,meaning,example,example_ko'),
      sb.from('toeic_sentences').select('item_id,set_id,seq,text,ko,blank_word,distractors'),
    ]);
    if (setsRes.error || wordsRes.error || sentencesRes.error) return null;
    return toBundle(
      (setsRes.data ?? []) as RawSet[],
      (wordsRes.data ?? []) as RawWord[],
      (sentencesRes.data ?? []) as RawSentence[],
    );
  } catch {
    return null;
  }
}
