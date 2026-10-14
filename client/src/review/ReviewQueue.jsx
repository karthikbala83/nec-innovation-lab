// /review — mentor approval queue. Approve -> public; send back -> draft with a note.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DuplicateNotice } from '../projects/LaunchPage.jsx';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { StageBadge, Spinner, timeAgo, errorText } from '../components/ui.jsx';

export default function ReviewQueue() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'viva' ? 'viva' : 'approvals';
  const [items, setItems] = useState(null);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({});

  useEffect(() => {
    setItems(null);
    api.get('/review', { params: { status: tab === 'viva' ? 'published' : 'in_review' } })
      .then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [tab]);

  const act = async (p, action) => {
    setBusy(p._id);
    setMsg((m) => ({ ...m, [p._id]: '' }));
    try {
      await api.post(`/review/${p._id}/${action}`, { note: notes[p._id] || '' });
      setItems((list) => list.filter((x) => x._id !== p._id));
    } catch (err) {
      setMsg((m) => ({ ...m, [p._id]: errorText(err) }));
    } finally {
      setBusy('');
    }
  };

  return (
    <div>
      <h2>Review</h2>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'approvals'} className={tab === 'approvals' ? 'tab active' : 'tab'} onClick={() => setParams({})}>Approvals</button>
        <button role="tab" aria-selected={tab === 'viva'} className={tab === 'viva' ? 'tab active' : 'tab'} onClick={() => setParams({ tab: 'viva' })}>Lotus &amp; viva</button>
      </div>
      <p className="muted">
        {user.role === 'admin' ? 'All projects.' : 'Projects where you are the mentor.'}{' '}
        {tab === 'viva' ? 'Read each student\'s Lotus answers, adjust scores, and record the viva.' : 'Nothing is public until approved.'}
      </p>
      {!items && <Spinner />}
      {tab === 'viva' && items?.map((p) => (
        <div key={p._id} className="card list-row">
          <div className="grow">
            <strong>{p.title}</strong>
            <p className="muted small">
              {p.members.map((m) => m.user?.name).filter(Boolean).join(', ')} · Lotus taken {p.lotus?.taken || 0}/{p.members.length} · viva {p.lotus?.vivas || 0}/{p.members.length}
            </p>
          </div>
          <Link className="btn small" to={`/review/viva/${p._id}`}>Open viva mode</Link>
        </div>
      ))}
      {tab === 'viva' && items?.length === 0 && <div className="card empty"><p>No published projects yet.</p></div>}
      {tab === 'approvals' && items?.length === 0 && <div className="card empty"><p>Nothing waiting.</p></div>}
      {tab === 'approvals' && items?.map((p) => (
        <div key={p._id} className="card review-item">
          <div className="row-between">
            <h3>{p.title}</h3>
            <StageBadge stage={p.stage} />
          </div>
          <p className="tagline">{p.tagline}</p>
          <p className="muted small">
            {p.members.map((m) => m.user?.name).filter(Boolean).join(', ')} · {p.department || '—'}
            {p.review?.submittedAt && ` · submitted ${timeAgo(p.review.submittedAt)}`}
            {user.role === 'admin' && p.mentor && ` · mentor ${p.mentor.name}`}
          </p>
          <p className="small">
            {p.repo?.importedAt
              ? `Repo imported: ${p.repo.totalCommits} commits, last ${timeAgo(p.repo.lastCommitAt)} · ${(p.repo.stack || []).join(', ')}`
              : 'Repo not imported'}
          </p>
          {p.duplicate && <DuplicateNotice dup={p.duplicate} />}
          <Link to={`/p/${p.slug}`} target="_blank">Open full page preview ↗</Link>
          <textarea rows={2} placeholder="Note to the team (required to send back)" value={notes[p._id] || ''}
            onChange={(e) => setNotes({ ...notes, [p._id]: e.target.value })} aria-label={`Note for ${p.title}`} />
          {msg[p._id] && <p className="error">{msg[p._id]}</p>}
          <div className="actions">
            <button onClick={() => act(p, 'approve')} disabled={busy === p._id}>Approve &amp; publish</button>
            <button className="ghost" onClick={() => act(p, 'return')} disabled={busy === p._id || !notes[p._id]?.trim()}>
              Send back
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
