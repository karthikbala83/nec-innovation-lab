// ---------------------------------------------------------------
// Link previews. WhatsApp, LinkedIn, Telegram… don't run our React
// app, so the site (Netlify edge function / nginx) hands crawlers
// this small HTML page with Open Graph tags instead. People never
// see it; they get the normal app at the same URL.
// ---------------------------------------------------------------
const Project = require('../projects/Project');
const User = require('../models/User');
const { clientUrl } = require('../controllers/authController');
const { coverImage } = require('../utils/media');

const SITE = 'NEC Innovation Lab';
const DEFAULT_DESC = 'Projects built by Nandha Engineering College students — demos, code and teams, approved by faculty mentors.';

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s = '', n = 200) => { const t = String(s).replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

const page = ({ title, description, url, image, type = 'website' }) => {
  const img = image || `${clientUrl()}/og-default.png`;
  const tags = [
    ['og:site_name', SITE], ['og:type', type], ['og:title', title], ['og:description', description],
    ['og:url', url], ['og:image', img], ['og:locale', 'en_IN'],
  ].map(([k, v]) => `<meta property="${k}" content="${esc(v)}">`);
  tags.push(
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${esc(img)}">`,
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(url)}">
${tags.join('\n')}
</head><body><h1>${esc(title)}</h1><p>${esc(description)}</p><p><a href="${esc(url)}">Open on ${SITE}</a></p></body></html>`;
};

const send = (res, html, maxAge = 600) => {
  res.set('Cache-Control', `public, max-age=${maxAge}`);
  res.type('html').send(html);
};

// GET /api/share/html/p/:slug
exports.project = async (req, res) => {
  const slug = String(req.params.slug).toLowerCase();
  const p = await Project.findOne({ slug, status: 'published' })
    .select('title slug tagline problem thumbnail screenshots videoUrl department members')
    .populate('members.user', 'name').lean();
  if (!p) return exports.fallback(req, res);
  const names = p.members.map((m) => m.user?.name).filter(Boolean);
  const team = names.length ? ` · by ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}` : '';
  send(res, page({
    title: `${p.title} — ${clip(p.tagline, 90)}`,
    description: clip(`${p.department ? `${p.department} project${team}. ` : ''}${p.problem || p.tagline || ''}`, 200),
    url: `${clientUrl()}/p/${p.slug}`,
    image: coverImage(p),
  }));
};

// GET /api/share/html/u/:handle  — the resume QR / profile link
exports.profile = async (req, res) => {
  const user = await User.findOne({ handle: String(req.params.handle).toLowerCase() }).select('name handle role profile.department').lean();
  if (!user || !['student', 'faculty'].includes(user.role)) return exports.fallback(req, res);
  const filter = user.role === 'faculty' ? { mentor: user._id, status: 'published' } : { 'members.user': user._id, status: 'published' };
  const projects = await Project.find(filter).sort({ publishedAt: -1 }).limit(3).select('title thumbnail screenshots videoUrl').lean();
  const dept = user.profile?.department ? `${user.profile.department} ` : '';
  const what = user.role === 'faculty' ? `${dept}faculty mentor` : `${dept}student`;
  const list = projects.length ? ` Projects: ${projects.map((p) => p.title).join(', ')}.` : '';
  send(res, page({
    title: `${user.name} · ${SITE}`,
    description: clip(`${user.name} — ${what} at Nandha Engineering College.${list}`, 200),
    url: `${clientUrl()}/u/${user.handle}`,
    image: projects.map(coverImage).find(Boolean),
    type: 'profile',
  }));
};

// Anything else (home, seasons, unknown slugs): the site card
exports.fallback = (req, res) => send(res, page({ title: `${SITE} — Nandha Engineering College`, description: DEFAULT_DESC, url: clientUrl() }), 3600);
