// Comments with one level of replies, report, delete-own, and hide (mentor/admin)
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar, PersonLink, timeAgo, errorText } from '../components/ui.jsx';

export default function Comments({ projectId }) {
  const { user } = useAuth();
  const location = useLocation();
  const [data, setData] = useState({ comments: [], canModerate: false });
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/projects/${projectId}/comments`).then((r) => setData(r.data)).catch(() => {});
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const post = async (body, parent) => {
    setBusy(true);
    setError('');
    try {
      await api.post(`/projects/${projectId}/comments`, { body, parent });
      await load();
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn) => {
    setError('');
    try { await fn(); await load(); } catch (err) { setError(errorText(err)); }
  };

  const count = data.comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  return (
    <section className="card comments">
      <h2>Comments ({count})</h2>
      {user ? (
        <form onSubmit={async (e) => { e.preventDefault(); if (await post(text)) setText(''); }}>
          <textarea rows={2} maxLength={1000} placeholder="Ask a question or give feedback…" value={text}
            onChange={(e) => setText(e.target.value)} aria-label="Write a comment" />
          <button disabled={busy || !text.trim()}>Comment</button>
        </form>
      ) : (
        <p className="muted"><Link to="/login" state={{ from: location.pathname }}>Sign in</Link> to comment.</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      <ul className="comment-list">
        {data.comments.map((c) => (
          <CommentItem key={c._id} c={c} user={user} canModerate={data.canModerate} onReply={(body) => post(body, c._id)} act={act} />
        ))}
      </ul>
      {count === 0 && <p className="muted">No comments yet. Be the first.</p>}
    </section>
  );
}

function CommentItem({ c, user, canModerate, onReply, act, isReply }) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');

  return (
    <li className={`comment ${c.hidden ? 'is-hidden' : ''}`}>
      <Avatar name={c.user?.name} size={30} />
      <div className="grow">
        <div className="comment-meta">
          <PersonLink user={c.user} />
          {c.user?.role === 'faculty' && <span className="chip">Faculty</span>}
          <span className="muted small"> · {timeAgo(c.createdAt)}</span>
          {c.hidden && <span className="chip status-in_review">hidden{c.reports ? ` · ${c.reports} reports` : ''}</span>}
        </div>
        <p className="prose">{c.deleted ? <em className="muted">Comment deleted</em> : c.body}</p>
        {user && !c.deleted && (
          <div className="comment-actions">
            {!isReply && <button className="link-like" onClick={() => setReplying(!replying)}>Reply</button>}
            {c.mine && <button className="link-like" onClick={() => act(() => api.delete(`/comments/${c._id}`))}>Delete</button>}
            {!c.mine && !c.reported && <button className="link-like" onClick={() => act(() => api.post(`/comments/${c._id}/report`))}>Report</button>}
            {c.reported && <span className="muted small">Reported</span>}
            {canModerate && (
              <button className="link-like" onClick={() => act(() => api.post(`/comments/${c._id}/hide`, { hidden: !c.hidden }))}>
                {c.hidden ? 'Unhide' : 'Hide'}
              </button>
            )}
          </div>
        )}
        {replying && (
          <form className="reply-form" onSubmit={async (e) => {
            e.preventDefault();
            if (await onReply(reply)) { setReply(''); setReplying(false); }
          }}>
            <textarea rows={2} maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Write a reply" autoFocus />
            <button className="small" disabled={!reply.trim()}>Reply</button>
          </form>
        )}
        {c.replies?.length > 0 && (
          <ul className="comment-list replies">
            {c.replies.map((r) => <CommentItem key={r._id} c={r} user={user} canModerate={canModerate} act={act} isReply />)}
          </ul>
        )}
      </div>
    </li>
  );
}
