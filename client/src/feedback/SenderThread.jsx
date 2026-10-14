// /messages/:id?t=… — the private page a visitor reaches from the reply email.
// No account needed; the signed link is the key. They can read the thread and reply.
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import api from '../api/axios';
import { Spinner, timeAgo, errorText } from '../components/ui.jsx';

export default function SenderThread() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const t = params.get('t') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  // Plain axios here: a 401 must not bounce the visitor to the login page
  const base = api.defaults.baseURL;
  useEffect(() => {
    axios.get(`${base}/messages/${id}`, { params: { t } }).then((r) => setData(r.data)).catch((err) => setError(errorText(err, 'This link is invalid or expired')));
  }, [id, t, base]);

  const reply = async () => {
    setBusy(true);
    setError('');
    try {
      const { data: d } = await axios.post(`${base}/messages/${id}/reply`, { body }, { params: { t } });
      setData(d);
      setBody('');
      setSent(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (!data) return error ? <div className="card empty"><p>{error}</p><Link to="/">Browse projects</Link></div> : <Spinner />;

  return (
    <div className="sender-thread">
      <h2>Your {data.kind === 'request' ? 'project request' : 'feedback'} to {data.project.title}</h2>
      <p className="muted small">This page is private to you (it opens from the email link). Your email and phone are not shown to the students.</p>
      <div className="card thread">
        <p className="bubble us prose">{data.message}<span className="bubble-meta">You · {timeAgo(data.createdAt)}</span></p>
        {data.thread.map((p, i) => (
          <p key={i} className={`bubble prose ${p.by === 'sender' ? 'us' : 'them'}`}>
            {p.body}<span className="bubble-meta">{p.by === 'sender' ? 'You' : `${p.name || 'Team'} (team)`} · {timeAgo(p.at)}</span>
          </p>
        ))}
        <textarea rows={3} maxLength={2000} placeholder="Write a reply to the team…" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Reply" />
        {error && <p className="error small">{error}</p>}
        {sent && <p className="info small">Sent — the team gets an email.</p>}
        <div className="row-between">
          <Link to={`/p/${data.project.slug}`} className="small">See the project →</Link>
          <button onClick={reply} disabled={busy || body.trim().length < 2}>{busy ? 'Sending…' : 'Reply'}</button>
        </div>
      </div>
    </div>
  );
}
