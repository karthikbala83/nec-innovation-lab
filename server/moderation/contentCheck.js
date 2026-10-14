// ---------------------------------------------------------------
// Content check for feedback, project requests, replies and comments.
// Small, explainable pattern rules (no AI) — runs BEFORE anything is
// stored or emailed, so the portal can't be used to send abuse or spam
// to students (or by students to visitors).
//
//   checkMessage(text, { kind, project }) -> { verdict, reasons[], relevance }
//     verdict 'reject'  never stored; the writer sees why and can edit
//             'hold'    stored, waits for an admin before anyone is emailed
//             'pass'    delivered
//
// Contact details belong in the form fields (verified email + phone),
// not in the message — that stops the message box being used to swap
// numbers or advertise.
// ---------------------------------------------------------------
const L = require('./wordlists');

const MIN = 15;
const MAX = 2000;

// lower-case, undo leetspeak INSIDE words ("sh1t" -> "shit", but "2026" stays a number),
// squeeze "soooo" -> "soo", drop punctuation
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };
const normalise = (text) => String(text || '')
  .toLowerCase()
  .split(/\s+/)
  .map((w) => (/[a-z]/.test(w) ? w.replace(/[013457@$]/g, (c) => LEET[c]) : w))
  .join(' ')
  .replace(/(.)\1{2,}/g, '$1$1')
  .replace(/[^a-z஀-௿\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// whole word / phrase match on the normalised text
const hits = (norm, list) => list.filter((w) => new RegExp(`(^| )${w.replace(/\s+/g, ' ')}( |$)`).test(norm));

const URL_RE = /\b((https?:\/\/|www\.)\S+|\S+\.(com|in|net|org|io|ly|me|xyz|info|co|app|link|site|online)\b\S*)/gi;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// A phone number = one run of digits/spaces/dashes holding 10+ digits ("98765 43210", "+91-98765-43210"),
// but not a list of separate numbers ("1200 2000 3000")
const hasPhone = (s) => (s.match(/\+?\d[\d\s-]{8,}\d/g) || []).some((m) => {
  const groups = m.split(/[\s-]+/);
  return m.replace(/\D/g, '').length >= 10 && groups.length <= 4 && groups.every((g) => /^\+?\d{2,6}$/.test(g)) && !groups.every((g) => g.length === 4);
});
const HANDLE_RE = /(^|\s)@[A-Za-z0-9_.]{3,}/;          // @insta_handle
const TAMIL_RE = /[஀-௿]/;

const tokens = (s) => normalise(s).split(' ').filter((w) => w.length >= 3);

// Words from the project itself count as "relevant": title, tagline, stack, theme…
const projectVocab = (project = {}) => new Set([
  ...tokens(project.title), ...tokens(project.tagline), ...tokens(project.theme), ...tokens(project.category),
  ...(project.repo?.stack || project.stack || []).flatMap(tokens),
  ...tokens(project.problem).slice(0, 60), ...tokens(project.solution).slice(0, 60),
].filter((w) => w.length >= 4));

// minLength: feedback/requests need substance (15); comments and replies can be short ("Thanks!")
const checkMessage = (text, { kind = 'feedback', project, skipRelevance = false, minLength = MIN } = {}) => {
  const raw = String(text || '').trim();
  const reject = [];
  const hold = [];

  if (raw.length < minLength) reject.push(minLength > 2 ? `Write at least ${minLength} characters so the team can act on it` : 'Write something first');
  if (raw.length > MAX) reject.push(`Keep it under ${MAX} characters`);

  const norm = normalise(raw);
  if (hits(norm, L.ABUSE).length) reject.push('Abusive or offensive language');
  if (hits(norm, L.HARASSMENT).length) reject.push('Personal or inappropriate content — keep it about the project');
  if (hits(norm, L.THREATS).length) reject.push('Threatening language');
  if (hits(norm, L.SPAM).length) reject.push('Looks like spam or an advert');

  if (hits(norm, L.MILD).length) hold.push('Contains an insult — a moderator will check the tone');

  if (EMAIL_RE.test(raw) || hasPhone(raw.replace(URL_RE, '')) || HANDLE_RE.test(raw)) {
    reject.push('Remove phone numbers, emails and social handles from the message — the portal passes your verified contact safely');
  }

  const links = raw.match(URL_RE) || [];
  if (links.length > 1) reject.push('Too many links');
  else if (links.length === 1) hold.push('Contains a link');

  const letters = raw.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 20 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7) hold.push('Mostly capital letters');

  const words = norm.split(' ');
  const counts = words.reduce((m, w) => m.set(w, (m.get(w) || 0) + 1), new Map());
  const top = Math.max(0, ...counts.values());
  if (words.length >= 8 && top / words.length > 0.4) reject.push('Repetitive text');

  // Relevance: does it talk about this project / about a request at all?
  const vocab = projectVocab(project);
  const generic = new Set(kind === 'request' ? [...L.REQUEST_WORDS, ...L.FEEDBACK_WORDS] : L.FEEDBACK_WORDS);
  const relevance = words.filter((w) => vocab.has(w) || generic.has(w)).length
    + (kind === 'request' ? hits(norm, L.REQUEST_WORDS.filter((w) => w.includes(' '))).length : 0);
  if (skipRelevance) { /* replies & comments: a conversation, not a pitch */ }
  else if (TAMIL_RE.test(raw) && relevance === 0) hold.push('Written in Tamil — a moderator will read it');
  else if (relevance === 0) hold.push(kind === 'request' ? 'Doesn\'t read like a project request' : 'Doesn\'t seem to be about this project');

  const verdict = reject.length ? 'reject' : hold.length ? 'hold' : 'pass';
  return { verdict, reasons: reject.length ? reject : hold, relevance };
};

// ---- contact field checks (visitor form) ----
const NAME_RE = /^[\p{L} .'-]{2,60}$/u;
const IN_MOBILE = /^(\+91[\s-]?)?[6-9]\d{9}$/;
const INTL = /^\+[1-9]\d{7,14}$/;

const checkContact = ({ name, email, phone }) => {
  const errors = [];
  if (!NAME_RE.test(String(name || '').trim())) errors.push('Enter your name (letters only)');
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e)) errors.push('Enter a valid email');
  else if (L.DISPOSABLE_DOMAINS.includes(e.split('@')[1])) errors.push('Temporary email addresses are not accepted');
  const p = String(phone || '').replace(/[\s-]/g, '');
  if (!IN_MOBILE.test(p) && !INTL.test(p)) errors.push('Enter a valid mobile number (10 digits, or +country code)');
  return errors;
};

module.exports = { checkMessage, checkContact, normalise };
