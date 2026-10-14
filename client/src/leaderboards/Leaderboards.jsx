// /leaderboards — Lab Score and its parts, most backed, most active repo, best uptime
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { AvatarStack, Spinner, errorText } from '../components/ui.jsx';
import { ScoreRing, PartBars, PART_LABEL } from '../score/PerformancePanel.jsx';

const DEPARTMENTS = ['CSE', 'IT', 'AI&DS', 'ECE', 'EEE', 'MECH', 'CIVIL', 'BME'];

const metric = (board, p) => ({
  lab: `${p.labScore?.total || 0} / 100`,
  backed: `👏 ${p.counts?.backers || 0} (${p.counts?.backersCollege || 0} college)`,
  active: `${p.repo?.commitsLast30d || 0} commits / 30 days`,
  uptime: `${p.live?.uptime30d ?? '—'}% up`,
  lotus: `Lotus ${p.lotus?.teamPercent ?? 0}% · ${p.lotus?.petalsAvg ?? 0}/8 petals · viva ${p.lotus?.vivas ?? 0}`,
}[board]);

export default function Leaderboards() {
  const [params, setParams] = useSearchParams();
  const board = params.get('board') || 'lab';
  const department = params.get('department') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    setData(null);
    api.get('/leaderboards', { params: { board, department } })
      .then((r) => setData(r.data))
      .catch((err) => setError(errorText(err)));
  }, [board, department]);

  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  return (
    <div>
      <h2>Leaderboards</h2>
      <div className="tabs" role="tablist">
        {Object.entries(data?.boards || { lab: 'Lab Score', backed: 'Most backed', active: 'Most active repo', uptime: 'Best uptime' })
          .map(([k, label]) => (
            <button key={k} role="tab" aria-selected={board === k} className={board === k ? 'tab active' : 'tab'} onClick={() => set('board', k === 'lab' ? '' : k)}>
              {label}
            </button>
          ))}
      </div>
      <div className="filters one">
        <select value={department} onChange={(e) => set('department', e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>

      {data?.weights && (
        <p className="muted small">
          Lab Score = {Object.entries(PART_LABEL).map(([k, l]) => `${l} ${data.weights[k]}%`).join(' · ')}. Tap a row to see its parts.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {!data && !error && <Spinner />}
      {data?.rows.length === 0 && <div className="card empty"><p>No projects on this board yet.</p></div>}

      <ol className="board">
        {data?.rows.map((p) => (
          <li key={p._id} className="card board-row">
            <button className="link-like board-main" onClick={() => setOpen(open === p._id ? null : p._id)} aria-expanded={open === p._id}>
              <span className={`rank r${p.rank}`}>{p.rank}</span>
              <ScoreRing value={p.labScore?.total || 0} size={46} />
              <span className="grow board-text">
                <strong>{p.title}</strong>
                <span className="muted small">{p.department} · {metric(board, p)}</span>
              </span>
              <AvatarStack members={p.members} max={3} />
            </button>
            {open === p._id && (
              <div className="board-detail">
                <PartBars parts={p.labScore?.parts} compact />
                <Link to={`/p/${p.slug}`}>Open launch page →</Link>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
