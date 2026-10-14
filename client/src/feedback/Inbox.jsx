// /inbox — feedback and project requests for my projects. Reply here;
// the portal emails the sender (their email/phone are never shown).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Avatar, PersonLink, Spinner, timeAgo, errorText } from '../components/ui.jsx';

const TABS = [['', 'All'], ['feedback', 'Feedback'], ['request', 'Project requests']];
const RELATION = { classmate: 'Classmate', friend: 'Friend', faculty: 'Faculty', alumni: 'Alumni', industry: 'Industry', visitor: 'Visitor' };

export default function Inbox() {
  const [kind, setKind] = useState('');
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    setItems(null);
    api.get('/inbox', { params: kind ? { kind } : {} }).then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [kind]);

  const toggle = (fb) => {
    setOpen(open === fb._id ? null : fb._id);
    if (fb.unread) {
      api.post(`/inbox/${fb._id}/read`).catch(() => {});
      setItems((xs) => xs.map((x) => (x._id === fb._id ? { ...x, unread: false } : x)));
      window.dispatchEvent(new Event('inbox-read'));   // nav badge refresh
    }
  };

  return (
    <div>
      <h2>Inbox</h2>
      <p className="muted">Feedback and project requests for your projects. Every message was checked before it reached you. Reply here — the portal emails them, and nobody's phone or email is shared.</p>
      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'tab active' : 'tab'} onClick={() => setKind(k)}>{label}</button>
        ))}
      </div>
      {!items && <Spinner />}
      {items?.length === 0 && (
        <div className="card empty">
          <p>No messages yet.</p>
          <p className="muted small">Share your project's feedback link from its page (WhatsApp / copy link) to start getting likes and feedback.</p>
        </div>
      )}
      <ul className="list">
        {items?.map((fb) => (
          <li key={fb._id} className={`card inbox-item ${fb.unread ? 'unread' : ''} kind-${fb.kind}`}>
            <button className="link-like inbox-head" onClick={() => toggle(fb)} aria-expanded={open === fb._id}>
              <Avatar name={fb.from.name} size={36} />
              <span className="grow">
                <strong>{fb.from.name}</strong>
                <span className="muted small"> · {RELATION[fb.from.relation]}{fb.from.organisation ? `, ${fb.from.organisation}` : ''} · {timeAgo(fb.createdAt)}</span>
                <span className="inbox-preview">{fb.message}</span>
              </span>
              <span className={`chip ${fb.kind === 'request' ? 'kind-req' : 'kind-fb'}`}>{fb.kind === 'request' ? '🛠 Request' : '💬 Feedback'}</span>
            </button>
            {open === fb._id && <Thread fb={fb} onChange={(next) => setItems((xs) => xs.map((x) => (x._id === next._id ? { ...x, ...next } : x)))} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Thread({ fb, onChange }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reply = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/inbox/${fb._id}/reply`, { body });
      onChange({ ...data, project: fb.project });
      setBody('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="thread">
      <p className="small muted">
        On <Link to={`/p/${fb.project.slug}`}>{fb.project.title}</Link>
        {fb.rating ? ` · ${'★'.repeat(fb.rating)}${'☆'.repeat(5 - fb.rating)}` : ''}
        {fb.kind === 'request' && (fb.request?.timeline || fb.request?.budget) && ` · ${[fb.request.timeline && `timeline ${fb.request.timeline}`, fb.request.budget && `budget ${fb.request.budget}`].filter(Boolean).join(', ')}`}
        {fb.from.user && <> · <PersonLink user={fb.from.user}>profile</PersonLink></>}
      </p>
      <p className="bubble them prose">{fb.message}</p>
      {fb.thread.map((p) => (
        <p key={p._id} className={`bubble prose ${p.by === 'team' ? 'us' : 'them'}`}>
          {p.body}
          <span className="bubble-meta">{p.by === 'team' ? (p.user?.name || 'Team') : fb.from.name} · {timeAgo(p.at)}</span>
        </p>
      ))}
      <textarea rows={3} maxLength={2000} placeholder={fb.kind === 'request' ? 'Reply: questions, a rough plan, next steps…' : 'Say thanks, or ask a follow-up question…'}
        value={body} onChange={(e) => setBody(e.target.value)} aria-label="Reply" />
      {error && <p className="error small">{error}</p>}
      <div className="row-between">
        <span className="muted small">Keep contact details out — they reply through the portal link we email them.</span>
        <button onClick={reply} disabled={busy || body.trim().length < 2}>{busy ? 'Sending…' : 'Reply'}</button>
      </div>
    </div>
  );
}
