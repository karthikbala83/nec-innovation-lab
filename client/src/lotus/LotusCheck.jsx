// /projects/:id/lotus — the student's Lotus Blossom understanding check.
// Questions come from the Saravonix Lotus API, built from the student's own code.
// Answers are private: only the student and their mentor see them.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import { Spinner, errorText } from '../components/ui.jsx';
import LotusFlower, { PETAL_NAMES } from './LotusFlower.jsx';

const LEVEL = { 1: 'L1 Explain', 2: 'L2 Modify', 3: 'L3 Extend' };

export default function LotusCheck() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');
  const [open, setOpen] = useState(1);
  const dirty = useRef(false);

  const load = useCallback(async () => {
    const { data: d } = await api.get(`/lotus/projects/${id}`);
    setData(d);
    if (d.attempt && !dirty.current) setAnswers(Object.fromEntries(d.attempt.answers.map((a) => [a.qid, a.answer || ''])));
    return d;
  }, [id]);

  useEffect(() => { load().catch((err) => setError(errorText(err))); }, [load]);

  // Poll while the Lotus API is working (questions or scores)
  const waiting = data?.set?.status === 'generating' || data?.attempt?.status === 'scoring';
  useEffect(() => {
    if (!waiting) return undefined;
    const t = setInterval(() => load().catch(() => {}), 3000);
    return () => clearInterval(t);
  }, [waiting, load]);

  const save = async () => {
    await api.put(`/lotus/attempts/${data.attempt._id}/answers`, {
      answers: Object.entries(answers).map(([qid, answer]) => ({ qid, answer })),
    });
    dirty.current = false;
    setSaved(`Saved ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
  };

  // Autosave every 20 s while typing
  useEffect(() => {
    if (data?.attempt?.status !== 'in_progress') return undefined;
    const t = setInterval(() => { if (dirty.current) save().catch(() => {}); }, 20000);
    return () => clearInterval(t);
  });

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); await load(); } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  };

  if (!data) return error ? <p className="error">{error}</p> : <Spinner />;
  const { set, attempt, project } = data;
  const editable = attempt?.status === 'in_progress';
  const scored = attempt?.status === 'scored';
  const answeredCount = Object.values(answers).filter((a) => a.trim()).length;

  return (
    <div className="lotus-page">
      <p><Link to={`/p/${project.slug}`}>← {project.title}</Link></p>
      <h2>Lotus Blossom check</h2>
      <p className="muted">
        Questions are built from <strong>your own code</strong> in this project: 8 petals × 3 levels.
        Your answers are private — only you and your mentor see them. Your page shows petals filled and,
        after the viva, a Verified badge.
      </p>
      {data.mockMode && <p className="banner status-in_review small">Development mode: questions and scores come from a mock, not the real Lotus API.</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {!set && (
        <div className="card">
          <p>Make sure your GitHub repo import is up to date first — the questions point at real files in it.</p>
          <button onClick={() => run(() => api.post(`/lotus/projects/${id}/start`))} disabled={busy}>
            {busy ? 'Starting…' : 'Start my Lotus check'}
          </button>
        </div>
      )}
      {set?.status === 'generating' && <div className="card"><Spinner label="Building your questions from your code… (usually under a minute)" /></div>}
      {set?.status === 'failed' && (
        <div className="card">
          <p className="error">Could not build questions: {set.error}</p>
          <button onClick={() => run(() => api.post(`/lotus/projects/${id}/start`))} disabled={busy}>Try again</button>
        </div>
      )}

      {set?.status === 'ready' && attempt && (
        <>
          {scored && (
            <div className="card lotus-result">
              <LotusFlower petals={attempt.summary.petals} size={84} />
              <div>
                <strong>{attempt.summary.petalsFilled}/8 petals filled · {attempt.summary.percent}%</strong>
                <p className="muted small">A petal fills at 50% of its points. Harder levels count more (L1 ×1, L2 ×2, L3 ×3).</p>
                {attempt.viva.done
                  ? <p className="info">✔ Viva done{attempt.viva.by?.name ? ` with ${attempt.viva.by.name}` : ''} — your page shows Verified.{attempt.viva.note ? ` Note: ${attempt.viva.note}` : ''}</p>
                  : <p className="small">Next: ask your mentor for a short viva on these answers. That earns the Verified badge.</p>}
              </div>
            </div>
          )}
          {attempt.status === 'scoring' && <div className="card"><Spinner label="Scoring your answers…" /></div>}
          {attempt.status === 'failed' && (
            <div className="card">
              <p className="error">Scoring failed: {attempt.error}</p>
              <button onClick={() => run(() => api.post(`/lotus/attempts/${attempt._id}/submit`))} disabled={busy}>Retry scoring</button>
            </div>
          )}

          {PETAL_NAMES.map((name, i) => {
            const petal = i + 1;
            const qs = set.questions.filter((q) => q.petal === petal);
            if (!qs.length) return null;
            const p = attempt.summary?.petals?.find((x) => x.petal === petal);
            return (
              <section key={petal} className="card petal-section">
                <button className="link-like petal-head" onClick={() => setOpen(open === petal ? 0 : petal)} aria-expanded={open === petal}>
                  <strong>{petal}. {name}</strong>
                  <span className="muted small">
                    {scored ? `${p?.percent ?? 0}% ${p?.filled ? '· filled' : ''}` : `${qs.filter((q) => answers[q.qid]?.trim()).length}/${qs.length} answered`}
                  </span>
                </button>
                {open === petal && qs.map((q) => {
                  const a = attempt.answers.find((x) => x.qid === q.qid) || {};
                  const final = a.mentorScore ?? a.aiScore;
                  return (
                    <div key={q.qid} className="question">
                      <p className="small muted">{LEVEL[q.level]} · <code>{q.filePath}</code></p>
                      <p>{q.text}</p>
                      <textarea rows={4} maxLength={3000} value={answers[q.qid] || ''} disabled={!editable}
                        aria-label={`Answer: ${q.text.slice(0, 60)}`}
                        onChange={(e) => { dirty.current = true; setAnswers({ ...answers, [q.qid]: e.target.value }); }} />
                      {scored && (
                        <p className="small">
                          <strong>Score {final}/3</strong>
                          {a.mentorScore != null && <span className="chip">set by mentor</span>}
                          {a.aiFeedback && <> — {a.aiFeedback}</>}
                          {a.mentorNote && <><br />Mentor: {a.mentorNote}</>}
                        </p>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}

          {editable && (
            <div className="lotus-actions">
              <span className="muted small">{answeredCount}/{set.questions.length} answered {saved && `· ${saved}`}</span>
              <button className="ghost" onClick={() => run(save)} disabled={busy}>Save draft</button>
              <button disabled={busy || answeredCount === 0}
                onClick={() => {
                  const blank = set.questions.length - answeredCount;
                  if (blank && !window.confirm(`${blank} questions are blank and will score 0. Submit anyway?`)) return;
                  run(async () => { await save(); await api.post(`/lotus/attempts/${attempt._id}/submit`); });
                }}>
                Submit for scoring
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
