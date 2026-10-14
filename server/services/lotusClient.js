// ---------------------------------------------------------------
// Thin client for the Saravonix Lotus API (decided 13 Oct 2026).
// The question engine and every AI prompt live at Saravonix — NOT in
// this repo. We send repo coordinates + file lists, receive questions;
// we send answers, receive 0–3 scores with one line of feedback.
// Contract: docs/LOTUS_API.md
//
// Development mock (LOTUS_MOCK=true, or no LOTUS_API_URL outside
// production): returns placeholder questions marked "[MOCK]" that only
// point at real file paths, and scores by answer length. It exists so
// the portal can be built and tested offline — it is not an engine.
// ---------------------------------------------------------------
const crypto = require('crypto');

class LotusError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const useMock = () =>
  process.env.LOTUS_MOCK === 'true' || (!process.env.LOTUS_API_URL && process.env.NODE_ENV !== 'production');

const isConfigured = () => useMock() || !!(process.env.LOTUS_API_URL && process.env.LOTUS_API_KEY);

// ---- real API ----
const call = async (path, body, { timeoutMs = 90000 } = {}) => {
  if (!process.env.LOTUS_API_URL || !process.env.LOTUS_API_KEY) {
    throw new LotusError('Lotus is not configured (LOTUS_API_URL / LOTUS_API_KEY)', 503);
  }
  const url = `${process.env.LOTUS_API_URL.replace(/\/+$/, '')}${path}`;
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.LOTUS_API_KEY}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if (attempt < 2) continue;   // one retry on network errors / timeouts
      throw new LotusError(`Lotus API unreachable: ${err.name === 'TimeoutError' ? 'timed out' : err.message}`);
    }
    if (res.status >= 500 && attempt < 2) continue;   // one retry on server errors
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) throw new LotusError('Lotus quota reached for this month. Try again later.', 429);
    if (!res.ok) throw new LotusError(data.message || `Lotus API returned ${res.status}`, res.status >= 500 ? 502 : 400);
    return data;
  }
};

// ---- dev mock (placeholder text, real file paths) ----
const PETAL_HINTS = [
  /readme/i, /(server|app|index|main)\.(js|ts|py)$|(^|\/)src\/main/i, /(model|schema|entity|migration)/i,
  /(route|controller|api|service|view)/i, /(page|component|screen|\.jsx|\.tsx|\.dart|\.html)/i,
  /(docker|\.ya?ml$|config|\.env\.example|vercel|netlify|railway|render)/i, /(auth|middleware|security|token|login)/i, /./,
];
const LEVEL_TEXT = {
  1: (f) => `Explain what \`${f}\` does.`,
  2: (f) => `Describe how you would change \`${f}\`.`,
  3: (f) => `Propose an extension to \`${f}\`.`,
};

const mockQuestions = ({ repo }) => {
  const mine = repo.memberFiles.map((f) => f.path);
  const all = repo.tree;
  const questions = [];
  for (let petal = 1; petal <= 8; petal++) {
    const pool = [...mine.filter((p) => PETAL_HINTS[petal - 1].test(p)), ...all.filter((p) => PETAL_HINTS[petal - 1].test(p)), ...mine, ...all];
    for (let level = 1; level <= 3; level++) {
      const filePath = pool[(level - 1) % pool.length];
      questions.push({
        id: `mock-${petal}-${level}`, petal, level, filePath,
        text: `[MOCK L${level}] ${LEVEL_TEXT[level](filePath)} (Placeholder — real questions come from the Lotus API.)`,
      });
    }
  }
  return { setId: `mock-${crypto.randomBytes(6).toString('hex')}`, questions };
};

const mockScores = ({ answers }) => ({
  scores: answers.map(({ questionId, answer }) => {
    const n = (answer || '').trim().length;
    return {
      questionId,
      score: n === 0 ? 0 : n < 80 ? 1 : n < 300 ? 2 : 3,
      feedback: '[MOCK] Scored by answer length only — real scoring comes from the Lotus API.',
    };
  }),
});

// ---- public functions ----

// payload: { ref, student: { ref, githubUsername }, project: {...}, repo: { owner, name, sha, tree, keyFiles, memberFiles } }
const generateQuestions = async (payload) => {
  if (useMock()) return { ...mockQuestions(payload), mock: true };
  const data = await call('/v1/question-sets', { ...payload, petals: 8, levels: 3 });
  return { setId: data.setId, questions: data.questions || [], mock: false };
};

// { setId, answers: [{ questionId, answer }] } -> { scores: [{ questionId, score, feedback }] }
const scoreAnswers = async ({ setId, answers }) => {
  if (useMock()) return mockScores({ answers });
  const data = await call(`/v1/question-sets/${encodeURIComponent(setId)}/score`, { answers });
  return { scores: data.scores || [] };
};

// mock is exported for the demo seed only (always labelled [MOCK])
module.exports = { generateQuestions, scoreAnswers, isConfigured, useMock, LotusError, mock: { questions: mockQuestions, scores: mockScores } };
