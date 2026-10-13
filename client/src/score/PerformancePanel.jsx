// Performance panel: Lab Score 0–100 with every part visible (spec §5)
export const PART_LABEL = {
  understanding: 'Understanding',
  build: 'Build activity',
  works: 'It works',
  community: 'Community',
  recognition: 'Recognition',
  freshness: 'Freshness',
};

export function ScoreRing({ value = 0, size = 72 }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Lab Score ${value} out of 100`} className="score-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--soft)" strokeWidth="7" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gold)" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.3} fontWeight="800" fill="var(--navy)">{value}</text>
    </svg>
  );
}

// Thin bar per part: filled share = points earned / weight
export function PartBars({ parts = {}, compact = false }) {
  return (
    <ul className={compact ? 'part-bars compact' : 'part-bars'}>
      {Object.entries(PART_LABEL).map(([key, label]) => {
        const p = parts[key];
        if (!p) return null;
        return (
          <li key={key} title={p.detail}>
            <div className="row-between">
              <span>{label}{p.pending && <span className="muted"> · coming in P2</span>}</span>
              <span className="muted">{p.points}/{p.weight}</span>
            </div>
            <div className="bar"><span style={{ width: `${p.weight ? (p.points / p.weight) * 100 : 0}%` }} /></div>
            {!compact && <div className="muted small">{p.detail}</div>}
          </li>
        );
      })}
    </ul>
  );
}

export default function PerformancePanel({ project }) {
  const { labScore = {}, counts = {}, live } = project;
  return (
    <section className="card performance">
      <h2>Performance</h2>
      <div className="perf-head">
        <ScoreRing value={labScore.total || 0} />
        <div>
          <strong>Lab Score</strong>
          <p className="muted small">
            Six parts, weights set by the college. Nothing hidden.
            {labScore.computedAt && ` Updated ${new Date(labScore.computedAt).toLocaleDateString('en-IN')}.`}
          </p>
          {project.liveUrl && <LiveDot live={live} />}
        </div>
      </div>
      <PartBars parts={labScore.parts} />
      <p className="muted small">
        Backers: {counts.backersCollege || 0} college · {counts.backersPublic || 0} public
      </p>
    </section>
  );
}

export function LiveDot({ live }) {
  if (!live?.checkedAt) return <span className="live-state unknown">● not checked yet</span>;
  return (
    <span className={`live-state ${live.ok ? 'up' : 'down'}`} title={`Checked ${new Date(live.checkedAt).toLocaleString('en-IN')}`}>
      ● {live.ok ? 'live' : 'down'}{live.uptime30d != null ? ` · ${live.uptime30d}% up (30 days)` : ''}
    </span>
  );
}
