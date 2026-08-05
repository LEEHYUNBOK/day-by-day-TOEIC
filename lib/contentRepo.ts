import type { DayContent, DayIndexEntry } from './types';

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
