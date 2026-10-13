// Update timeline — the project's launch log. The team posts here.
import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { PersonLink, timeAgo, errorText } from '../components/ui.jsx';
import ImageUpload from '../components/ImageUpload.jsx';

export default function Timeline({ project }) {
  const { user } = useAuth();
  const [updates, setUpdates] = useState([]);
  const [form, setForm] = useState({ title: '', body: '', media: '' });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isTeam = project.viewer?.isTeam;

  useEffect(() => {
    api.get(`/projects/${project._id}/updates`).then((r) => setUpdates(r.data)).catch(() => {});
  }, [project._id]);

  const post = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/projects/${project._id}/updates`, form);
      setUpdates([data, ...updates]);
      setForm({ title: '', body: '', media: '' });
      setOpen(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete "${u.title}"?`)) return;
    try {
      await api.delete(`/updates/${u._id}`);
      setUpdates(updates.filter((x) => x._id !== u._id));
    } catch (err) {
      setError(errorText(err));
    }
  };

  if (!isTeam && updates.length === 0) return null;

  return (
    <section className="card">
      <div className="row-between">
        <h2>Updates</h2>
        {isTeam && !open && <button className="ghost small" onClick={() => setOpen(true)}>+ Post update</button>}
      </div>
      {open && (
        <form onSubmit={post} className="update-form">
          <input placeholder="What changed? (e.g. v2 with offline mode)" maxLength={100} value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="Update title" />
          <textarea rows={3} maxLength={2000} placeholder="Details, numbers, what's next" value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })} aria-label="Update details" />
          <input placeholder="Link to a photo or video (optional)" value={form.media} inputMode="url"
            onChange={(e) => setForm({ ...form, media: e.target.value })} aria-label="Media link" />
          <ImageUpload projectId={project._id} kind="update" label="Upload photo"
            onUploaded={(url) => setForm((f) => ({ ...f, media: url }))} />
          <div className="actions">
            <button disabled={busy || !form.title.trim()}>Post</button>
            <button type="button" className="ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      {isTeam && updates.length === 0 && !open && (
        <p className="muted">Post progress here. Updates in the last 60 days count towards your Lab Score.</p>
      )}
      <ol className="timeline">
        {updates.map((u) => (
          <li key={u._id}>
            <div className="row-between">
              <strong>{u.title}</strong>
              <span className="muted small">{timeAgo(u.createdAt)}</span>
            </div>
            {u.body && <p className="prose">{u.body}</p>}
            {u.media && (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(u.media)
              ? <a href={u.media} target="_blank" rel="noreferrer"><img className="update-img" src={u.media} alt="" loading="lazy" /></a>
              : <a href={u.media} target="_blank" rel="noreferrer" className="small">See media ↗</a>)}
            <p className="muted small">
              by <PersonLink user={u.author} />
              {user && (String(u.author?._id) === String(user.id) || user.role === 'admin') && (
                <> · <button className="link-like" onClick={() => remove(u)}>Delete</button></>
              )}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
