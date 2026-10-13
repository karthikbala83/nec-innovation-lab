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

// Colour from the name so each person keeps the same avatar colour everywhere
const hue = (s = '') => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

export function Avatar({ name, size = 32 }) {
  return (
    <span className="avatar" title={name}
      style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${hue(name)} 45% 42%)` }}>
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ members = [], max = 4 }) {
  const people = members.map((m) => m.user).filter(Boolean);
  return (
    <span className="avatar-stack">
      {people.slice(0, max).map((u) => <Avatar key={u._id} name={u.name} size={28} />)}
      {people.length > max && <span className="muted">+{people.length - max}</span>}
    </span>
  );
}

// Thumbnail, or a generated cover from the title when there is none
export function Thumb({ project, className = 'thumb' }) {
  if (project.thumbnail) return <img className={className} src={project.thumbnail} alt="" loading="lazy" />;
  const h = hue(project.title);
  return (
    <div className={`${className} thumb-gen`}
      style={{ background: `linear-gradient(135deg, hsl(${h} 55% 35%), hsl(${(h + 50) % 360} 60% 45%))` }}>
      <span>{initials(project.title)}</span>
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
