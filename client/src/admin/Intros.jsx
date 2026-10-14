// /admin/intros — the placement cell's inbox of recruiter intro requests
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Spinner, timeAgo, errorText } from '../components/ui.jsx';

const TABS = ['new', 'forwarded', 'declined', 'closed'];

export default function Intros() {
  const [status, setStatus] = useState('new');
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState('');

  const load = () => api.get('/admin/intros', { params: { status } }).then((r) => setData(r.data));
  useEffect(() => { setData(null); load().catch((err) => setError(errorText(err))); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (r, next) => {
    setError('');
    try {
      await api.patch(`/admin/intros/${r._id}`, { status: next, placementNote: notes[r._id] ?? r.placementNote ?? '' });
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div>
      <div className="row-between"><h2>Intro requests</h2><Link to="/admin">Dashboard</Link></div>
      <p className="muted small">
        Recruiters never see student contact details. Forward a request after checking with the student;
        your note is shown to the recruiter, and forwarded requests appear on the student's Intros page.
      </p>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={status === t} className={status === t ? 'tab active' : 'tab'} onClick={() => setStatus(t)}>
            {t[0].toUpperCase() + t.slice(1)} {data?.counts?.[t] ? `(${data.counts[t]})` : ''}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {!data && <Spinner />}
      {data?.intros.length === 0 && <div className="card empty"><p>Nothing here.</p></div>}
      {data?.intros.map((r) => (
        <div key={r._id} className="card">
          <div className="row-between">
            <strong>{r.from?.profile?.company} — {r.from?.name}</strong>
            <span className="muted small">{timeAgo(r.createdAt)}</span>
          </div>
          <p className="small muted">{r.from?.email} · {r.purpose}</p>
          <p className="small">
            For: {r.student ? <Link to={`/u/${r.student.handle}`}>{r.student.name}</Link> : 'the team'}
            {r.project && <> · <Link to={`/p/${r.project.slug}`}>{r.project.title}</Link></>}
          </p>
          <p className="prose">{r.message}</p>
          {r.handledBy && <p className="muted small">Handled by {r.handledBy.name} {timeAgo(r.handledAt)}</p>}
          <textarea rows={2} maxLength={1000} placeholder="Note to the recruiter (e.g. next step, interview slot)"
            value={notes[r._id] ?? r.placementNote ?? ''} onChange={(e) => setNotes({ ...notes, [r._id]: e.target.value })} aria-label="Placement note" />
          <div className="actions">
            {r.status === 'new' && <button onClick={() => decide(r, 'forwarded')}>Forward to student</button>}
            {r.status === 'new' && <button className="ghost" onClick={() => decide(r, 'declined')}>Decline</button>}
            {r.status === 'forwarded' && <button className="ghost" onClick={() => decide(r, 'closed')}>Close</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
