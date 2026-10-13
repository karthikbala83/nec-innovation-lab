import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// ---------------------------------------------------------------
// Password rules — one small regex per rule, not one monster.
// Each rule maps to one checklist line, so students SEE what
// each regex does as they type.
// Remember: client-side validation is UX. The SERVER must
// validate too — never trust the browser.
// ---------------------------------------------------------------
const RULES = [
  { id: 'len',     label: 'At least 8 characters',            test: (p) => /.{8,}/.test(p) },
  { id: 'upper',   label: 'One uppercase letter (A-Z)',       test: (p) => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'One lowercase letter (a-z)',       test: (p) => /[a-z]/.test(p) },
  { id: 'digit',   label: 'One number (0-9)',                 test: (p) => /\d/.test(p) },
  { id: 'special', label: 'One special character (@$!%*?&#)', test: (p) => /[@$!%*?&#]/.test(p) },
];

const COLLEGE_DOMAIN = import.meta.env.VITE_COLLEGE_DOMAIN || '';
const DEPARTMENTS = ['CSE', 'IT', 'AI&DS', 'ECE', 'EEE', 'MECH', 'CIVIL', 'BME', 'Other'];

export default function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '', skills: '',
    department: 'CSE', year: '1', batch: '', rollNo: '', githubUsername: '',
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Re-runs on every keystroke because state changed -> re-render.
  // This IS "UI = function(state)" in action.
  const results = RULES.map((r) => ({ ...r, ok: r.test(form.password) }));
  const allValid = results.every((r) => r.ok);

  const submit = async () => {
    setError('');
    if (!allValid) return setError('Password does not meet all the rules below');
    try {
      await signup({
        name: form.name,
        email: form.email,
        password: form.password,
        githubUsername: form.githubUsername.trim() || undefined,
        profile: {
          department: form.department,
          year: Number(form.year),
          batch: form.batch.trim() || undefined,
          rollNo: form.rollNo.trim() || undefined,
          skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
        },
      });
      nav('/me/projects');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
    }
  };

  return (
    <div className="card auth-card">
      <h2>Join NEC Innovation Lab</h2>
      <p className="muted">Sign up with your college email{COLLEGE_DOMAIN ? ` (@${COLLEGE_DOMAIN})` : ''}.</p>
      {error && <p className="error">{error}</p>}
      <input placeholder="Full name" value={form.name} onChange={set('name')} autoComplete="name" />
      <input type="email" placeholder={COLLEGE_DOMAIN ? `you@${COLLEGE_DOMAIN}` : 'College email'} value={form.email}
             onChange={set('email')} autoComplete="email" />
      <input type="password" placeholder="Password" value={form.password} onChange={set('password')} />

      {/* Live checklist — appears once the user starts typing */}
      {form.password && (
        <ul className="pw-rules">
          {results.map((r) => (
            <li key={r.id} className={r.ok ? 'rule ok' : 'rule bad'}>
              {r.ok ? '✓' : '○'} {r.label}
            </li>
          ))}
        </ul>
      )}

      <div className="grid-2">
        <select value={form.department} onChange={set('department')} aria-label="Department">
          {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select value={form.year} onChange={set('year')} aria-label="Year">
          {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
        </select>
        <input placeholder="Batch (2023-2027)" value={form.batch} onChange={set('batch')} />
        <input placeholder="Roll number" value={form.rollNo} onChange={set('rollNo')} />
      </div>
      <input placeholder="GitHub username (links your commits)" value={form.githubUsername} onChange={set('githubUsername')} autoCapitalize="off" />
      <input placeholder="Skills (comma separated: react, node)" value={form.skills} onChange={set('skills')} />
      <p className="muted small">Your email and roll number are never shown publicly.</p>
      <button onClick={submit} disabled={!allValid || !form.name || !form.email}>Sign up</button>
      <p>Already registered? <Link to="/login">Login</Link></p>
    </div>
  );
}
