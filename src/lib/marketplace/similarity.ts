/*
 * Duplicate/plagiarism detection between listings. Uses a feature-hashed
 * bag-of-words embedding (lexical, deterministic, no external API) stored in
 * pgvector, compared by cosine similarity. A semantic embedding provider can
 * replace `textEmbedding` later without changing callers.
 */

export const EMBEDDING_DIMS = 1536;
export const DUPLICATE_THRESHOLD = 0.8;

const STOP = new Set("a an and are as at be by for from has have in is it of on or that the this to with we our you your they their i".split(" "));

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Unit-length vector of hashed unigrams + bigrams. */
export function textEmbedding(text: string): number[] {
  const v = new Array<number>(EMBEDDING_DIMS).fill(0);
  const t = tokens(text);
  const grams = [...t, ...t.slice(1).map((w, i) => `${t[i]} ${w}`)];
  for (const g of grams) {
    const h = hash(g);
    v[h % EMBEDDING_DIMS] += h & 0x80000000 ? -1 : 1;
  }
  const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
  return norm ? v.map((x) => x / norm) : v;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
