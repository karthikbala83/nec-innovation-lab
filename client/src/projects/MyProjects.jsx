// /me/projects — every project I'm on, with its status
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { StatusBadge, StageBadge, Thumb, Spinner, timeAgo } from '../components/ui.jsx';
import ProjectCard from '../feed/ProjectCard.jsx';

export default function MyProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState(null);
  const [following, setFollowing] = useState([]);

  useEffect(() => {
    api.get('/projects/mine').then((r) => setProjects(r.data)).catch(() => setProjects([]));
    api.get('/me/following').then((r) => setFollowing(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      <div className="row-between">
        <h2>My projects</h2>
        {user.role !== 'faculty' && <Link className="btn" to="/projects/new">+ Launch a project</Link>}
      </div>
      {user.handle && <p className="muted">Your public profile: <Link to={`/u/${user.handle}`}>/u/{user.handle}</Link> (has your resume QR)</p>}
      {!projects && <Spinner />}
      {projects?.length === 0 && (
        <div className="card empty">
          <p>No projects yet.</p>
          <p className="muted">Launching takes about 10 minutes: basics, story, links, team, GitHub import, submit.</p>
        </div>
      )}
      <ul className="list">
        {projects?.map((p) => (
          <li key={p._id} className="card list-row">
            <Thumb project={p} className="thumb-sm" />
            <div className="grow">
              <strong>{p.title}</strong>
              <div className="chips"><StatusBadge status={p.status} /><StageBadge stage={p.stage} /></div>
              {p.status === 'draft' && p.review?.note && <p className="small error">Mentor&apos;s note: {p.review.note}</p>}
              <p className="muted small">Updated {timeAgo(p.updatedAt)}</p>
            </div>
            <div className="list-actions">
              <Link className="btn ghost small" to={`/projects/${p._id}/edit`}>Edit</Link>
              <Link className="btn ghost small" to={`/p/${p.slug}`}>View</Link>
            </div>
          </li>
        ))}
      </ul>

      {following.length > 0 && (
        <>
          <h2>Following ({following.length})</h2>
          <div className="card-grid">{following.map((p) => <ProjectCard key={p._id} project={p} />)}</div>
        </>
      )}
    </div>
  );
}
