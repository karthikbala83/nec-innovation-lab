// /admin/moderation — feedback & requests the content check held back.
// Deliver = the team sees it and the owner is emailed. Reject = nobody sees it.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Spinner, timeAgo, errorText } from '../components/ui.jsx';

const TABS = ['held', 'delivered', 'rejected'];

export default function Moderation() {
  const [status, setStatus] = useState('held');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/admin/feedback', { params: { status } }).then((r) => setData(r.data));
  useEffect(() => { setData(null); load().catch((err) => setError(errorText(err))); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (fb, action) => {
    setError('');
    try { await api.post(`/admin/feedback/${fb._id}`, { action }); await load(); } catch (err) { setError(errorText(err)); }
  };

  return (
    <div>
      <div className="row-between"><h2>Feedback moderation</h2><Link to="/admin">Dashboard</Link></div>
      <p className="muted small">The content check rejects abuse, spam and contact details outright, and holds anything doubtful here (off-topic, a link, an insult, Tamil text, shouting). Visitor contacts are visible to admins only.</p>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={status === t} className={status === t ? 'tab active' : 'tab'} onClick={() => setStatus(t)}>
            {t[0].toUpperCase() + t.slice(1)} {data?.counts?.[t] ? `(${data.counts[t]})` : ''}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {!data && <Spinner />}
      {data?.items.length === 0 && <div className="card empty"><p>Nothing here.</p></div>}
      {data?.items.map((fb) => (
        <div key={fb._id} className="card">
          <div className="row-between">
            <strong>{fb.kind === 'request' ? '🛠 Request' : '💬 Feedback'} → <Link to={`/p/${fb.project?.slug}`}>{fb.project?.title}</Link></strong>
            <span className="muted small">{timeAgo(fb.createdAt)}</span>
          </div>
          <p className="small">
            {fb.from.name} ({fb.from.relation}{fb.from.organisation ? `, ${fb.from.organisation}` : ''}) · {fb.from.email}{fb.from.phone ? ` · ${fb.from.phone}` : ''}
            {fb.from.user && ' · college account'}
          </p>
          <p className="bubble them prose">{fb.message}</p>
          {fb.check?.reasons?.length > 0 && <p className="small"><strong>Held because:</strong> {fb.check.reasons.join(', ')}</p>}
          {fb.moderatedBy && <p className="muted small">{fb.status} by {fb.moderatedBy.name} {timeAgo(fb.moderatedAt)}</p>}
          {fb.status === 'held' && (
            <div className="actions">
              <button onClick={() => decide(fb, 'deliver')}>Deliver to team</button>
              <button className="ghost" onClick={() => decide(fb, 'reject')}>Reject</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
