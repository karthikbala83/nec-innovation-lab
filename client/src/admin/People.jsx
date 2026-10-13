// /admin/people — promote faculty, mark students verified (roll number checked)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { errorText } from '../components/ui.jsx';

const LIMIT = 20;

export default function People() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ users: [], total: 0 });
  const [error, setError] = useState('');

  const load = () =>
    api.get('/admin/users', { params: { q, role, page, limit: LIMIT } })
      .then((r) => setData(r.data))
      .catch((err) => setError(errorText(err)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [role, page]);

  const patch = async (u, change) => {
    setError('');
    try {
      await api.patch(`/admin/users/${u._id}`, change);
      setData((d) => ({ ...d, users: d.users.map((x) => (x._id === u._id ? { ...x, ...change } : x)) }));
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div>
      <div className="row-between"><h2>People</h2><Link to="/admin">Dashboard</Link></div>
      <form className="filters" onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }}>
        <input type="search" placeholder="Name, email or roll no" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Role">
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="faculty">Faculty</option>
          <option value="admin">Admins</option>
        </select>
        <button>Search</button>
      </form>
      {error && <p className="error">{error}</p>}
      <ul className="list">
        {data.users.map((u) => (
          <li key={u._id} className="card list-row">
            <div className="grow">
              <strong>{u.name}</strong> {u.handle && <Link className="small" to={`/u/${u.handle}`}>/u/{u.handle}</Link>}
              <div className="muted small">{u.email}</div>
              <div className="muted small">
                {[u.profile?.department, u.profile?.batch, u.profile?.rollNo && `Roll ${u.profile.rollNo}`, u.githubUsername && `GitHub ${u.githubUsername}`]
                  .filter(Boolean).join(' · ')}
              </div>
            </div>
            <div className="list-actions">
              <select value={u.role} onChange={(e) => patch(u, { role: e.target.value })} aria-label={`Role of ${u.name}`}>
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
                <option value="admin">Admin</option>
              </select>
              <label className="check">
                <input type="checkbox" checked={!!u.verified} onChange={(e) => patch(u, { verified: e.target.checked })} /> Verified
              </label>
            </div>
          </li>
        ))}
      </ul>
      <div className="row-between">
        <button className="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span className="muted">{data.total} people</span>
        <button className="ghost" disabled={page * LIMIT >= data.total} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
