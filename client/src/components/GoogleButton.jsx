// "Continue with Google" via Google Identity Services. Google gives us an ID token;
// the API verifies it and only accepts the college Google Workspace (see the server).
// Hidden when VITE_GOOGLE_CLIENT_ID isn't set.
import { useEffect, useRef, useState } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
// May list several domains: "nandhaengg.org,saravonix.com"
export const COLLEGE_DOMAINS = String(import.meta.env.VITE_COLLEGE_DOMAIN || '').split(',').map((d) => d.trim()).filter(Boolean);
let scriptPromise;
const loadGsi = () => (scriptPromise ||= new Promise((resolve, reject) => {
  if (window.google?.accounts?.id) return resolve();
  const s = Object.assign(document.createElement('script'), { src: 'https://accounts.google.com/gsi/client', async: true, defer: true });
  s.onload = resolve;
  s.onerror = () => { scriptPromise = null; reject(new Error('Could not load Google sign-in')); };
  document.head.appendChild(s);
}));

export const googleEnabled = !!CLIENT_ID;

export default function GoogleButton({ onCredential, text = 'continue_with' }) {
  const box = useRef(null);
  const [error, setError] = useState('');
  const cb = useRef(onCredential);   // latest callback without re-rendering Google's button
  cb.current = onCredential;

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;
    loadGsi().then(() => {
      if (cancelled || !box.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (r) => cb.current(r.credential),
        hd: COLLEGE_DOMAINS.length === 1 ? COLLEGE_DOMAINS[0] : undefined,   // account-chooser hint only; the server enforces the rule
        ux_mode: 'popup',
        auto_select: false,
      });
      window.google.accounts.id.renderButton(box.current, {
        theme: 'outline', size: 'large', shape: 'pill', text, logo_alignment: 'left',
        width: Math.min(360, box.current.offsetWidth || 320),
      });
    }).catch((e) => setError(e.message));
    return () => { cancelled = true; };
  }, [text]);

  if (!CLIENT_ID) return null;
  return (
    <div className="google-signin">
      <div ref={box} className="google-btn" />
      {COLLEGE_DOMAINS.length > 0 && <p className="muted small">Use your <strong>{COLLEGE_DOMAINS.map((d) => `@${d}`).join(' or ')}</strong> Google account</p>}
      {error && <p className="error small">{error}</p>}
    </div>
  );
}
