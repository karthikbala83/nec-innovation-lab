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
  const r = (size - 10) / 2;
  const arcR = r - 4;                    // the coloured arc sits just inside the outline
  const c = 2 * Math.PI * arcR;
  const color = value >= 70 ? 'var(--mint)' : value >= 40 ? 'var(--sun)' : 'var(--coral)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Lab Score ${value} out of 100`} className="score-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="#fff" stroke="#1b1f3b" strokeWidth="2" />
      <circle cx={size / 2} cy={size / 2} r={arcR} fill="none" stroke="var(--soft)" strokeWidth="7" />
      <circle className="arc" cx={size / 2} cy={size / 2} r={arcR} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ '--c': c }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="52%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.32} fontWeight="800"
        fontFamily="Bricolage Grotesque, sans-serif" fill="#1b1f3b">{value}</text>
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
