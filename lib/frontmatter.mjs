const PLAIN = /^[0-9A-Za-z가-힣_\-./]+$/;

function tryJson(s) {
  try { return { ok: true, v: JSON.parse(s) }; } catch { return { ok: false }; }
}

function encode(v) {
  if (typeof v === 'string' && PLAIN.test(v) && !tryJson(v).ok) return v;
  return JSON.stringify(v);
}

function decode(s) {
  const r = tryJson(s);
  return r.ok ? r.v : s;
}

export function parse(md) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(md) ?? /^---\r?\n---(?:\r?\n|$)/.exec(md);
  if (!m) return { data: {}, body: md };
  const data = {};
  for (const line of (m[1] ?? '').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 1) continue;
    data[line.slice(0, i).trim()] = decode(line.slice(i + 1).trim());
  }
  return { data, body: md.slice(m[0].length) };
}

export function stringify(data, body) {
  const lines = Object.entries(data).map(([k, v]) => `${k}: ${encode(v)}\n`);
  return `---\n${lines.join('')}---\n${body}`;
}

function splitSections(body) {
  // [preamble, [heading, text]...] split on lines starting with "## "
  const parts = body.split(/^(?=## )/m);
  return parts;
}

export function getSection(body, heading) {
  const part = splitSections(body).find((p) => p.startsWith(`## ${heading}\n`) || p === `## ${heading}`);
  return part ? part.slice(`## ${heading}`.length).trim() : '';
}

export function setSection(body, heading, text) {
  const block = `## ${heading}\n${text}\n`;
  const parts = splitSections(body);
  const idx = parts.findIndex((p) => p.startsWith(`## ${heading}\n`) || p === `## ${heading}`);
  if (idx >= 0) {
    const hasNext = idx < parts.length - 1;
    parts[idx] = hasNext ? `${block}\n` : block;
    return parts.join('');
  }
  const base = body === '' || body.endsWith('\n\n') ? body : body.endsWith('\n') ? `${body}\n` : `${body}\n\n`;
  return base + block;
}
