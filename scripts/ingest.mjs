import { readFileSync } from 'node:fs';

const WORD_FIELDS = ['id', 'word', 'pos', 'meaning', 'example', 'exampleKo'];
const SENTENCE_FIELDS = ['id', 'text', 'ko', 'blankWord'];

/** 구두점을 떼고 공백 기준 토큰으로 쪼갠다 (validate-data.mjs 와 비슷하지만, 따옴표·괄호도 추가로 뗀다). */
function tokens(text) {
  return String(text).split(/\s+/).map((t) => t.replace(/[.,!?;:"'()]/g, ''));
}

export function validateInput(input, existingIds) {
  const errors = [];
  if (!input || typeof input !== 'object') return { ok: false, errors: ['입력이 객체가 아닙니다'] };

  if (!input.title) errors.push('title 이 없습니다');

  const words = Array.isArray(input.words) ? input.words : [];
  const sentences = Array.isArray(input.sentences) ? input.sentences : [];
  if (words.length === 0) errors.push('단어가 1개 이상 필요합니다');

  const seen = new Set();
  const checkId = (id, label) => {
    if (!id) { errors.push(`${label}: id 가 없습니다`); return; }
    if (seen.has(id)) errors.push(`${label}: 파일 안에서 id 중복 — ${id}`);
    else if (existingIds.has(id)) errors.push(`${label}: DB 에 이미 있는 id — ${id}`);
    seen.add(id);
  };

  for (const w of words) {
    for (const f of WORD_FIELDS) if (!w?.[f]) errors.push(`단어 ${w?.id ?? '(id없음)'}: ${f} 가 없습니다`);
    checkId(w?.id, `단어 ${w?.id ?? '(id없음)'}`);
  }

  for (const s of sentences) {
    for (const f of SENTENCE_FIELDS) if (!s?.[f]) errors.push(`문장 ${s?.id ?? '(id없음)'}: ${f} 가 없습니다`);
    checkId(s?.id, `문장 ${s?.id ?? '(id없음)'}`);

    if (!Array.isArray(s?.distractors) || s.distractors.length !== 3) {
      errors.push(`문장 ${s?.id}: distractors 는 정확히 3개여야 합니다`);
    }
    if (s?.text && s?.blankWord) {
      const ts = tokens(s.text);
      const hits = ts.filter((t) => t === s.blankWord).length;
      if (hits !== 1) {
        errors.push(`문장 ${s.id}: blankWord "${s.blankWord}" 가 text 에 ${hits}회 등장 (1회여야 함, 대소문자 구분)`);
      } else if (ts[0] === s.blankWord) {
        errors.push(`문장 ${s.id}: blankWord 가 문장 첫 단어입니다 — 검증기가 대소문자를 구분하므로 첫 단어는 쓸 수 없습니다`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function loadEnv() {
  const out = {};
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

function rest(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const base = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  return {
    async get(path) {
      const r = await fetch(`${base}${path}`, { headers });
      if (!r.ok) throw new Error(`GET ${path} -> ${r.status} ${await r.text()}`);
      return r.json();
    },
    async post(path, body, prefer) {
      const r = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: prefer ? { ...headers, Prefer: prefer } : headers,
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`POST ${path} -> ${r.status} ${await r.text()}`);
      return prefer ? r.json() : null;
    },
    async del(path) {
      const r = await fetch(`${base}${path}`, { method: 'DELETE', headers });
      if (!r.ok) throw new Error(`DELETE ${path} -> ${r.status} ${await r.text()}`);
    },
  };
}

async function main() {
  const file = process.argv[2];
  if (!file) { console.error('사용법: npm run ingest -- <파일경로>'); process.exit(1); }

  // 스펙 §12: 잘못된 JSON 은 파싱 오류를 그대로 보고하고 종료한다 (스택 트레이스를 던지지 않는다)
  let input;
  try {
    input = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`입력 파일을 읽을 수 없습니다: ${file}`);
    console.error(`  ${e.message}`);
    process.exit(1);
  }

  const env = loadEnv();
  const api = rest(env);

  // 기존 id 전부 모아서 중복 검사에 쓴다
  const [dbWords, dbSentences] = await Promise.all([
    api.get('/toeic_words?select=item_id'),
    api.get('/toeic_sentences?select=item_id'),
  ]);
  const existing = new Set([...dbWords, ...dbSentences].map((r) => r.item_id));

  const v = validateInput(input, existing);
  if (!v.ok) {
    console.error('검증 실패 — 아무것도 넣지 않았습니다:');
    for (const e of v.errors) console.error('  - ' + e);
    process.exit(1);
  }

  let nextSeq, setId;
  try {
    const sets = await api.get('/toeic_sets?select=seq&order=seq.desc&limit=1');
    nextSeq = (sets[0]?.seq ?? 0) + 1;

    const [created] = await api.post('/toeic_sets', { title: input.title, seq: nextSeq }, 'return=representation');
    setId = created.id;
  } catch (e) {
    console.error('묶음(set) 생성 중 오류가 발생했습니다 — 아무것도 넣지 않았습니다:', e.message);
    process.exit(1);
  }

  try {
    if (input.words.length) {
      await api.post('/toeic_words', input.words.map((w, i) => ({
        item_id: w.id, set_id: setId, seq: i + 1,
        word: w.word, pos: w.pos, meaning: w.meaning,
        example: w.example, example_ko: w.exampleKo,
      })));
    }
    if (input.sentences.length) {
      await api.post('/toeic_sentences', input.sentences.map((s, i) => ({
        item_id: s.id, set_id: setId, seq: i + 1,
        text: s.text, ko: s.ko, blank_word: s.blankWord, distractors: s.distractors,
      })));
    }
  } catch (e) {
    console.error('항목 삽입 실패, 방금 만든 묶음을 되돌립니다:', e.message);
    try {
      await api.del(`/toeic_sets?id=eq.${setId}`);
    } catch (delErr) {
      console.error(`되돌리기도 실패했습니다 (set_id=${setId}):`, delErr.message);
      try {
        const [words, sentences] = await Promise.all([
          api.get(`/toeic_words?select=item_id&set_id=eq.${setId}`),
          api.get(`/toeic_sentences?select=item_id&set_id=eq.${setId}`),
        ]);
        console.error(
          `  실제로 남은 데이터: 단어 ${words.length}개, 문장 ${sentences.length}개 (set_id=${setId}). 수동으로 정리해야 합니다.`,
        );
      } catch (checkErr) {
        console.error(
          `  무엇이 남았는지 확인하는 조회도 실패했습니다: ${checkErr.message}. Supabase에서 set_id=${setId} 를 직접 확인하세요.`,
        );
      }
    }
    process.exit(1);
  }

  console.log(`OK — "${input.title}" (seq ${nextSeq}): 단어 ${input.words.length}개, 문장 ${input.sentences.length}개`);
}

// 테스트에서 import 할 때는 main 을 실행하지 않는다
if (process.argv[1] && process.argv[1].endsWith('ingest.mjs')) main();
