// /review/viva/:projectId — faculty viva mode: read each member's answers,
// override AI scores, mark the viva done. The strongest trust signal (spec §7).
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import { Avatar, Spinner, errorText } from '../components/ui.jsx';
import LotusFlower from './LotusFlower.jsx';

const LEVEL = { 1: 'L1', 2: 'L2', 3: 'L3' };

export default function VivaView() {
  const { projectId } = useParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => api.get(`/lotus/projects/${projectId}/review`).then((r) => setData(r.data)), [projectId]);
  useEffect(() => { load().catch((err) => setError(errorText(err))); }, [load]);

  const act = async (fn, ok) => {
    setError('');
    setMsg('');
    try { await fn(); await load(); if (ok) setMsg(ok); } catch (err) { setError(errorText(err)); }
  };

  if (!data) return error ? <p className="error">{error}</p> : <Spinner />;
  const m = data.members[tab];

  return (
    <div>
      <p><Link to="/review?tab=viva">← Viva list</Link> · <Link to={`/p/${data.project.slug}`}>{data.project.title}</Link></p>
      <h2>Viva mode</h2>
      <p className="muted small">Answers are private to the student and you. Override any score, then mark the viva done after you have talked to the student.</p>

      <div className="tabs" role="tablist">
        {data.members.map((x, i) => (
          <button key={x.user._id} role="tab" aria-selected={tab === i} className={tab === i ? 'tab active' : 'tab'} onClick={() => setTab(i)}>
            {x.user.name}{x.attempt?.viva?.done ? ' ✔' : ''}
          </button>
        ))}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {msg && <p className="info" role="status">{msg}</p>}

      {m && <MemberViva key={m.user._id} m={m} projectId={projectId} act={act} />}
    </div>
  );
}

function MemberViva({ m, projectId, act }) {
  const [vivaNote, setVivaNote] = useState(m.attempt?.viva?.note || '');
  const { set, attempt } = m;

  if (!set) return <div className="card"><p>{m.user.name} hasn't started the Lotus check yet.</p></div>;
  if (set.status !== 'ready' || !attempt) {
    return <div className="card"><p>Lotus check: {set.status}{set.error ? ` — ${set.error}` : ''}</p></div>;
  }

  return (
    <>
      <div className="card lotus-result">
        <Avatar name={m.user.name} size={44} />
        <div className="grow">
          <strong>{m.user.name}</strong> <span className="muted">· {m.role}{m.user.githubUsername ? ` · GitHub ${m.user.githubUsername}` : ''}</span>
          <p className="small">
            Status: {attempt.status}
            {attempt.status === 'scored' && ` · ${attempt.summary.percent}% · ${attempt.summary.petalsFilled}/8 petals`}
            {set.mock && <span className="chip status-in_review">mock questions</span>}
          </p>
        </div>
        {attempt.status === 'scored' && <LotusFlower petals={attempt.summary.petals} size={64} />}
      </div>

      {set.petals.map((name, i) => {
        const qs = set.questions.filter((q) => q.petal === i + 1);
        if (!qs.length) return null;
        return (
          <section key={name} className="card">
            <h3>{i + 1}. {name}</h3>
            {qs.map((q) => {
              const a = attempt.answers.find((x) => x.qid === q.qid) || {};
              return (
                <div key={q.qid} className="question">
                  <p className="small muted">{LEVEL[q.level]} · <code>{q.filePath}</code></p>
                  <p><strong>{q.text}</strong></p>
                  <p className="prose answer">{a.answer?.trim() ? a.answer : <em className="muted">No answer</em>}</p>
                  {attempt.status === 'scored' && (
                    <div className="override">
                      <span className="small">AI {a.aiScore ?? '–'}/3{a.aiFeedback ? ` — ${a.aiFeedback}` : ''}</span>
                      <label className="small">
                        Your score{' '}
                        <select value={a.mentorScore ?? ''} aria-label="Override score"
                          onChange={(e) => act(() => api.post(`/lotus/attempts/${attempt._id}/override`, {
                            qid: q.qid, score: e.target.value === '' ? null : Number(e.target.value), note: a.mentorNote,
                          }))}>
                          <option value="">use AI</option>
                          {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}

      {attempt.status === 'scored' && (
        <section className="card">
          <h3>Viva</h3>
          {attempt.viva.done
            ? <p className="info">✔ Viva done on {new Date(attempt.viva.at).toLocaleDateString('en-IN')}{attempt.viva.by?.name ? ` by ${attempt.viva.by.name}` : ''}. The page shows Verified.</p>
            : <p className="small">After a short conversation about these answers, mark the viva done. The page then shows “Viva by you on &lt;date&gt;” and a Verified badge.</p>}
          <textarea rows={2} maxLength={1000} placeholder="Private note for the student (optional)" value={vivaNote}
            onChange={(e) => setVivaNote(e.target.value)} aria-label="Viva note" />
          <div className="actions">
            {!attempt.viva.done
              ? <button onClick={() => act(() => api.post(`/lotus/attempts/${attempt._id}/viva`, { done: true, note: vivaNote }), 'Viva recorded')}>Mark viva done</button>
              : <button className="ghost" onClick={() => act(() => api.post(`/lotus/attempts/${attempt._id}/viva`, { done: false }), 'Viva removed')}>Undo viva</button>}
          </div>
        </section>
      )}

      <p className="small">
        <button className="link-like danger-link" onClick={() => {
          if (window.confirm(`Reset ${m.user.name}'s Lotus check? They will get new questions; the old answers stay in history.`)) {
            act(() => api.post(`/lotus/projects/${projectId}/reset`, { user: m.user._id }), 'Reset — the student can start again');
          }
        }}>Reset this student's Lotus check</button>
      </p>
    </>
  );
}
