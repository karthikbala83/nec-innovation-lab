// /intros — recruiter: requests I sent and their status.
// Students: intro requests the placement cell forwarded to me.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner, timeAgo } from '../components/ui.jsx';

const STATUS_TEXT = {
  new: 'With the placement cell',
  forwarded: 'Forwarded to the student',
  declined: 'Declined',
  closed: 'Closed',
};

export default function MyIntros() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/intros/mine').then((r) => setRows(r.data)).catch(() => setRows([])); }, []);
  const recruiter = user.role === 'recruiter';

  return (
    <div>
      <h2>{recruiter ? 'My intro requests' : 'Intro requests for you'}</h2>
      <p className="muted">
        {recruiter
          ? 'The NEC placement cell reviews each request and connects you with the student.'
          : 'Companies asked the placement cell to meet you. The placement cell will tell you the next step.'}
      </p>
      {!rows && <Spinner />}
      {rows?.length === 0 && <div className="card empty"><p>Nothing yet.</p>{recruiter && <Link to="/talent">Find talent →</Link>}</div>}
      <ul className="list">
        {rows?.map((r) => (
          <li key={r._id} className="card">
            <div className="row-between">
              <strong>
                {recruiter ? (r.student?.name || r.project?.title) : `${r.from?.profile?.company || 'A company'} (${r.from?.name})`}
              </strong>
              <span className={`chip intro-${r.status}`}>{STATUS_TEXT[r.status]}</span>
            </div>
            <p className="small muted">
              {r.purpose} · {timeAgo(r.createdAt)}
              {r.project && <> · <Link to={`/p/${r.project.slug}`}>{r.project.title}</Link></>}
            </p>
            <p className="prose">{r.message}</p>
            {r.placementNote && <p className="small"><strong>Placement cell:</strong> {r.placementNote}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
