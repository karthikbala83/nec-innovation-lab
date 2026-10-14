// "Request intro" — recruiters only. Goes to the placement cell, never to the student.
import { useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { errorText } from '../components/ui.jsx';

const PURPOSES = ['interview', 'internship', 'job', 'pilot', 'mentoring', 'other'];

export default function RequestIntro({ student, project, label = 'Request intro' }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ purpose: 'interview', message: '' });
  const [state, setState] = useState(null);   // { ok, text }
  const [busy, setBusy] = useState(false);

  if (user?.role !== 'recruiter') return null;

  const send = async () => {
    setBusy(true);
    setState(null);
    try {
      await api.post('/intros', { student, project, ...form });
      setState({ ok: true, text: 'Sent to the NEC placement cell. Track it under My requests.' });
      setOpen(false);
    } catch (err) {
      setState({ ok: false, text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="request-intro">
      {!open && !state?.ok && <button className="small" onClick={() => setOpen(true)}>{label}</button>}
      {open && (
        <div className="offer-box">
          <p className="small muted">The placement cell reviews your request and connects you. Student contact details are never shared directly.</p>
          <select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} aria-label="Purpose">
            {PURPOSES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
          </select>
          <textarea rows={3} maxLength={1000} placeholder="Role, location, timeline, what caught your eye…" value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })} aria-label="Message to the placement cell" />
          <div className="actions">
            <button onClick={send} disabled={busy || !form.message.trim()}>{busy ? 'Sending…' : 'Send to placement cell'}</button>
            <button className="ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
      {state && <p className={`small ${state.ok ? 'info' : 'error'}`} role="status">{state.text}</p>}
    </div>
  );
}
