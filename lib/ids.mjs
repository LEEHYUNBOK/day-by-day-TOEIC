export function normalizeText(s) {
  return s.normalize('NFC').replace(/[\s\p{P}\p{S}]/gu, '');
}

export function slugify(s) {
  return s
    .normalize('NFC')
    .replace(/[?,.!/:;"'()[\]{}…·~]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)
    .replace(/-$/, '');
}

export function makeId(seq, text) {
  return String(seq).padStart(4, '0') + '-' + slugify(text);
}

export function seqOf(id) {
  const m = /^(\d{4})/.exec(id.normalize('NFC'));
  return m ? parseInt(m[1], 10) : 0;
}
