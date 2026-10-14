// /seasons/:slug — timeline, enter your project, entries by track, winners wall
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner, errorText, PersonLink } from '../components/ui.jsx';
import ProjectCard from '../feed/ProjectCard.jsx';
import { PhaseChip, fmtDate, relDays } from './Seasons.jsx';

const STEPS = [
  ['submissionOpens', 'Entries open'],
  ['submissionCloses', 'Entries close'],
  ['judgingCloses', 'Judging ends'],
  ['demoDayAt', 'Demo day'],
];

export default function SeasonPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [s, setS] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api.get(`/seasons/${slug}`).then((r) => setS(r.data)).catch((err) => setError(errorText(err, 'Season not found'))), [slug]);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="card empty"><p>{error}</p><Link to="/seasons">All seasons</Link></div>;
  if (!s) return <Spinner />;

  const now = Date.now();
  const steps = STEPS.filter(([k]) => s[k]).sort((a, b) => new Date(s[a[0]]) - new Date(s[b[0]]));
  const tracks = s.tracks.filter((t) => s.entries.some((e) => e.track === t));

  return (
    <div className="season-page">
      <p><Link to="/seasons">← All seasons</Link></p>
      <section className={`card season-head ${s.phase}`}>
        <div className="row-between">
          <PhaseChip phase={s.phase} />
          <span className="muted small">{s.kind === 'demo_day' ? '🎤 Demo Day' : '🏁 Season'} · {s.entries.length} entries</span>
        </div>
        <h1>{s.name}</h1>
        {s.description && <p className="prose">{s.description}</p>}
        {s.demoDayAt && s.phase !== 'results' && (
          <p className="demo-callout">🎤 Demo day <strong>{fmtDate(s.demoDayAt, true)}</strong> ({relDays(s.demoDayAt)}){s.venue ? ` · ${s.venue}` : ''}</p>
        )}
        <ol className="season-timeline" aria-label="Timeline">
          {steps.map(([k, label]) => (
            <li key={k} className={new Date(s[k]) <= now ? 'done' : ''}>
              <span className="dot" aria-hidden="true" />
              <strong>{label}</strong>
              <span className="muted small">{fmtDate(s[k])}</span>
            </li>
          ))}
        </ol>
        <div className="actions">
          {s.viewer.isJudge && ['judging', 'closed', 'open'].includes(s.phase) && <Link className="btn" to={`/seasons/${s.slug}/judge`}>⚖️ Judge entries</Link>}
          <Link className="btn ghost" to={`/leaderboards?season=${s.slug}`}>Season leaderboard</Link>
          {s.viewer.isAdmin && <Link className="btn ghost" to={`/admin/seasons?id=${s._id}`}>Manage</Link>}
        </div>
      </section>

      {s.phase === 'results' && s.winners?.length > 0 && (
        <section className="winners">
          <h2>🏆 Winners wall</h2>
          <div className="winner-grid">
            {s.winners.map((w, i) => (
              <div key={`${w.track}-${w.rank}-${i}`} className={`winner rank-${w.rank}`} style={{ '--i': i }}>
                <span className="ribbon">{w.award}</span>
                <span className="muted small">{w.track}</span>
                <ProjectCard project={w.project} index={i} />
              </div>
            ))}
          </div>
        </section>
      )}

      {s.phase === 'open' && user && <EnterPanel season={s} onChange={load} />}
      {s.phase === 'open' && !user && <p className="card">Students: <Link to="/login">log in</Link> to enter your published project.</p>}

      <section className="card rubric">
        <h2>How it's judged</h2>
        <ul className="part-bars compact">
          {s.criteria.map((c) => (
            <li key={c.key}>
              <div className="row-between"><span>{c.label}</span><span className="muted">{c.weight}%</span></div>
              <div className="bar"><span style={{ width: `${c.weight}%` }} /></div>
            </li>
          ))}
        </ul>
        {s.judges.length > 0 && (
          <p className="small muted">Judges: {s.judges.map((j, i) => <span key={j._id}>{i > 0 && ', '}<PersonLink user={j} />{j.department ? ` (${j.department})` : ''}</span>)}. A judge never scores a project they mentor.</p>
        )}
      </section>

      {tracks.map((t) => (
        <section key={t}>
          <h2>{t} <span className="muted small">· {s.entries.filter((e) => e.track === t).length}</span></h2>
          <div className="card-grid">
            {s.entries.filter((e) => e.track === t).map((e, i) => (
              <ProjectCard key={e._id} project={e.project} index={i}
                extra={(e.pitch || e.average != null) && (
                  <p className="small muted">{e.pitch}{e.average != null && <> · <strong>{e.average}/100</strong> ({e.judged} judge{e.judged === 1 ? '' : 's'})</>}</p>
                )} />
            ))}
          </div>
        </section>
      ))}
      {s.entries.length === 0 && <div className="card empty"><p>No entries yet{s.phase === 'open' ? ' — be the first!' : '.'}</p></div>}
    </div>
  );
}

function EnterPanel({ season, onChange }) {
  const mine = season.viewer.myProjects;
  const free = mine.filter((p) => !p.entry);
  const entered = mine.filter((p) => p.entry);
  const [form, setForm] = useState({ project: free[0]?._id || '', track: season.tracks[0], pitch: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const run = async (fn, ok) => {
    setBusy(true);
    setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); await onChange(); } catch (err) { setMsg({ ok: false, text: errorText(err) }); } finally { setBusy(false); }
  };

  if (!mine.length) {
    return <p className="card small">Only published projects can be entered. <Link to="/me/projects">Finish and publish yours</Link> before entries close ({fmtDate(season.submissionCloses)}).</p>;
  }

  return (
    <section className="card enter-panel">
      <h2>Enter your project</h2>
      {entered.map((p) => (
        <p key={p._id} className="row-between small">
          <span>✅ <strong>{p.title}</strong> is entered</span>
          <button className="ghost small" disabled={busy} onClick={() => window.confirm(`Withdraw ${p.title}?`) && run(() => api.delete(`/seasons/${season.slug}/entries/${p.entry}`), 'Withdrawn')}>Withdraw</button>
        </p>
      ))}
      {free.length > 0 && (
        <>
          <div className="grid-2">
            <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} aria-label="Project">
              {free.map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
            </select>
            <select value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })} aria-label="Track">
              {season.tracks.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <input placeholder="One-line pitch for the judges (optional)" maxLength={280} value={form.pitch}
            onChange={(e) => setForm({ ...form, pitch: e.target.value })} aria-label="Pitch" />
          <button disabled={busy || !form.project} onClick={() => run(() => api.post(`/seasons/${season.slug}/entries`, form), 'Entered! Good luck 🎉')}>
            {busy ? 'Entering…' : 'Enter this project'}
          </button>
        </>
      )}
      {msg && <p className={msg.ok ? 'info' : 'error'} role="status">{msg.text}</p>}
    </section>
  );
}
