import { Link } from 'react-router-dom';
import { StageBadge, AvatarStack, Thumb } from '../components/ui.jsx';

// One card in the feed / on a profile
export default function ProjectCard({ project, extra }) {
  const p = project;
  return (
    <Link to={`/p/${p.slug}`} className="project-card">
      <Thumb project={p} />
      <div className="project-card-body">
        <div className="row-between">
          <h3>{p.title}</h3>
          {p.liveUrl && <span className="live-pill" title="Has a live demo">● live demo</span>}
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
          <span className="muted">
            👏 {p.counts?.backers || 0} · 👁 {p.counts?.views || 0}
          </span>
        </div>
        {extra}
      </div>
    </Link>
  );
}
