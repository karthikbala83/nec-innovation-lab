// ---------------------------------------------------------------
// "Fill from GitHub": turn a public repo's description + README into
// a first draft of the launch page (title, tagline, story, demo links,
// screenshots). The student edits everything before submitting.
// Pure parsing lives in parseReadme() so it can be unit-tested.
// ---------------------------------------------------------------
const { createClient } = require('../services/github');
const { youTubeId, driveId } = require('../utils/media');

const LIMITS = { title: 80, tagline: 140, problem: 1500, solution: 2500, impact: 800 };
const SECTION = {
  problem: /problem|motivation|background|why\b|challenge|the need|pain/i,
  impact: /impact|results?|outcome|achievement|accuracy|performance|evaluation/i,
  solution: /solution|about|overview|how it works|description|introduction|features|approach|what it does|working|methodology|project/i,
};
const HARDWARE = /arduino|esp32|esp8266|raspberry|iot|embedded|microcontroller|robot|drone|sensor|pcb|stm32/i;
const BADGE = /shields\.io|badge|badgen|travis-ci|circleci|codecov|githubusercontent\.com\/.*\/workflows|\/actions\/workflows/i;

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : s);

const humanize = (name) => name.replace(/[-_.]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();

// Markdown -> readable plain text for a textarea
const toText = (md) => md
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/```[\s\S]*?```/g, '')
  .replace(/<img[^>]*>/gi, '')
  .replace(/<\/?[a-z][^>]*>/gi, '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/^\s{0,3}#{1,6}\s*/gm, '')
  .replace(/^\s*[-*+]\s+/gm, '• ')
  .replace(/^\s*\|?\s*:?-{3,}.*$/gm, '')
  .replace(/(\*\*|__|`)/g, '')
  .replace(/^>\s?/gm, '')
  .replace(/[ \t]+$/gm, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

// md: README markdown; repo: { owner, name, branch } for resolving relative image paths
const parseReadme = (md, { owner, name, branch = 'HEAD' }) => {
  const out = { screenshots: [] };
  if (!md) return out;
  md = md.slice(0, 100000).replace(/\r\n/g, '\n');

  // Images (README screenshots make a great gallery); skip badges and SVG
  const raw = (path) => `https://raw.githubusercontent.com/${owner}/${name}/${branch}/${path.replace(/^\.?\//, '')}`;
  const urls = [...md.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g), ...md.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
  for (let u of urls) {
    if (BADGE.test(u)) continue;
    if (!/^https?:\/\//i.test(u)) u = raw(u);
    u = u.replace(/^http:/i, 'https:').replace(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\//i, 'https://raw.githubusercontent.com/$1/$2/');
    if (!/\.(png|jpe?g|gif|webp)(\?|$)/i.test(u) && !/user-attachments\/assets|githubusercontent\.com\/.+\/assets\//i.test(u)) continue;
    if (!out.screenshots.includes(u)) out.screenshots.push(u);
    if (out.screenshots.length === 8) break;
  }

  // First demo video link anywhere in the README
  const links = [...md.matchAll(/https?:\/\/[^\s)<>"']+/g)].map((m) => m[0]);
  out.videoUrl = links.find((l) => youTubeId(l) || driveId(l));

  // Split into sections by heading; text before the first section is the intro
  const lines = md.split('\n');
  const sections = [];
  let current = { heading: '', level: 0, body: [] };
  let inCode = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) inCode = !inCode;
    const h = !inCode && /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) {
      sections.push(current);
      current = { heading: toText(h[2]).replace(/^[^\w]+/, ''), level: h[1].length, body: [] };
    } else current.body.push(line);
  }
  sections.push(current);
  const text = (s) => toText(s.body.join('\n'));

  const h1 = sections.find((s) => s.level === 1);
  if (h1 && h1.heading.length <= LIMITS.title) out.title = h1.heading;

  // Intro: leading text, or the H1's own body
  const intro = [sections[0], h1].filter(Boolean).map(text).find((t) => t.length > 30) || '';

  const used = new Set();
  for (const key of ['problem', 'impact', 'solution']) {
    const s = sections.find((x) => x.level > 1 && !used.has(x) && SECTION[key].test(x.heading) && text(x).length > 20);
    if (s) { used.add(s); out[key] = clip(text(s), LIMITS[key]); }
  }
  if (!out.solution && intro) out.solution = clip(intro, LIMITS.solution);
  if (intro) out.introSentence = intro.split(/(?<=[.!?])\s/)[0];
  return out;
};

// POST /api/projects/readme-draft  { repoUrl }
const draftFromRepo = async (repoUrl, parseRepoUrl) => {
  const ref = parseRepoUrl(String(repoUrl || '').trim());
  if (!ref) {
    const err = new Error('Paste the repo link like https://github.com/your-team/your-repo');
    err.status = 400;
    throw err;
  }
  const gh = createClient({ timeoutMs: 10000 });
  let repo;
  try {
    repo = await gh.repo(ref.owner, ref.name);
  } catch (err) {
    if (err.status === 404) err.message = 'Could not read that repo — is it public? For a private repo, write the story yourself and import the code with a token in the Code step.';
    throw err;
  }
  const md = await gh.readme(ref.owner, ref.name);
  const parsed = parseReadme(md, { owner: ref.owner, name: ref.name, branch: repo.default_branch || 'HEAD' });

  const tagline = repo.description?.trim() || parsed.introSentence || '';
  const homepage = /^https:\/\//.test(repo.homepage || '') ? repo.homepage : undefined;
  const hints = [...(repo.topics || []), repo.description || '', repo.language || ''].join(' ');
  return {
    repoUrl: `https://github.com/${ref.owner}/${ref.name}`,
    title: clip(parsed.title || humanize(repo.name), LIMITS.title),
    tagline: clip(tagline, LIMITS.tagline),
    problem: parsed.problem || '',
    solution: parsed.solution || '',
    impact: parsed.impact || '',
    liveUrl: homepage,
    videoUrl: parsed.videoUrl,
    screenshots: parsed.screenshots,
    category: HARDWARE.test(hints) ? 'hardware' : undefined,
    hasReadme: !!md,
  };
};

module.exports = { parseReadme, draftFromRepo };
