// Feedback / "build something like this" request for a project.
// Visitors: name + email + mobile, prove the email with a 6-digit code, then write.
// Signed-in classmates/faculty skip the code — their college account is enough.
// The server checks every message before the team (or their inbox) sees it.
import { useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { errorText } from '../components/ui.jsx';

const TOKEN_KEY = 'nec-visitor';   // { email, token, exp } in sessionStorage, so one code covers a few messages
const readToken = () => {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
    return t && t.exp > Date.now() ? t : null;
  } catch { return null; }
};

// Same idea as the server rule, so people fix it before sending
const hasContact = (s) => /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(s) || /(\+?\d[\d\s-]{8,}\d)/.test(s.replace(/\d{4}\s\d{4}\s\d{4}/g, ''));

export default function FeedbackPanel({ project, kind, onClose }) {
  const { user } = useAuth();
  const isRequest = kind === 'request';
  const saved = readToken();
  const [step, setStep] = useState(user || saved ? 'write' : 'contact');
  const [contact, setContact] = useState({ name: '', email: saved?.email || '', phone: '', relation: isRequest ? 'industry' : 'visitor', organisation: '' });
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [form, setForm] = useState({ message: '', rating: 0, timeline: '', budget: '', relation: 'classmate', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);   // { text, reasons }
  const [done, setDone] = useState(null);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (err) { setError({ text: errorText(err), reasons: err.response?.data?.reasons }); } finally { setBusy(false); }
  };

  const sendCode = () => run(async () => {
    const { data } = await api.post('/visitor/email-code', contact);
    setDevCode(data.devCode || '');
    setStep('code');
  });

  const verify = () => run(async () => {
    const { data } = await api.post('/visitor/verify', { email: contact.email, code });
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ email: contact.email.trim().toLowerCase(), token: data.token, exp: Date.now() + 110 * 60000 }));
    setStep('write');
  });

  const submit = () => run(async () => {
    const t = readToken();
    const body = {
      kind, message: form.message,
      rating: !isRequest && form.rating ? form.rating : undefined,
      timeline: isRequest ? form.timeline : undefined,
      budget: isRequest ? form.budget : undefined,
      ...(user
        ? { relation: form.relation, phone: form.phone || undefined }
        : { ...contact, email: t?.email || contact.email, visitorToken: t?.token }),
    };
    const { data } = await api.post(`/projects/${project._id}/feedback`, body);
    setDone(data);
  });

  const warn = form.message && hasContact(form.message);

  return (
    <section className="card feedback-panel" aria-labelledby="fb-title">
      <div className="row-between">
        <h2 id="fb-title">{isRequest ? 'Request a project like this' : `Feedback for ${project.title}`}</h2>
        <button className="ghost small" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {done ? (
        <div className={`fb-done ${done.status}`}>
          <p className="big-emoji" aria-hidden="true">{done.status === 'delivered' ? '🎉' : '🕵️'}</p>
          <p><strong>{done.message}</strong></p>
          {done.reasons && <p className="small muted">Why: {done.reasons.join(', ')}</p>}
          <button className="ghost" onClick={onClose}>Close</button>
        </div>
      ) : (
        <>
          <p className="muted small">
            {isRequest
              ? 'Need something similar for your college, company, farm or shop? The team gets your requirement and replies through the portal — your phone and email are never shown to students.'
              : 'Your feedback goes privately to the team. Be kind and specific — what worked, what to improve.'}
          </p>

          {step === 'contact' && (
            <div className="fb-step">
              <p className="step-label"><span>1</span> Who are you?</p>
              <div className="grid-2">
                <input placeholder="Your name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} autoComplete="name" aria-label="Your name" />
                <input type="tel" placeholder="Mobile (98765 43210)" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} autoComplete="tel" aria-label="Mobile number" />
                <input type="email" placeholder="Email (we send a code)" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} autoComplete="email" aria-label="Email" />
                <select value={contact.relation} onChange={(e) => setContact({ ...contact, relation: e.target.value })} aria-label="You are">
                  <option value="visitor">Visitor</option><option value="friend">Friend / family</option>
                  <option value="alumni">NEC alumni</option><option value="industry">Company / industry</option>
                </select>
              </div>
              {(isRequest || contact.relation === 'industry') && (
                <input placeholder="Organisation (company, college, farm…)" value={contact.organisation} onChange={(e) => setContact({ ...contact, organisation: e.target.value })} aria-label="Organisation" />
              )}
              <p className="muted small">Used only to verify you and to relay replies. Students never see your email or phone. Classmates: <a href="/login">sign in</a> to skip this.</p>
              <button onClick={sendCode} disabled={busy || !contact.name || !contact.email || !contact.phone}>{busy ? 'Sending…' : 'Email me a code'}</button>
            </div>
          )}

          {step === 'code' && (
            <div className="fb-step">
              <p className="step-label"><span>2</span> Enter the 6-digit code sent to {contact.email}</p>
              {devCode && <p className="banner status-in_review small">Development: email isn't configured, your code is <strong>{devCode}</strong></p>}
              <div className="inline-form">
                <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="Code" className="code-input" />
                <button onClick={verify} disabled={busy || code.length !== 6}>Verify</button>
              </div>
              <button className="link-like small" onClick={() => setStep('contact')}>Change details / resend</button>
            </div>
          )}

          {step === 'write' && (
            <div className="fb-step">
              <p className="step-label"><span>{user ? 1 : 3}</span> {isRequest ? 'Your requirement' : 'Your feedback'}</p>
              {user ? (
                <p className="small muted">Sending as <strong>{user.name}</strong>{user.role === 'student' && (
                  <> · <select className="inline-select" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} aria-label="Relation">
                    <option value="classmate">classmate</option><option value="friend">friend</option>
                  </select></>
                )}</p>
              ) : <p className="small muted">✔ Verified as {readToken()?.email}</p>}

              {!isRequest && (
                <div className="stars" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={form.rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
                      className={`star-btn ${form.rating >= n ? 'on' : ''}`} onClick={() => setForm({ ...form, rating: form.rating === n ? 0 : n })}>★</button>
                  ))}
                  <span className="muted small">optional</span>
                </div>
              )}
              <textarea rows={5} maxLength={2000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder={isRequest
                  ? 'What do you need? e.g. "A similar irrigation controller for 5 acres of turmeric, with SMS alerts in Tamil."'
                  : 'What did you like? What would you improve? Anything confusing?'}
                aria-label={isRequest ? 'Requirement' : 'Feedback'} />
              <div className="row-between small">
                <span className="muted">{form.message.length}/2000</span>
                {warn && <span className="error">Remove phone numbers / emails — the portal passes your contact safely.</span>}
              </div>
              {isRequest && (
                <div className="grid-2">
                  <input placeholder="Timeline (e.g. 2 months)" value={form.timeline} maxLength={60} onChange={(e) => setForm({ ...form, timeline: e.target.value })} aria-label="Timeline" />
                  <input placeholder="Budget (optional)" value={form.budget} maxLength={60} onChange={(e) => setForm({ ...form, budget: e.target.value })} aria-label="Budget" />
                </div>
              )}
              <button onClick={submit} disabled={busy || form.message.trim().length < 15}>
                {busy ? 'Checking…' : isRequest ? 'Send request to the team' : 'Send feedback'}
              </button>
            </div>
          )}
          {error && (
            <div className="error fb-error" role="alert">
              {error.text}
              {error.reasons?.length > 1 && <ul>{error.reasons.slice(1).map((r) => <li key={r}>{r}</li>)}</ul>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
