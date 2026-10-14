// /admin/seasons — create / edit seasons, see the ranking, publish the winners wall
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { Spinner, errorText } from '../components/ui.jsx';
import { PhaseChip } from '../seasons/Seasons.jsx';
import { downloadCsv } from './download.js';

const DEFAULT_CRITERIA = [
  { key: 'innovation', label: 'Innovation', weight: 25 },
  { key: 'impact', label: 'Impact', weight: 25 },
  { key: 'execution', label: 'Technical execution', weight: 30 },
  { key: 'presentation', label: 'Demo & presentation', weight: 20 },
];
// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm"
const toLocal = (d) => (d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const EMPTY = { name: '', kind: 'season', description: '', tracks: 'Software, Hardware, Research', submissionOpens: '', submissionCloses: '', judgingCloses: '', demoDayAt: '', venue: '', judges: [], criteria: DEFAULT_CRITERIA };

export default function AdminSeasons() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('id') || '';
  const [seasons, setSeasons] = useState(null);
  const [faculty, setFaculty] = useState([]);

  const load = () => api.get('/seasons').then((r) => setSeasons(r.data));
  useEffect(() => { load(); api.get('/users/mentors').then((r) => setFaculty(r.data)).catch(() => {}); }, []);

  return (
    <div>
      <div className="row-between"><h2>Seasons &amp; Demo Days</h2><Link to="/admin">Dashboard</Link></div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={selected === 'new'} className={selected === 'new' ? 'tab active' : 'tab'} onClick={() => setParams({ id: 'new' })}>＋ New</button>
        {seasons?.map((s) => (
          <button key={s._id} role="tab" aria-selected={selected === s._id} className={selected === s._id ? 'tab active' : 'tab'} onClick={() => setParams({ id: s._id })}>{s.name}</button>
        ))}
      </div>
      {!seasons && <Spinner />}
      {seasons && !selected && <p className="muted">Pick a season above, or create a new one.</p>}
      {selected === 'new' && <SeasonForm faculty={faculty} onSaved={(s) => { load(); setParams({ id: s._id }); }} />}
      {selected && selected !== 'new' && <SeasonAdmin key={selected} id={selected} faculty={faculty} onSaved={load} />}
    </div>
  );
}

function SeasonAdmin({ id, faculty, onSaved }) {
  const [season, setSeason] = useState(null);
  const [ranking, setRanking] = useState(null);
  const load = async () => {
    const { data } = await api.get(`/admin/seasons/${id}/ranking`);
    setRanking(data);
    const { data: full } = await api.get(`/seasons/${data.season.slug}`);
    setSeason(full);
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!season || !ranking) return <Spinner />;
  return (
    <>
      <div className="card row-between">
        <span><PhaseChip phase={season.phase} /> <strong>{season.name}</strong> · {season.entries.length} entries</span>
        <span className="actions" style={{ margin: 0 }}>
          <Link className="btn ghost small" to={`/seasons/${season.slug}`}>Public page</Link>
          <button className="ghost small" onClick={() => downloadCsv(`/admin/export/season/${id}.csv`, `${season.slug}.csv`)}>⬇ Results CSV</button>
        </span>
      </div>
      <Ranking id={id} ranking={ranking} onPublished={load} />
      <SeasonForm faculty={faculty} season={season} onSaved={() => { onSaved(); load(); }} />
    </>
  );
}

