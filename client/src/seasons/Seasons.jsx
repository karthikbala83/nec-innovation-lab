// /seasons — every season & demo day: open now, judging, upcoming, past
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Spinner } from '../components/ui.jsx';

export const PHASE = {
  upcoming: { label: 'Upcoming', cls: 'phase-upcoming' },
  open: { label: 'Open for entries', cls: 'phase-open' },
  judging: { label: 'Judging', cls: 'phase-judging' },
  closed: { label: 'Results soon', cls: 'phase-closed' },
  results: { label: 'Results out', cls: 'phase-results' },
};

export const fmtDate = (d, withTime = false) => d && new Date(d).toLocaleDateString('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
});

// "in 3 days" / "2 days ago"
export const relDays = (d) => {
  const days = Math.round((new Date(d) - Date.now()) / 864e5);
  if (days === 0) return 'today';
  return days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${-days} day${days === -1 ? '' : 's'} ago`;
};

export function PhaseChip({ phase }) {
  const p = PHASE[phase] || PHASE.upcoming;
  return <span className={`chip phase ${p.cls}`}>{p.label}</span>;
}

export default function Seasons() {
  const [seasons, setSeasons] = useState(null);
  useEffect(() => { api.get('/seasons').then((r) => setSeasons(r.data)).catch(() => setSeasons([])); }, []);

  return (
    <div>
      <section className="hero-band season-hero">
        <span className="shape s1" aria-hidden="true" /><span className="shape s3" aria-hidden="true" />
        <h1>Seasons &amp; <em>Demo Days</em></h1>
        <p>Enter your published project, demo it live, and get judged by faculty on a clear rubric. Winners get a confirmed badge on their launch page.</p>
      </section>
      {!seasons && <Spinner />}
      {seasons?.length === 0 && <div className="card empty"><p>No seasons yet.</p></div>}
      <div className="season-list">
        {seasons?.map((s, i) => (
          <Link key={s._id} to={`/seasons/${s.slug}`} className={`season-card ${s.phase}`} style={{ '--i': i }}>
            <div className="row-between">
              <PhaseChip phase={s.phase} />
              <span className="muted small">{s.kind === 'demo_day' ? '🎤 Demo Day' : '🏁 Season'}</span>
            </div>
            <h3>{s.name}</h3>
            <p className="muted small">
              {s.phase === 'upcoming' && `Entries open ${relDays(s.submissionOpens)} · ${fmtDate(s.submissionOpens)}`}
              {s.phase === 'open' && `Entries close ${relDays(s.submissionCloses)} · ${fmtDate(s.submissionCloses)}`}
              {s.phase === 'judging' && `Judging ends ${relDays(s.judgingCloses)}`}
              {s.phase === 'closed' && 'Judging done — results coming'}
              {s.phase === 'results' && `Results announced ${fmtDate(s.resultsPublishedAt)}`}
            </p>
            {s.demoDayAt && s.phase !== 'results' && <p className="small">🎤 Demo day {fmtDate(s.demoDayAt)}{s.venue ? ` · ${s.venue}` : ''}</p>}
            <p className="season-count"><strong>{s.entries}</strong> {s.entries === 1 ? 'entry' : 'entries'}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
