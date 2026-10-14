import { Link } from 'react-router-dom';
import { StageBadge, AvatarStack, Thumb } from '../components/ui.jsx';

// Live/down dot from the daily check (grey until the first check)
function LivePill({ live }) {
  if (!live?.checkedAt) return <span className="live-pill unknown" title="Has a live demo, not checked yet">● live demo</span>;
  return live.ok
    ? <span className="live-pill" title={`Up at last check${live.uptime30d != null ? `, ${live.uptime30d}% over 30 days` : ''}`}>● live</span>
    : <span className="live-pill down" title="Did not answer at the last daily check">● down</span>;
}

// One card in the feed / on a profile. `index` staggers the entrance animation.
export default function ProjectCard({ project, extra, index = 0 }) {
  const p = project;
  return (
    <Link to={`/p/${p.slug}`} className="project-card" style={{ '--i': Math.min(index, 12) }}>
      <span className="vote-box" aria-label={`${p.counts?.backers || 0} backers`}><b>▲</b>{p.counts?.backers || 0}</span>
      <div className="thumb-wrap"><Thumb project={p} varied /></div>
      <div className="project-card-body">
        <div className="row-between">
          <h3>{p.title}</h3>
          {p.liveUrl && <LivePill live={p.live} />}
        </div>
        <p className="tagline">{p.tagline}</p>
        <div className="chips">
          {p.isNewLaunch && <span className="chip new">New</span>}
          <StageBadge stage={p.stage} />
          {p.department && <span className="chip">{p.department}</span>}
          {(p.repo?.stack || []).slice(0, 3).map((s) => <span key={s} className="chip soft">{s}</span>)}
        </div>
        <div className="row-between card-foot">
          <AvatarStack members={p.members} />
          <span className="muted small">
            {p.labScore?.total > 0 && <span className="score-chip" title="Lab Score">★ {p.labScore.total}</span>}
            {' '}♥ {p.counts?.likes || 0} · 👁 {p.counts?.views || 0}
          </span>
        </div>
        {extra}
      </div>
    </Link>
  );
}
