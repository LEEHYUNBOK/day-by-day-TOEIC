import type { DayContent, DayIndexEntry, Word, Sentence } from './types';
import { getSupabase } from './supabase';

export async function fetchIndex(): Promise<DayIndexEntry[]> {
  try {
    const res = await fetch('/data/index.json');
    if (!res.ok) return [];
    const json = await res.json();
    return json.days ?? [];
  } catch {
    return [];
  }
}

export async function fetchDay(date: string): Promise<DayContent | null> {
  try {
    const res = await fetch(`/data/days/${date}.json`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface ContentBundle {
  words: Word[];
  sentences: Sentence[];
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
      .slice()
      .sort((a, b) => (seqOf.get(a.set_id)! - seqOf.get(b.set_id)!) || (a.seq - b.seq));

  return {
    words: order(words).map((w) => ({
      id: w.item_id, word: w.word, pos: w.pos, meaning: w.meaning,
      example: w.example, exampleKo: w.example_ko,
    })),
    sentences: order(sentences).map((s) => ({
      id: s.item_id, text: s.text, ko: s.ko,
      blankWord: s.blank_word, distractors: s.distractors,
    })),
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
