import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/axios';
import GoogleButton, { googleEnabled } from '../components/GoogleButton.jsx';

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

const COLLEGE_DOMAIN = String(import.meta.env.VITE_COLLEGE_DOMAIN || '').split(',')[0].trim();   // first domain for the hint
const DEPARTMENTS = ['CSE', 'IT', 'AI&DS', 'ECE', 'EEE', 'MECH', 'CIVIL', 'BME', 'Other'];

export default function Signup() {
  const { signup, googleLogin } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '', skills: '',
    department: 'CSE', year: '1', batch: '', rollNo: '', githubUsername: '',
  });
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [codeState, setCodeState] = useState(null);   // { sent, devCode }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onGoogle = async (credential) => {
    setError('');
    try {
      const u = await googleLogin(credential);
      nav(u.needsProfile ? '/settings?welcome=1' : '/me/projects');
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-in failed');
    }
  };

  // Prove the college email is yours: a 6-digit code goes to that inbox
  const sendCode = async () => {
    setError('');
    try {
      const { data } = await api.post('/auth/signup-code', { email: form.email });
      setCodeState({ sent: true, devCode: data.devCode });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send the code');
    }
  };

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
        code,
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
      {error && <p className="error">{error}</p>}
      {googleEnabled && (
        <>
          <p className="muted">Fastest: use your college Google account — no password to remember.</p>
          <GoogleButton onCredential={onGoogle} text="signup_with" />
          <p className="or-divider"><span>or sign up with email</span></p>
        </>
      )}
      <p className="muted">Sign up with your college email{COLLEGE_DOMAIN ? ` (@${COLLEGE_DOMAIN})` : ''} — we email you a code to confirm it's yours.</p>
      <input placeholder="Full name" value={form.name} onChange={set('name')} autoComplete="name" />
      <div className="inline-form">
        <input type="email" placeholder={COLLEGE_DOMAIN ? `you@${COLLEGE_DOMAIN}` : 'College email'} value={form.email}
               onChange={(e) => { set('email')(e); setCodeState(null); }} autoComplete="email" />
        <button type="button" className="ghost small" onClick={sendCode} disabled={!form.email}>{codeState ? 'Resend' : 'Send code'}</button>
      </div>
      {codeState && (
        <>
          <p className="small info">Code sent to {form.email} — check spam too.</p>
          {codeState.devCode && <p className="banner status-in_review small">Development: email isn't configured, your code is <strong>{codeState.devCode}</strong></p>}
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={code}
                 onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="Code from your email" className="code-input" />
        </>
      )}
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
      <button onClick={submit} disabled={!allValid || !form.name || !form.email || code.length !== 6}>Sign up</button>
      <p>Already registered? <Link to="/login">Login</Link></p>
    </div>
  );
}
