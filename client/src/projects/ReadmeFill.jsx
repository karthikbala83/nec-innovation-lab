// "Fill from GitHub": reads a public repo's description + README and fills the EMPTY wizard
// fields (title, tagline, story, demo links, screenshots). Nothing is saved until "Save & next".
import { useState } from 'react';
import api from '../api/axios';
import { errorText } from '../components/ui.jsx';

const TEXT_KEYS = ['repoUrl', 'title', 'tagline', 'problem', 'solution', 'impact', 'liveUrl', 'videoUrl'];
const LABELS = {
  repoUrl: 'repo link', title: 'title', tagline: 'tagline', problem: 'problem', solution: 'solution', impact: 'impact',
  liveUrl: 'live demo link', videoUrl: 'demo video', screenshots: 'screenshots', category: 'category (hardware)',
};

// Returns the keys it filled
export const mergeDraft = (form, draft) => {
  const next = { ...form };
  const filled = [];
  for (const k of TEXT_KEYS) {
    if (draft[k] && !String(form[k] || '').trim()) { next[k] = draft[k]; filled.push(k); }
  }
  if (draft.screenshots?.length && !form.screenshots.length) { next.screenshots = draft.screenshots.slice(0, 8); filled.push('screenshots'); }
  if (draft.category && form.category === 'software' && draft.category !== 'software') { next.category = draft.category; filled.push('category'); }
  return { next, filled };
};

export default function ReadmeFill({ form, setForm, onFilled, compact = false }) {
  const [url, setUrl] = useState(form.repoUrl || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { data } = await api.post('/projects/readme-draft', { repoUrl: (compact ? form.repoUrl : url).trim() }, { timeout: 30000 });
      const { filled } = mergeDraft(form, data);       // for the message
      setForm((f) => mergeDraft(f, data).next);        // latest form: keeps anything typed while we waited
      onFilled?.(filled);
      setMsg(filled.length
        ? { ok: true, text: `Filled ${filled.map((k) => LABELS[k]).join(', ')}${data.hasReadme ? ' from your README' : ''}. Read through each step and fix anything before submitting.` }
        : { ok: true, text: data.hasReadme ? 'Nothing new to fill — those fields already have text.' : 'This repo has no README, so there was little to fill. Add a README.md to your repo — it helps everyone.' });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, 'Could not read that repo') });
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <div className="readme-fill compact">
        <button type="button" className="ghost small" onClick={run} disabled={busy}>{busy ? 'Reading README…' : '✨ Fill empty fields from my README'}</button>
        {msg && <p className={msg.ok ? 'ok-line small' : 'error small'} role="status">{msg.text}</p>}
      </div>
    );
  }

  return (
    <div className="readme-fill">
      <strong>Have a GitHub repo? Start from it ✨</strong>
      <p className="hint">We read the repo's description and README to fill in the title, tagline, story, demo video and screenshots. Public repos only. You can edit everything.</p>
      <div className="inline-form">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/your-team/your-repo" inputMode="url" aria-label="GitHub repo link" />
        <button type="button" onClick={run} disabled={busy || !url.trim()}>{busy ? 'Reading…' : 'Fill from GitHub'}</button>
      </div>
      {msg && <p className={msg.ok ? 'ok-line small' : 'error small'} role="status">{msg.text}</p>}
    </div>
  );
}
