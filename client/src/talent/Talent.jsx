// /talent — recruiter view: students found through their projects, with proof
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { Avatar, PersonLink, StageBadge, Spinner, errorText, STAGE_LABEL } from '../components/ui.jsx';
import LotusFlower from '../lotus/LotusFlower.jsx';
import RequestIntro from '../intros/RequestIntro.jsx';

const DEPARTMENTS = ['CSE', 'IT', 'AI&DS', 'ECE', 'EEE', 'MECH', 'CIVIL', 'BME'];
const KEYS = ['q', 'stack', 'stage', 'department', 'minPetals', 'viva'];

export default function Talent() {
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState(params.get('q') || '');
  const query = Object.fromEntries(KEYS.filter((k) => params.get(k)).map((k) => [k, params.get(k)]));
  const key = JSON.stringify(query);

  useEffect(() => { api.get('/feed/filters').then((r) => setFilters(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    setData(null);
    api.get('/talent', { params: query }).then((r) => setData(r.data)).catch((err) => setError(errorText(err)));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  return (
    <div>
      <h2>Find talent</h2>
      <p className="muted">
        Every student here signed in with a college email, has code pulled from GitHub by the college, and — where shown —
        answered questions about their own code (Lotus) with a faculty viva. To contact anyone, request an intro through the placement cell.
      </p>
      <form className="filters" onSubmit={(e) => { e.preventDefault(); set('q', q.trim()); }}>
        <input type="search" placeholder="Name, skill or GitHub" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select value={params.get('stack') || ''} onChange={(e) => set('stack', e.target.value)} aria-label="Stack">
          <option value="">Any stack</option>
          {filters?.stacks.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={params.get('minPetals') || ''} onChange={(e) => set('minPetals', e.target.value)} aria-label="Lotus petals">
          <option value="">Any Lotus</option>
          {[2, 4, 6, 8].map((n) => <option key={n} value={n}>{n}+ petals</option>)}
        </select>
        <select value={params.get('stage') || ''} onChange={(e) => set('stage', e.target.value)} aria-label="Stage">
          <option value="">Any stage</option>
          {Object.entries(STAGE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={params.get('department') || ''} onChange={(e) => set('department', e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={params.get('viva') === '1'} onChange={(e) => set('viva', e.target.checked ? '1' : '')} /> Viva verified</label>
      </form>

      {error && <p className="error">{error}</p>}
      {!data && !error && <Spinner />}
      {data && <p className="muted small">{data.total} student{data.total === 1 ? '' : 's'}</p>}
      {data?.rows.length === 0 && <div className="card empty"><p>No students match. Loosen a filter.</p></div>}

      <div className="card-grid">
        {data?.rows.map((r) => (
          <div key={r.user._id} className="card talent-card">
            <div className="row-between">
              <div className="talent-head">
                <Avatar name={r.user.name} size={40} />
                <div>
                  <PersonLink user={r.user} />{r.user.verified && <span className="verified" title="College-verified">✔</span>}
                  <div className="muted small">{r.user.profile?.department}{r.user.profile?.batch ? ` · ${r.user.profile.batch}` : ''}</div>
                </div>
              </div>
              <LotusFlower petals={r.projects.reduce((b, p) => (p.lotus.petalsFilled > b.petalsFilled ? p.lotus : b), { petalsFilled: -1, petals: [] }).petals} size={46} />
            </div>
            <p className="small">
              Lotus: {r.lotus.petalsFilled}/8 petals
              {r.lotus.viva.done && <> · <span className="chip verified-chip">✔ Viva by {r.lotus.viva.by}</span></>}
            </p>
            <div className="chips">{r.stack.slice(0, 6).map((s) => <span key={s} className="chip soft">{s}</span>)}</div>
            <ul className="talent-projects">
              {r.projects.map((p) => (
                <li key={p._id}>
                  <Link to={`/p/${p.slug}`}>{p.title}</Link> <StageBadge stage={p.stage} />
                  <span className="muted small"> · {p.role} · Lab Score {p.labScore}</span>
                </li>
              ))}
            </ul>
            <RequestIntro student={r.user._id} />
          </div>
        ))}
      </div>
    </div>
  );
}