function Ranking({ id, ranking, onPublished }) {
  const [picks, setPicks] = useState(() => Object.fromEntries((ranking.winners || []).map((w) => [String(w.project), { award: w.award, rank: w.rank, track: w.track }])));
  const [msg, setMsg] = useState(null);
  const phase = ranking.season.phase;
  const toggle = (row, track) => {
    const k = String(row.project._id);
    setPicks((p) => {
      const next = { ...p };
      if (next[k]) delete next[k]; else next[k] = { award: 'Winner', rank: 1, track };
      return next;
    });
  };
  const publish = async () => {
    setMsg(null);
    try {
      const winners = Object.entries(picks).map(([project, w]) => ({ project, ...w }));
      await api.post(`/admin/seasons/${id}/results`, { winners });
      setMsg({ ok: true, text: 'Published — the winners wall is live and the teams were emailed.' });
      onPublished();
    } catch (err) { setMsg({ ok: false, text: errorText(err) }); }
  };
  const tracks = Object.entries(ranking.tracks);

  return (
    <section className="card">
      <h3>Ranking</h3>
      <p className="muted small">Average of the judges' weighted totals (/100). {ranking.judges} judge{ranking.judges === 1 ? '' : 's'} assigned. Tick winners, name the award, then publish.</p>
      {tracks.length === 0 && <p className="muted">No entries yet.</p>}
      {tracks.map(([track, rows]) => (
        <div key={track} className="rank-track">
          <h4>{track}</h4>
          <table>
            <thead><tr><th /><th>Project</th><th>Avg</th><th>Judges</th><th>Award</th><th>Rank</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const k = String(r.project._id);
                const w = picks[k];
                return (
                  <tr key={k}>
                    <td><input type="checkbox" checked={!!w} onChange={() => toggle(r, track)} aria-label={`Winner: ${r.project.title}`} /></td>
                    <td><Link to={`/p/${r.project.slug}`}>{r.project.title}</Link><div className="muted small">{r.scores.map((s) => `${s.judge}: ${s.total}`).join(' · ')}</div></td>
                    <td><strong>{r.average ?? '—'}</strong></td>
                    <td>{r.judged}</td>
                    <td>{w && <input value={w.award} maxLength={60} onChange={(e) => setPicks({ ...picks, [k]: { ...w, award: e.target.value } })} aria-label="Award" />}</td>
                    <td>{w && <input type="number" min="1" max="10" value={w.rank} onChange={(e) => setPicks({ ...picks, [k]: { ...w, rank: Number(e.target.value) } })} aria-label="Rank" className="rank-input" />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      <div className="row-between">
        <span className="muted small">{['upcoming', 'open'].includes(phase) ? 'You can publish after entries close.' : 'Rank 1 = confirmed winner badge; other ranks show as finalist.'}</span>
        <button onClick={publish} disabled={!Object.keys(picks).length || ['upcoming', 'open'].includes(phase)}>
          {ranking.season.resultsPublishedAt ? 'Update results' : 'Publish results'}
        </button>
      </div>
      {msg && <p className={msg.ok ? 'info' : 'error'} role="status">{msg.text}</p>}
    </section>
  );
}

function SeasonForm({ season, faculty, onSaved }) {
  const [f, setF] = useState(() => (season ? {
    ...EMPTY, ...season, tracks: season.tracks.join(', '), judges: season.judges.map((j) => j._id),
    submissionOpens: toLocal(season.submissionOpens), submissionCloses: toLocal(season.submissionCloses),
    judgingCloses: toLocal(season.judgingCloses), demoDayAt: toLocal(season.demoDayAt),
  } : EMPTY));
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const weightSum = f.criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0);

  const save = async () => {
    setMsg(null);
    const body = {
      name: f.name, kind: f.kind, description: f.description, venue: f.venue,
      tracks: f.tracks.split(',').map((t) => t.trim()).filter(Boolean),
      submissionOpens: f.submissionOpens && new Date(f.submissionOpens), submissionCloses: f.submissionCloses && new Date(f.submissionCloses),
      judgingCloses: f.judgingCloses && new Date(f.judgingCloses), demoDayAt: f.demoDayAt ? new Date(f.demoDayAt) : null,
      judges: f.judges, criteria: f.criteria.map((c) => ({ ...c, weight: Number(c.weight) })),
    };
    try {
      const { data } = season ? await api.put(`/admin/seasons/${season._id}`, body) : await api.post('/admin/seasons', body);
      setMsg({ ok: true, text: 'Saved' });
      onSaved(data);
    } catch (err) { setMsg({ ok: false, text: errorText(err) }); }
  };

  return (
    <section className="card">
      <h3>{season ? 'Edit season' : 'New season'}</h3>
      <div className="grid-2">
        <label className="field"><span className="field-label">Name</span><input value={f.name} onChange={set('name')} placeholder="Odd Sem 2026 Demo Day" /></label>
        <label className="field"><span className="field-label">Kind</span>
          <select value={f.kind} onChange={set('kind')}><option value="season">Season (hackathon, SIH…)</option><option value="demo_day">Demo Day</option></select></label>
      </div>
      <label className="field"><span className="field-label">Description</span><textarea rows={2} value={f.description} onChange={set('description')} /></label>
      <label className="field"><span className="field-label">Tracks (comma separated)</span><input value={f.tracks} onChange={set('tracks')} /></label>
      <div className="grid-2">
        <label className="field"><span className="field-label">Entries open</span><input type="datetime-local" value={f.submissionOpens} onChange={set('submissionOpens')} /></label>
        <label className="field"><span className="field-label">Entries close</span><input type="datetime-local" value={f.submissionCloses} onChange={set('submissionCloses')} /></label>
        <label className="field"><span className="field-label">Judging ends</span><input type="datetime-local" value={f.judgingCloses} onChange={set('judgingCloses')} /></label>
        <label className="field"><span className="field-label">Demo day (optional)</span><input type="datetime-local" value={f.demoDayAt} onChange={set('demoDayAt')} /></label>
      </div>
      <label className="field"><span className="field-label">Venue</span><input value={f.venue} onChange={set('venue')} placeholder="IT Block Seminar Hall" /></label>
      <fieldset className="judges-pick">
        <legend className="field-label">Judges (faculty)</legend>
        {faculty.map((u) => (
          <label key={u._id} className="check">
            <input type="checkbox" checked={f.judges.includes(u._id)}
              onChange={(e) => setF({ ...f, judges: e.target.checked ? [...f.judges, u._id] : f.judges.filter((x) => x !== u._id) })} />
            {u.name}{u.profile?.department ? ` (${u.profile.department})` : ''}
          </label>
        ))}
      </fieldset>
      <h4>Rubric <span className={`small ${weightSum === 100 ? 'info' : 'error'}`}>· total {weightSum}%</span></h4>
      {f.criteria.map((c, i) => (
        <div key={i} className="crit-row">
          <input value={c.label} aria-label="Criterion" onChange={(e) => setF({ ...f, criteria: f.criteria.map((x, j) => (j === i ? { ...x, label: e.target.value, key: x.key || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') } : x)) })} />
          <input type="number" min="0" max="100" value={c.weight} aria-label="Weight %" onChange={(e) => setF({ ...f, criteria: f.criteria.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)) })} />
        </div>
      ))}
      <div className="row-between">
        {msg ? <span className={msg.ok ? 'info' : 'error'}>{msg.text}</span> : <span className="muted small">{weightSum !== 100 && 'Rubric weights must add up to 100'}</span>}
        <button onClick={save} disabled={!f.name || weightSum !== 100}>{season ? 'Save changes' : 'Create season'}</button>
      </div>
    </section>
  );
}
