export function normalizeText(s) {
  return s.normalize('NFC').replace(/(?![+#])[\s\p{P}\p{S}]/gu, '');
}

export function slugify(s) {
  const slug = s
    .normalize('NFC')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return Array.from(slug).slice(0, 30).join('').replace(/-$/, '');
}

export function makeId(seq, text) {
  const slug = slugify(text);
  const n = String(seq).padStart(4, '0');
  return slug ? n + '-' + slug : n;
}

export function seqOf(id) {
  const m = /^(\d{4})/.exec(id.normalize('NFC'));
  return m ? parseInt(m[1], 10) : 0;
}
