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
  const [invite, setInvite] = useState({ name: '', email: '', company: '' });
  const [inviteResult, setInviteResult] = useState(null);

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

  const sendInvite = async (e) => {
    e.preventDefault();
    setError('');
    setInviteResult(null);
    try {
      const { data: r } = await api.post('/admin/recruiters', invite);
      setInviteResult({ ...r, email: invite.email });
      setInvite({ name: '', email: '', company: '' });
      load();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div>
      <div className="row-between"><h2>People</h2><Link to="/admin">Dashboard</Link></div>
      <details className="card">
        <summary><strong>Invite a recruiter</strong></summary>
        <p className="muted small">Recruiters can search talent and request intros through the placement cell. They never see student contact details.</p>
        <form onSubmit={sendInvite} className="grid-2">
          <input placeholder="Name" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} aria-label="Recruiter name" />
          <input placeholder="Company" value={invite.company} onChange={(e) => setInvite({ ...invite, company: e.target.value })} aria-label="Company" />
          <input type="email" placeholder="Work email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} aria-label="Work email" />
          <button disabled={!invite.name || !invite.email || !invite.company}>Create account</button>
        </form>
        {inviteResult && (
          <div className="dup-box">
            <p className="small">Account created for <strong>{inviteResult.email}</strong>. Send them this one-time link to set a password (valid until {new Date(inviteResult.expiresAt).toLocaleDateString('en-IN')}):</p>
            <code className="copy-link">{inviteResult.setPasswordLink}</code>
            <button className="ghost small" onClick={() => navigator.clipboard?.writeText(inviteResult.setPasswordLink)}>Copy link</button>
          </div>
        )}
      </details>
      <form className="filters" onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }}>
        <input type="search" placeholder="Name, email or roll no" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Role">
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="faculty">Faculty</option>
          <option value="admin">Admins</option>
          <option value="recruiter">Recruiters</option>
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
              {u.role === 'recruiter' ? <span className="chip">Recruiter · {u.profile?.company}</span> : (
                <select value={u.role} onChange={(e) => patch(u, { role: e.target.value })} aria-label={`Role of ${u.name}`}>
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                  <option value="admin">Admin</option>
                </select>
              )}
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
