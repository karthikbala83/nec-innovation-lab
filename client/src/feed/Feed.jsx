// Home feed: New launches / Trending this week, with filters.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import ProjectCard from './ProjectCard.jsx';
import { STAGE_LABEL, Spinner, errorText } from '../components/ui.jsx';

const TABS = [
  { id: 'new', label: 'New launches' },
  { id: 'trending', label: 'Trending this week' },
];
const FILTER_KEYS = ['department', 'stage', 'category', 'stack', 'q'];

export default function Feed() {
  // Filters live in the URL, so a filtered feed can be shared
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'trending' ? 'trending' : 'new';
  const [filters, setFilters] = useState(null);
  const [data, setData] = useState({ items: [], page: 0, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(params.get('q') || '');

  useEffect(() => { api.get('/feed/filters').then((r) => setFilters(r.data)).catch(() => {}); }, []);

  const query = Object.fromEntries(FILTER_KEYS.filter((k) => params.get(k)).map((k) => [k, params.get(k)]));
  const queryKey = JSON.stringify({ tab, ...query });

  const load = async (page) => {
    setLoading(true);
    setError('');
    try {
      const { data: d } = await api.get('/feed', { params: { tab, page, limit: 12, ...query } });
      setData((prev) => ({ ...d, items: page === 1 ? d.items : [...prev.items, ...d.items] }));
    } catch (err) {
      setError(errorText(err, 'Could not load projects'));
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(1); }, [queryKey]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };
  const anyFilter = FILTER_KEYS.some((k) => params.get(k));

  return (
    <div>
      <section className="hero-band">
        <span className="shape s1" aria-hidden="true" /><span className="shape s2" aria-hidden="true" />
        <span className="shape s3" aria-hidden="true" /><span className="shape s4" aria-hidden="true" />
        <h1>Built at NEC. <em>Proven</em> on GitHub.</h1>
        <p>Launch pages for Nandha Engineering College projects — code pulled by the college, understanding checked, faculty-verified.</p>
        <div className="hero-stats">
          <span>🚀 {data.total || 0} launched</span>
          <span>🪷 Lotus-verified skills</span>
          <span>🎓 Mentor approved</span>
        </div>
      </section>

      <div className="tabs" role="tablist" data-tour="feed-tabs">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setParam('tab', t.id === 'new' ? '' : t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <form className="filters" onSubmit={(e) => { e.preventDefault(); setParam('q', search.trim()); }}>
        <input type="search" placeholder="Search projects, stack, theme…" value={search}
          onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
        <select value={params.get('department') || ''} onChange={(e) => setParam('department', e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {filters?.departments.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select value={params.get('stage') || ''} onChange={(e) => setParam('stage', e.target.value)} aria-label="Stage">
          <option value="">Any stage</option>
          {(filters?.stages || []).map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
        <select value={params.get('category') || ''} onChange={(e) => setParam('category', e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {(filters?.categories || []).map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
        </select>
        <select value={params.get('stack') || ''} onChange={(e) => setParam('stack', e.target.value)} aria-label="Tech stack">
          <option value="">Any stack</option>
          {filters?.stacks.map((s) => <option key={s}>{s}</option>)}
        </select>
        {anyFilter && (
          <button type="button" className="ghost" onClick={() => { setSearch(''); setParams(tab === 'new' ? {} : { tab }); }}>
            Clear
          </button>
        )}
      </form>

      {error && <p className="error">{error}</p>}
      {!loading && !error && data.items.length === 0 && (
        <div className="card empty">
          <p>No projects match yet.</p>
          {anyFilter && <p className="muted">Try clearing the filters.</p>}
        </div>
      )}

      <div className="card-grid">
        {data.items.map((p, i) => <ProjectCard key={p._id} project={p} index={i} />)}
      </div>

      {loading && <Spinner />}
      {!loading && data.page < data.pages && (
        <div className="center"><button className="ghost" onClick={() => load(data.page + 1)}>Load more</button></div>
      )}
    </div>
  );
}
