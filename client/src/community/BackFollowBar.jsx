// "Back this project" + "Follow", and the mentor / pilot offers (spec §6, no money)
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { errorText } from '../components/ui.jsx';

export default function BackFollowBar({ project, onCounts }) {
  const { user } = useAuth();
  const location = useLocation();
  const [state, setState] = useState({ backings: [], following: false });
  const [counts, setCounts] = useState(project.counts || {});
  const [offer, setOffer] = useState(null);   // 'mentor' | 'pilot' | null
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);   // { text, ok }

  const id = project._id;
  const isTeam = project.viewer?.isTeam;

  useEffect(() => {
    if (user) api.get(`/projects/${id}/viewer`).then((r) => setState(r.data)).catch(() => {});
  }, [id, user]);

  const has = (type) => state.backings.find((b) => b.type === type);
  const update = (c) => { setCounts((old) => ({ ...old, ...c })); onCounts?.(c); };

  const run = async (fn) => {
    setBusy(true);
    setMsg(null);
    try { await fn(); } catch (err) { setMsg({ text: errorText(err), ok: false }); } finally { setBusy(false); }
  };

  const toggleBack = () => run(async () => {
    if (has('back')) {
      await api.delete(`/projects/${id}/back`, { params: { type: 'back' } });
      setState((s) => ({ ...s, backings: s.backings.filter((b) => b.type !== 'back') }));
      update({ backers: Math.max(0, (counts.backers || 1) - 1) });
    } else {
      const { data } = await api.post(`/projects/${id}/back`, { type: 'back' });
      setState((s) => ({ ...s, backings: [...s.backings, data] }));
      update({ backers: (counts.backers || 0) + 1 });
    }
  });

  const toggleFollow = () => run(async () => {
    const { data } = state.following ? await api.delete(`/projects/${id}/follow`) : await api.post(`/projects/${id}/follow`);
    setState((s) => ({ ...s, following: data.following }));
    update({ followers: data.followers });
  });

  const sendOffer = () => run(async () => {
    const { data } = await api.post(`/projects/${id}/back`, { type: offer, note });
    setState((s) => ({ ...s, backings: [...s.backings.filter((b) => b.type !== offer), data] }));
    setOffer(null);
    setNote('');
    setMsg({ ok: true, text: offer === 'pilot' ? 'Pilot offer sent. It shows as a badge once the admin confirms it.' : 'Mentor offer sent to the team.' });
  });

  if (project.status !== 'published') return null;

  if (!user) {
    return (
      <div className="back-bar">
        <Link className="btn" to="/login" state={{ from: location.pathname }}>👏 Back this project · {counts.backers || 0}</Link>
        <Link className="btn ghost" to="/login" state={{ from: location.pathname }}>Follow · {counts.followers || 0}</Link>
        <span className="muted small">Sign in with your college email to back or follow</span>
      </div>
    );
  }

  return (
    <div className="back-bar">
      {!isTeam && (
        <button className={has('back') ? 'backed' : ''} onClick={toggleBack} disabled={busy} aria-pressed={!!has('back')}>
          👏 {has('back') ? 'Backed' : 'Back this project'} · {counts.backers || 0}
        </button>
      )}
      <button className="ghost" onClick={toggleFollow} disabled={busy} aria-pressed={state.following}>
        {state.following ? '✓ Following' : 'Follow'} · {counts.followers || 0}
      </button>
      {!isTeam && user.role === 'faculty' && !has('mentor') && (
        <button className="ghost" onClick={() => setOffer('mentor')}>Offer to mentor</button>
      )}
      {!isTeam && !has('pilot') && <button className="ghost" onClick={() => setOffer('pilot')}>Offer a pilot</button>}
      {has('pilot') && <span className="chip">Pilot offer: {has('pilot').status}</span>}

      {offer && (
        <div className="offer-box">
          <label className="field">
            <span className="field-label">{offer === 'pilot' ? 'Who will pilot it, where, how many users?' : 'How can you help the team?'}</span>
            <textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="actions">
            <button onClick={sendOffer} disabled={busy || !note.trim()}>Send offer</button>
            <button className="ghost" onClick={() => setOffer(null)}>Cancel</button>
          </div>
        </div>
      )}
      {msg && <p className={`small ${msg.ok ? 'info' : 'error'}`} role="status">{msg.text}</p>}
    </div>
  );
}
