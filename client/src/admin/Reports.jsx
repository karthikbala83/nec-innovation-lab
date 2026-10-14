// /admin/reports — numbers the placement cell / IIC / HoDs ask for, plus CSV exports.
// Charts are single-series bars (one hue, value labels beside each bar, hover title),
// so nothing depends on colour and every number is also readable as text.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Spinner, errorText, STAGE_LABEL } from '../components/ui.jsx';
import { downloadCsv } from './download.js';

const sorted = (obj) => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Horizontal bars: label · bar · value
function BarList({ rows, unit = '', max, label }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r[1]));
  return (
    <ul className="barlist" aria-label={label}>
      {rows.map(([k, v]) => (
        <li key={k} title={`${k}: ${v}${unit}`}>
          <span className="barlist-label">{k}</span>
          <span className="barlist-track"><span className="barlist-fill" style={{ width: `${(v / top) * 100}%` }} /></span>
          <span className="barlist-value">{v}{unit}</span>
        </li>
      ))}
      {rows.length === 0 && <li className="muted small">No data yet</li>}
    </ul>
  );
}

// Columns for a time series (months)
function Columns({ rows, label }) {
  const top = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="columns" role="img" aria-label={`${label}: ${rows.map((r) => `${r.label} ${r.value}`).join(', ')}`}>
      {rows.map((r) => (
        <div key={r.label} className="col" title={`${r.label}: ${r.value}`}>
          <span className="col-value">{r.value}</span>
          <span className="col-bar" style={{ height: `${Math.max(2, (r.value / top) * 100)}%` }} />
          <span className="col-label">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

const EXPORTS = [
  ['projects', 'Projects', 'Every project: status, team, mentor, Lab Score, Lotus, competitions'],
  ['students', 'Students', 'Internal: college email and roll number, projects, Lotus petals, viva'],
  ['intros', 'Intro requests', 'The placement cell log: company, student, status, notes'],
  ['feedback', 'Feedback & requests', 'Messages and moderation status (no visitor phone/email)'],
];

export default function Reports() {
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => { api.get('/admin/reports').then((x) => setR(x.data)).catch((err) => setError(errorText(err))); }, []);

  const exportCsv = async (key) => {
    setBusy(key);
    try { await downloadCsv(`/admin/export/${key}.csv`, `nec-${key}.csv`); } catch (err) { setError(errorText(err)); } finally { setBusy(''); }
  };

  if (!r) return error ? <p className="error">{error}</p> : <Spinner />;
  const published = r.projects.byStatus.published || 0;
  const lotusTotal = r.lotus.reduce((a, d) => ({ students: a.students + d.students, scored: a.scored + d.scored, viva: a.viva + d.viva }), { students: 0, scored: 0, viva: 0 });
  const months = r.projects.launchesByMonth.map((m) => ({
    label: new Date(`${m.month}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short' }), value: m.launches,
  }));

  return (
    <div className="reports">
      <div className="row-between"><h2>Reports</h2><Link to="/admin">Dashboard</Link></div>
      <p className="muted small">Live numbers, generated {new Date(r.generatedAt).toLocaleString('en-IN')}.</p>

      <div className="stat-grid">
        <div className="stat"><span>{published}</span>Published projects</div>
        <div className="stat"><span>{r.people.students}</span>Students ({r.people.verifiedStudents} verified)</div>
        <div className="stat"><span>{pct(lotusTotal.scored, lotusTotal.students)}%</span>took the Lotus check</div>
        <div className="stat"><span>{lotusTotal.viva}</span>faculty vivas</div>
      </div>

      <div className="report-grid">
        <section className="card">
          <h3>Launches per month</h3>
          <Columns rows={months} label="Projects launched per month" />
        </section>
        <section className="card">
          <h3>Published projects by department</h3>
          <BarList rows={sorted(r.projects.byDepartment)} label="Published projects by department" />
        </section>
        <section className="card">
          <h3>By stage</h3>
          <BarList rows={sorted(r.projects.byStage).map(([k, v]) => [STAGE_LABEL[k] || k, v])} label="Published projects by stage" />
        </section>
        <section className="card">
          <h3>Project pipeline</h3>
          <BarList rows={['draft', 'in_review', 'published', 'archived'].map((k) => [k.replace('_', ' '), r.projects.byStatus[k] || 0])} label="Projects by status" />
        </section>
      </div>

      <section className="card">
        <h3>Lotus &amp; viva coverage by department</h3>
        <p className="muted small">Students on published projects who took the Lotus check (bar = % taken) and how many had a faculty viva.</p>
        <table className="coverage">
          <thead><tr><th>Department</th><th>Students</th><th>Lotus taken</th><th>Viva</th></tr></thead>
          <tbody>
            {r.lotus.map((d) => (
              <tr key={d.department}>
                <td>{d.department}</td>
                <td>{d.students}</td>
                <td>
                  <span className="barlist-track inline" title={`${pct(d.scored, d.students)}% took the Lotus check`}>
                    <span className="barlist-fill" style={{ width: `${pct(d.scored, d.students)}%` }} />
                  </span>{' '}
                  {d.scored} <span className="muted">({pct(d.scored, d.students)}%)</span>
                </td>
                <td>{d.viva}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="report-grid">
        <section className="card">
          <h3>Engagement</h3>
          <ul className="kv">
            <li><span>Likes</span><strong>{r.engagement.likes}</strong></li>
            <li><span>Backers</span><strong>{r.engagement.backers}</strong></li>
            <li><span>Feedback delivered</span><strong>{r.engagement.delivered.feedback || 0}</strong></li>
            <li><span>Project requests</span><strong>{r.engagement.delivered.request || 0}</strong></li>
            <li><span>Held / rejected by moderation</span><strong>{(r.engagement.feedback.held || 0)} / {(r.engagement.feedback.rejected || 0)}</strong></li>
            <li><span>Live demos up now</span><strong>{r.live.upNow} of {r.live.withLiveUrl}{r.live.avgUptime != null ? ` · ${r.live.avgUptime}% avg uptime` : ''}</strong></li>
          </ul>
        </section>
        <section className="card">
          <h3>Placement intros</h3>
          <BarList rows={['new', 'forwarded', 'declined', 'closed'].map((k) => [k, r.engagement.intros[k] || 0])} label="Intro requests by status" />
        </section>
        <section className="card">
          <h3>Top projects (Lab Score)</h3>
          <ol className="top-list">
            {r.projects.top.map((p) => <li key={p._id}><Link to={`/p/${p.slug}`}>{p.title}</Link> <span className="muted small">{p.department} · {p.labScore?.total}</span></li>)}
          </ol>
        </section>
        <section className="card">
          <h3>Seasons</h3>
          <ul className="kv">
            {r.seasons.map((s) => <li key={s.slug}><Link to={`/seasons/${s.slug}`}>{s.name}</Link><strong>{s.entries} entries{s.resultsPublished ? ' · results out' : ''}</strong></li>)}
          </ul>
        </section>
      </div>

      <section className="card">
        <h3>Exports (CSV)</h3>
        <p className="muted small">Opens in Excel / Google Sheets. The students file has personal data — keep it inside the college.</p>
        <ul className="export-list">
          {EXPORTS.map(([key, label, hint]) => (
            <li key={key}>
              <div><strong>{label}</strong><div className="muted small">{hint}</div></div>
              <button className="ghost small" onClick={() => exportCsv(key)} disabled={busy === key}>{busy === key ? 'Preparing…' : '⬇ Download'}</button>
            </li>
          ))}
        </ul>
        <p className="muted small">Season results: Admin → Seasons → pick a season → Results CSV.</p>
      </section>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
