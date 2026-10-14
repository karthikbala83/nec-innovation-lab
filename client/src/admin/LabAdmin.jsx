// /admin/lab — Lab Score weights, pilot confirmations, reported comments, daily checks
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Spinner, PersonLink, timeAgo, errorText } from '../components/ui.jsx';
import { PART_LABEL } from '../score/PerformancePanel.jsx';

export default function LabAdmin() {
  const [data, setData] = useState(null);
  const [weights, setWeights] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState('');

  const load = () => api.get('/admin/lab').then((r) => { setData(r.data); setWeights(r.data.weights); });
  useEffect(() => { load().catch((err) => setMsg({ ok: false, text: errorText(err) })); }, []);

  const run = async (key, fn, okText) => {
    setBusy(key);
    setMsg(null);
    try {
      const text = await fn();
      setMsg({ ok: true, text: text || okText });
      await load();
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) });
    } finally {
      setBusy('');
    }
  };

  if (!data) return msg ? <p className="error">{msg.text}</p> : <Spinner />;
  const sum = Object.keys(PART_LABEL).reduce((s, k) => s + (Number(weights[k]) || 0), 0);

  return (
    <div>
      <div className="row-between"><h2>Lab Score &amp; moderation</h2><Link to="/admin">Dashboard</Link></div>
      {msg && <p className={msg.ok ? 'info' : 'error'} role="status">{msg.text}</p>}

      <section className="card">
        <h3>Score weights</h3>
        <p className="muted small">Must add up to 100. Saving re-scores every published project.</p>
        <div className="weights">
          {Object.entries(PART_LABEL).map(([k, label]) => (
            <label key={k} className="field">
              <span className="field-label">{label}</span>
              <input type="number" min="0" max="100" value={weights[k] ?? ''} onChange={(e) => setWeights({ ...weights, [k]: e.target.value })} />
            </label>
          ))}
        </div>
        <div className="row-between">
          <span className={sum === 100 ? 'info' : 'error'}>Total: {sum}</span>
          <button disabled={sum !== 100 || busy === 'w'}
            onClick={() => run('w', async () => {
              const { data: r } = await api.put('/admin/lab/weights', weights);
              return `Saved. Re-scored ${r.rescored} projects.`;
            })}>
            {busy === 'w' ? 'Saving…' : 'Save weights'}
          </button>
        </div>
      </section>

      <section className="card">
        <h3>Lotus Blossom</h3>
        <p className="small">
          This month: {data.lotus.usage.generated} question sets and {data.lotus.usage.scored} scorings of a {data.lotus.quota} quota each.
        </p>
        {data.lotus.mock && <p className="small banner status-in_review">Mock mode: set LOTUS_API_URL and LOTUS_API_KEY on the server for the real Lotus API.</p>}
      </section>

      <section className="card">
        <h3>Daily checks</h3>
        <p className="muted small">
          Pings live URLs, refreshes repos (with GITHUB_TOKEN) and re-scores everything. Last run:{' '}
          {data.lastDailyChecks ? timeAgo(data.lastDailyChecks) : 'never'}.
        </p>
        <button className="ghost" disabled={busy === 'd'}
          onClick={() => run('d', async () => {
            const { data: r } = await api.post('/admin/jobs/daily-checks', null, { timeout: 300000 });
            return `Done in ${r.seconds}s: ${r.up}/${r.checked} live URLs up, ${r.reposRefreshed} repos refreshed, ${r.scored} scored.`;
          })}>
          {busy === 'd' ? 'Running…' : 'Run daily checks now'}
        </button>
      </section>

      <section className="card">
        <h3>Pilot offers to confirm ({data.pilots.length})</h3>
        {data.pilots.length === 0 && <p className="muted">None waiting.</p>}
        {data.pilots.map((b) => (
          <div key={b._id} className="list-row admin-item">
            <div className="grow">
              <Link to={`/p/${b.project?.slug}`}>{b.project?.title}</Link>
              <p className="small">“{b.note}”</p>
              <p className="muted small">from <PersonLink user={b.user} /> ({b.user?.email}) · {timeAgo(b.createdAt)}</p>
            </div>
            <div className="list-actions">
              <button className="small" disabled={!!busy} onClick={() => run(b._id, () => api.post(`/admin/backings/${b._id}/decide`, { status: 'confirmed' }), 'Pilot confirmed')}>Confirm</button>
              <button className="ghost small" disabled={!!busy} onClick={() => run(b._id, () => api.post(`/admin/backings/${b._id}/decide`, { status: 'declined' }), 'Pilot declined')}>Decline</button>
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h3>Reported comments ({data.reported.length})</h3>
        {data.reported.length === 0 && <p className="muted">Nothing reported.</p>}
        {data.reported.map((c) => (
          <div key={c._id} className="list-row admin-item">
            <div className="grow">
              <p>{c.deleted ? <em className="muted">deleted</em> : c.body}</p>
              <p className="muted small">
                <PersonLink user={c.user} /> on <Link to={`/p/${c.project?.slug}`}>{c.project?.title}</Link> · {c.reports} report{c.reports === 1 ? '' : 's'}
                {c.hidden ? ' · hidden' : ''}
              </p>
            </div>
            <div className="list-actions">
              {c.hidden
                ? <button className="ghost small" onClick={() => run(c._id, () => api.post(`/comments/${c._id}/hide`, { hidden: false }), 'Restored, reports cleared')}>Restore</button>
                : <button className="small" onClick={() => run(c._id, () => api.post(`/comments/${c._id}/hide`, { hidden: true }), 'Hidden')}>Hide</button>}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
