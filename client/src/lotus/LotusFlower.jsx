// Lotus Blossom badge: 8 petals around the project; a coloured petal = filled (spec §7)
// One flat colour per petal, so a full lotus is a little rainbow
const PETAL_COLORS = ['#ff5a36', '#ffc83d', '#19c39c', '#3d9bff', '#8b5cf6', '#ff6fae', '#8cc63f', '#ff9f1c'];
const PETAL_NAMES = ['Problem & users', 'Architecture', 'Data model', 'API & logic', 'Frontend', 'Deployment', 'Security', 'Scale & next steps'];

export default function LotusFlower({ petals = [], size = 44, title }) {
  const filled = new Set(petals.filter((p) => p.filled).map((p) => p.petal));
  const c = size / 2;
  const label = title || `Lotus: ${filled.size} of 8 petals — ${PETAL_NAMES.filter((_, i) => filled.has(i + 1)).join(', ') || 'none yet'}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="lotus-flower">
      <title>{label}</title>
      {PETAL_NAMES.map((_, i) => (
        <g key={i} transform={`rotate(${i * 45} ${c} ${c})`}>
          <ellipse className="petal" cx={c} cy={c - size * 0.24} rx={size * 0.12} ry={size * 0.22}
            style={{ '--p': i, transformOrigin: `${c}px ${c}px` }}
            fill={filled.has(i + 1) ? PETAL_COLORS[i] : '#fff'} stroke="#1b1f3b" strokeWidth={size > 40 ? 1.6 : 1.2} />
        </g>
      ))}
      <circle cx={c} cy={c} r={size * 0.14} fill="#1b1f3b" />
      <text x={c} y={c} dominantBaseline="central" textAnchor="middle" fontSize={size * 0.17} fontWeight="700" fill="#fff">{filled.size}</text>
    </svg>
  );
}

// One line under a member: "Code walkthrough 6/8 petals · Viva by Dr. X on 12 Oct" + Verified
export function LotusLine({ lotus }) {
  if (!lotus || lotus.status === 'not_started') return <span className="muted small">Lotus check not taken yet</span>;
  if (lotus.status !== 'scored') return <span className="muted small">Lotus check in progress</span>;
  return (
    <span className="small lotus-line">
      Code walkthrough {lotus.petalsFilled}/8 petals
      {lotus.viva?.done && (
        <> · Viva by {lotus.viva.by} on {new Date(lotus.viva.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          {' '}<span className="chip verified-chip">✔ Verified</span></>
      )}
    </span>
  );
}

export { PETAL_NAMES };
