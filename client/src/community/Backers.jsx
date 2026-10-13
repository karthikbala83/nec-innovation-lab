// Who backs the project: mentor offers, pilot offers, and backer avatars
import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Avatar, PersonLink } from '../components/ui.jsx';

export default function Backers({ projectId, refreshKey }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/projects/${projectId}/backers`).then((r) => setData(r.data)).catch(() => {});
  }, [projectId, refreshKey]);

  if (!data || (!data.backers.length && !data.mentors.length && !data.pilots.length)) return null;

  return (
    <section className="card">
      <h2>Backers</h2>
      {data.mentors.map((m, i) => (
        <p key={`m${i}`} className="offer-line">🎓 <PersonLink user={m.user} /> offers to mentor: <span className="muted">“{m.note}”</span></p>
      ))}
      {data.pilots.map((p) => (
        <p key={p._id} className="offer-line">
          🧪 Pilot {p.status === 'confirmed' ? 'confirmed' : 'offered'} by <PersonLink user={p.user} />: <span className="muted">“{p.note}”</span>
          {p.status !== 'confirmed' && <span className="chip">awaiting admin</span>}
        </p>
      ))}
      {data.backers.length > 0 && (
        <div className="backer-avatars">
          {data.backers.slice(0, 24).map((b, i) => b.user && (
            <PersonLink key={i} user={b.user}><Avatar name={b.user.name} size={30} /></PersonLink>
          ))}
          {data.backers.length > 24 && <span className="muted">+{data.backers.length - 24}</span>}
        </div>
      )}
    </section>
  );
}
