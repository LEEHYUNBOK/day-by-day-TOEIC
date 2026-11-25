export const BANK_FILES: string[];
export function loadBank(file: string): { title: string; bank: { t: string; q: string; a: string }[] };
export function htmlToMd(html: string): string;
export function importBanks(root: string, files: string[], created: string): { created: number; skipped: number };
