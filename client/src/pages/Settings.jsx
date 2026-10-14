// /settings — your account details. Students who joined with Google land here
// first (?welcome=1) to add department, batch and roll number.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner, errorText } from '../components/ui.jsx';

const DEPARTMENTS = ['CSE', 'IT', 'AI&DS', 'ECE', 'EEE', 'MECH', 'CIVIL', 'BME', 'Other'];

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const welcome = params.get('welcome') === '1';
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then(({ data: { user: u } }) => setF({
      name: u.name || '', githubUsername: u.githubUsername || '', department: u.profile?.department || '',
      year: String(u.profile?.year || ''), batch: u.profile?.batch || '', rollNo: u.profile?.rollNo || '',
      skills: (u.profile?.skills || []).join(', '), company: u.profile?.company || '',
    }));
  }, []);

  if (!f) return <Spinner />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const student = user.role === 'student';

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { data } = await api.patch('/auth/me', {
        name: f.name, githubUsername: f.githubUsername,
        profile: {
          department: f.department, year: f.year, batch: f.batch, rollNo: f.rollNo, company: f.company,
          skills: f.skills.split(',').map((s) => s.trim()).filter(Boolean),
        },
      });
      refreshUser(data.user);
      if (welcome && !data.user.needsProfile) return nav('/me/projects');
      setMsg({ ok: true, text: 'Saved' });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card auth-card settings">
      <h2>{welcome ? `Welcome, ${f.name.split(' ')[0]}! 👋` : 'Your account'}</h2>
      {welcome && <p className="muted">One more step: tell us your department and batch so your projects show up in the right place.</p>}
      <p className="muted small">Signed in as {user.email}. Your email and roll number are never shown publicly.</p>

      <label className="field"><span className="field-label">Name</span><input value={f.name} onChange={set('name')} autoComplete="name" /></label>
      {student && (
        <>
          <div className="grid-2">
            <label className="field"><span className="field-label">Department *</span>
              <select value={f.department} onChange={set('department')}>
                <option value="">Choose…</option>
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
            <label className="field"><span className="field-label">Year</span>
              <select value={f.year} onChange={set('year')}>
                <option value="">Choose…</option>
                {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </label>
            <label className="field"><span className="field-label">Batch *</span><input value={f.batch} onChange={set('batch')} placeholder="2023-2027" /></label>
            <label className="field"><span className="field-label">Roll number *</span><input value={f.rollNo} onChange={set('rollNo')} /></label>
          </div>
          <label className="field"><span className="field-label">GitHub username</span>
            <input value={f.githubUsername} onChange={set('githubUsername')} autoCapitalize="off" placeholder="links your commits to you" />
          </label>
          <label className="field"><span className="field-label">Skills</span><input value={f.skills} onChange={set('skills')} placeholder="react, node, iot" /></label>
        </>
      )}
      {user.role === 'recruiter' && (
        <label className="field"><span className="field-label">Company</span><input value={f.company} onChange={set('company')} /></label>
      )}
      {msg && <p className={msg.ok ? 'info' : 'error'} role="status">{msg.text}</p>}
      <button onClick={save} disabled={busy || !f.name.trim() || (student && (!f.department || !f.batch || !f.rollNo))}>
        {busy ? 'Saving…' : welcome ? 'Save and continue' : 'Save'}
      </button>
      {user.handle && student && <p className="small"><Link to={`/u/${user.handle}`}>View my public profile →</Link></p>}
    </div>
  );
}
