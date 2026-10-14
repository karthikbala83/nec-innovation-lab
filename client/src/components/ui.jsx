// Small shared pieces used across feed, launch page, profile and wizard.
import { Link } from 'react-router-dom';

export const STAGE_LABEL = {
  idea: 'Idea', prototype: 'Prototype', live: 'Live', pilot: 'Pilot', incubation: 'Incubation', startup: 'Startup',
};
export const STATUS_LABEL = { draft: 'Draft', in_review: 'In review', published: 'Published', archived: 'Archived' };

export const errorText = (err, fallback = 'Something went wrong') => err?.response?.data?.message || fallback;

export function StageBadge({ stage }) {
  return <span className={`chip stage-${stage}`}>{STAGE_LABEL[stage] || stage}</span>;
}

export function StatusBadge({ status }) {
  return <span className={`chip status-${status}`}>{STATUS_LABEL[status] || status}</span>;
}

const initials = (name = '?') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// Flat palette (matches the CSS tokens). A name always maps to the same colour.
export const PALETTE = ['#ff5a36', '#ffc83d', '#19c39c', '#3d9bff', '#8b5cf6', '#ff6fae', '#8cc63f'];
// FNV-1a: spreads similar titles across colours far better than a plain ×31 hash
const hash = (s = '') => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
const pick = (s, offset = 0) => PALETTE[(hash(s) + offset) % PALETTE.length];
// Avatars carry small ink text, so skip grape (below 4.5:1 contrast with ink)
const AVATAR = PALETTE.filter((c) => c !== '#8b5cf6');

export function Avatar({ name, size = 32 }) {
  return (
    <span className="avatar" title={name}
      style={{ width: size, height: size, fontSize: size * 0.38, background: AVATAR[hash(name) % AVATAR.length] }}>
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ members = [], max = 4 }) {
  const people = members.map((m) => m.user).filter(Boolean);
  return (
    <span className="avatar-stack">
      {people.slice(0, max).map((u) => <Avatar key={u._id} name={u.name} size={30} />)}
      {people.length > max && <span className="muted">+{people.length - max}</span>}
    </span>
  );
}

// Flat-art cover generated from the title: one colour block, two shapes, big initials.
// `varied` gives each card its own height so the feed reads like a Pinterest board.
const RATIOS = [[16, 10], [4, 3], [1, 1], [16, 9], [5, 4]];
function FlatCover({ title, varied }) {
  const h = hash(title);
  // Different hash bits for each choice, so two titles rarely share colour AND layout
  const [w, ht] = varied ? RATIOS[(h >>> 7) % RATIOS.length] : [16, 9];
  const W = 320;
  const H = Math.round((W * ht) / w);
  const bg = PALETTE[h % PALETTE.length];
  const a = PALETTE[(h % PALETTE.length + 1 + ((h >>> 11) % (PALETTE.length - 1))) % PALETTE.length];   // never equals bg
  const b = PALETTE[(h >>> 15) % PALETTE.length];
  const layout = (h >>> 3) % 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} cover`} preserveAspectRatio="xMidYMid slice">
      <rect width={W} height={H} fill={bg} />
      {layout === 0 && <circle cx={W * 0.85} cy={H * 0.15} r={H * 0.45} fill={a} stroke="#1b1f3b" strokeWidth="3" />}
      {layout === 1 && <rect x={W * 0.62} y={-H * 0.1} width={H * 0.7} height={H * 0.7} rx="18" fill={a} stroke="#1b1f3b" strokeWidth="3" transform={`rotate(18 ${W * 0.8} ${H * 0.2})`} />}
      {layout === 2 && <path d={`M ${W * 0.55} ${H} A ${H * 0.5} ${H * 0.5} 0 0 1 ${W * 0.55 + H} ${H} Z`} fill={a} stroke="#1b1f3b" strokeWidth="3" />}
      {layout === 3 && [0, 1, 2].map((i) => <rect key={i} x={W * 0.6 + i * 28} y={-10} width="16" height={H + 20} fill={a} stroke="#1b1f3b" strokeWidth="3" transform={`rotate(20 ${W * 0.7} ${H / 2})`} />)}
      <circle cx={W * 0.12} cy={H * 0.85} r={H * 0.1} fill={b} stroke="#1b1f3b" strokeWidth="3" />
      <text x={W * 0.08} y={H * 0.58} fontFamily="Bricolage Grotesque, Plus Jakarta Sans, sans-serif" fontWeight="800"
        fontSize={Math.min(96, H * 0.42)} fill="#1b1f3b">{initials(title)}</text>
    </svg>
  );
}

// Thumbnail, or a generated flat cover when there is none
export function Thumb({ project, className = 'thumb', varied = false }) {
  if (project.thumbnail) return <img className={className} src={project.thumbnail} alt="" loading="lazy" />;
  return (
    <div className={`${className} thumb-gen`} style={className === 'thumb-sm' ? undefined : { aspectRatio: 'auto' }}>
      <FlatCover title={project.title || '?'} varied={varied} />
    </div>
  );
}

export function PersonLink({ user, children }) {
  if (!user?.handle) return children || user?.name || null;
  return <Link to={`/u/${user.handle}`}>{children || user.name}</Link>;
}

export const timeAgo = (date) => {
  if (!date) return '';
  const s = (Date.now() - new Date(date).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  if (d < 45) return `${d} day${d === 1 ? '' : 's'} ago`;
  return new Date(date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

// Tiny SVG sparkline for weekly commits
export function Sparkline({ values = [], width = 160, height = 36 }) {
  if (!values.length) return null;
  const max = Math.max(1, ...values);
  const step = width / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`);
  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`Commits per week, last ${values.length} weeks: ${values.join(', ')}`}>
      <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// YouTube links become an embed; anything else stays a link
export const youTubeId = (url = '') => {
  const m = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(url);
  return m ? m[1] : null;
};

export function Spinner({ label = 'Loading…' }) {
  return <p className="muted" role="status">{label}</p>;
}
