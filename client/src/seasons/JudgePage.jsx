// /seasons/:slug/judge — score each entry on the rubric (0–10 per criterion)
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import { Spinner, errorText, Thumb } from '../components/ui.jsx';
import { fmtDate } from './Seasons.jsx';

export default function JudgePage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/seasons/${slug}/judging`).then((r) => setData(r.data)).catch((err) => setError(errorText(err)));
  }, [slug]);

  if (error) return <div className="card empty"><p>{error}</p><Link to={`/seasons/${slug}`}>Back to the season</Link></div>;
  if (!data) return <Spinner />;
  const done = data.entries.filter((e) => e.myScore).length;
  const toScore = data.entries.filter((e) => !e.conflict).length;

  return (
    <div>
      <p><Link to={`/seasons/${slug}`}>← {data.season.name}</Link></p>
      <h2>Judging</h2>
      <p className="muted">
        {data.season.phase === 'judging'
          ? `Score each entry 0–10 per criterion. You can change scores until ${fmtDate(data.season.judgingCloses)}.`
          : 'Judging opens when entries close. You can look at the entries now.'}
        {' '}Projects you mentor are skipped — another judge scores them.
      </p>
      <div className="judge-progress" aria-label={`${done} of ${toScore} scored`}>
        <div className="bar"><span style={{ width: `${toScore ? (done / toScore) * 100 : 0}%` }} /></div>
        <span className="small"><strong>{done}</strong> / {toScore} scored</span>
      </div>
      {data.entries.map((e) => <JudgeCard key={e._id} entry={e} season={data.season} slug={slug} />)}
    </div>
  );
}

function JudgeCard({ entry, season, slug }) {
  const init = Object.fromEntries(season.criteria.map((c) => [c.key, entry.myScore?.marks?.[c.key] ?? 5]));
  const [marks, setMarks] = useState(init);
  const [comment, setComment] = useState(entry.myScore?.comment || '');
  const [state, setState] = useState(entry.myScore ? { ok: true, text: `Saved · ${entry.myScore.total}/100` } : null);
  const [busy, setBusy] = useState(false);
  const p = entry.project;
  const total = Math.round(season.criteria.reduce((s, c) => s + (marks[c.key] / 10) * c.weight, 0) * 10) / 10;
  const canScore = season.phase === 'judging' && !entry.conflict;

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put(`/seasons/${slug}/entries/${entry._id}/score`, { marks, comment });
      setState({ ok: true, text: `Saved · ${data.total}/100 · ${data.judged} judge${data.judged === 1 ? '' : 's'} so far` });
    } catch (err) {
      setState({ ok: false, text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`card judge-card ${entry.conflict ? 'conflict' : ''}`}>
      <div className="judge-head">
        <Thumb project={p} className="thumb-sm" />
        <div className="grow">
          <strong><Link to={`/p/${p.slug}`} target="_blank">{p.title} ↗</Link></strong>
          <p className="muted small">{entry.track} · {p.department} · Lab Score {p.labScore?.total ?? 0}{p.lotus?.vivas ? ` · ${p.lotus.vivas} viva` : ''}</p>
          {entry.pitch && <p className="small">“{entry.pitch}”</p>}
          <p className="small judge-links">
            {[[p.liveUrl, 'Live demo'], [p.videoUrl, 'Video'], [p.repoUrl, 'Code']].filter(([u]) => u)
              .map(([u, label]) => <a key={label} href={u} target="_blank" rel="noreferrer">{label}</a>)}
          </p>
        </div>
        {!entry.conflict && <span className="judge-total" aria-label={`Total ${total} out of 100`}>{total}</span>}
      </div>
      {entry.conflict
        ? <p className="banner status-in_review small">You mentor this project, so another judge scores it.</p>
        : (
          <>
            {season.criteria.map((c) => (
              <label key={c.key} className="rubric-row">
                <span>{c.label} <span className="muted small">({c.weight}%)</span></span>
                <input type="range" min="0" max="10" step="0.5" value={marks[c.key]} disabled={!canScore}
                  onChange={(e) => setMarks({ ...marks, [c.key]: Number(e.target.value) })} aria-label={`${c.label} out of 10`} />
                <strong className="rubric-val">{marks[c.key]}</strong>
              </label>
            ))}
            <textarea rows={2} maxLength={1000} placeholder="Comment for the team and admins (optional)" value={comment}
              onChange={(e) => setComment(e.target.value)} disabled={!canScore} aria-label="Comment" />
            <div className="row-between">
              {state ? <span className={`small ${state.ok ? 'info' : 'error'}`}>{state.text}</span> : <span />}
              <button onClick={save} disabled={busy || !canScore}>{busy ? 'Saving…' : entry.myScore ? 'Update score' : 'Save score'}</button>
            </div>
          </>
        )}
    </section>
  );
}
