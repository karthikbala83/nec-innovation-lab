// ---------------------------------------------------------------
// Launch wizard: /projects/new and /projects/:id/edit?step=N
// Each "Save & next" saves to the server, so a half-finished
// project is never lost. Step 1 creates the draft.
// ---------------------------------------------------------------
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { StatusBadge, Spinner, Avatar, errorText, timeAgo } from '../components/ui.jsx';
import { SecretWarnings } from './LaunchPage.jsx';
import ImageUpload from '../components/ImageUpload.jsx';

const STEPS = ['Basics', 'Story', 'Proof & media', 'Team', 'Code', 'Submit'];
const DEPARTMENTS = ['CSE', 'IT', 'AI&DS', 'ECE', 'EEE', 'MECH', 'CIVIL', 'BME', 'Other'];

const EMPTY = {
  title: '', tagline: '', category: 'software', department: '', year: '', theme: '', stage: 'idea',
  problem: '', solution: '', impact: '',
  repoUrl: '', liveUrl: '', videoUrl: '', thumbnail: '', architectureImage: '', screenshots: [],
  members: [], mentor: '', competitions: [], lookingFor: [],
};

// Server project -> form state
const toForm = (p) => ({
  ...EMPTY,
  ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, p[k] ?? EMPTY[k]])),
  mentor: p.mentor?._id || p.mentor || '',
  members: (p.members || []).filter((m) => m.user).map((m) => ({ user: m.user, role: m.role, githubUsername: m.githubUsername || '' })),
  competitions: (p.competitions || []).map(({ name, psId = '', stage }) => ({ name, psId, stage })),
});

// Which fields each step sends
const STEP_FIELDS = [
  ['title', 'tagline', 'category', 'department', 'year', 'theme', 'stage'],
  ['problem', 'solution', 'impact', 'lookingFor'],
  ['repoUrl', 'liveUrl', 'videoUrl', 'thumbnail', 'architectureImage', 'screenshots'],
  ['members', 'mentor', 'competitions'],
];

export default function ProjectWizard() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const step = Math.min(Math.max(Number(params.get('step')) || 1, 1), STEPS.length);

  const [form, setForm] = useState(EMPTY);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/projects/${id}`)
      .then(({ data }) => { setProject(data); setForm(toForm(data)); })
      .catch((err) => setError(errorText(err, 'Could not load project')))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const goto = (n) => { setError(''); setParams({ step: String(n) }); window.scrollTo(0, 0); };

  const payloadFor = (n) => {
    const body = Object.fromEntries(STEP_FIELDS[n - 1].map((k) => [k, form[k]]));
    if (body.members) body.members = form.members.map((m) => ({ user: m.user._id, role: m.role, githubUsername: m.githubUsername.trim() }));
    if (body.competitions) body.competitions = form.competitions.filter((c) => c.name.trim());
    if (body.year === '') body.year = null;
    if (body.lookingFor) body.lookingFor = form.lookingFor.map((a) => a.trim()).filter(Boolean);
    return body;
  };

  const saveAndNext = async () => {
    setError('');
    setSaving(true);
    try {
      if (!id) {
        const { data } = await api.post('/projects', payloadFor(1));
        nav(`/projects/${data._id}/edit?step=2`, { replace: true });
        return;
      }
      if (step <= STEP_FIELDS.length) {
        await api.put(`/projects/${id}`, payloadFor(step));
        const { data } = await api.get(`/projects/${id}`);   // re-read: team and mentor come back populated
        setProject(data);
      }
      goto(step + 1);
    } catch (err) {
      setError(errorText(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;
  if (id && !project) return <p className="error">{error}</p>;

  const isOwner = !id || String(project?.owner) === String(user?.id) || user?.role === 'admin';
  const locked = project?.status === 'archived';

  return (
    <div className="wizard">
      <div className="row-between">
        <h2>{id ? form.title || 'Edit project' : 'Launch a project'}</h2>
        {project && <StatusBadge status={project.status} />}
      </div>

      <ol className="stepper">
        {STEPS.map((s, i) => (
          <li key={s} className={i + 1 === step ? 'active' : i + 1 < step ? 'done' : ''}>
            <button type="button" className="link-like" disabled={!id} onClick={() => goto(i + 1)}>
              <span className="num">{i + 1}</span><span className="label">{s}</span>
            </button>
          </li>
        ))}
      </ol>

      {project?.review?.note && project.status === 'draft' && (
        <div className="banner status-draft"><strong>Mentor's note:</strong> {project.review.note}</div>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      <div className="card">
        {step === 1 && <Basics form={form} set={set} />}
        {step === 2 && <Story form={form} set={set} setForm={setForm} />}
        {step === 3 && <Proof form={form} setForm={setForm} set={set} projectId={id} />}
        {step === 4 && <Team form={form} setForm={setForm} isOwner={isOwner} ownerId={project?.owner || user?.id} />}
        {step === 5 && <CodeStep project={project} repoUrl={form.repoUrl} />}
        {step === 6 && <SubmitStep project={project} onChange={setProject} />}
      </div>

      <div className="wizard-nav">
        {step > 1 && <button className="ghost" onClick={() => goto(step - 1)}>Back</button>}
        {step < STEPS.length && (
          <button onClick={saveAndNext} disabled={saving || locked || (step === 1 && !form.title.trim())}>
            {saving ? 'Saving…' : step <= STEP_FIELDS.length ? 'Save & next' : 'Next'}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- steps ----------

const Counter = ({ value, max }) => (
  <span className={`counter ${value.length > max ? 'over' : ''}`}>{value.length}/{max}</span>
);

function Field({ label, hint, children, counter }) {
  return (
    <label className="field">
      <span className="field-label">{label}{counter}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

function Basics({ form, set }) {
  return (
    <>
      <Field label="Project title *"><input value={form.title} onChange={set('title')} maxLength={80} placeholder="CampusBus Live" /></Field>
      <Field label="Tagline *" counter={<Counter value={form.tagline} max={140} />} hint="One line a stranger understands. What does it do, for whom?">
        <input value={form.tagline} onChange={set('tagline')} placeholder="Know where your college bus is — live, with ETA to your stop." />
      </Field>
      <div className="grid-2">
        <Field label="Category">
          <select value={form.category} onChange={set('category')}>
            <option value="software">Software</option><option value="hardware">Hardware</option><option value="research">Research</option>
          </select>
        </Field>
        <Field label="Stage" hint="Pilot, incubation and startup are set by the admin">
          <select value={form.stage} onChange={set('stage')}>
            <option value="idea">Idea</option><option value="prototype">Prototype</option><option value="live">Live</option>
            {!['idea', 'prototype', 'live'].includes(form.stage) && <option value={form.stage}>{form.stage}</option>}
          </select>
        </Field>
        <Field label="Department">
          <select value={form.department} onChange={set('department')}>
            <option value="">Choose…</option>
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Year">
          <select value={form.year ?? ''} onChange={set('year')}>
            <option value="">Choose…</option>
            {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Theme" hint="e.g. Agri-tech, Health, Smart campus, FinTech"><input value={form.theme} onChange={set('theme')} maxLength={60} /></Field>
    </>
  );
}

function Story({ form, set, setForm }) {
  const asks = [0, 1, 2].map((i) => form.lookingFor[i] || '');
  const setAsk = (i, v) => { const next = [...asks]; next[i] = v; setForm({ ...form, lookingFor: next }); };
  return (
    <>
      <Field label="The problem *" counter={<Counter value={form.problem} max={1500} />} hint="Who has this problem, and what does it cost them today?">
        <textarea rows={5} value={form.problem} onChange={set('problem')} />
      </Field>
      <Field label="Your solution *" counter={<Counter value={form.solution} max={2500} />} hint="How it works, in plain words. Mention the key tech.">
        <textarea rows={7} value={form.solution} onChange={set('solution')} />
      </Field>
      <Field label="Impact so far" counter={<Counter value={form.impact} max={800} />} hint="Numbers beat adjectives: users, time saved, accuracy, trial results.">
        <textarea rows={3} value={form.impact} onChange={set('impact')} />
      </Field>
      <h3>Looking for (up to 3)</h3>
      <p className="hint">What would move you forward? Shown on your page.</p>
      {asks.map((a, i) => (
        <input key={i} value={a} maxLength={120} onChange={(e) => setAsk(i, e.target.value)} aria-label={`Ask ${i + 1}`}
          placeholder={['A teammate with React skills', '20 farmers to pilot for 2 weeks', 'A mentor in agri-tech'][i]} />
      ))}
    </>
  );
}

function Proof({ form, setForm, set, projectId }) {
  const shots = form.screenshots.join('\n');
  return (
    <>
      <Field label="GitHub repo (public)" hint="https://github.com/owner/repo — you'll import it in step 5">
        <input value={form.repoUrl} onChange={set('repoUrl')} placeholder="https://github.com/your-team/your-repo" inputMode="url" />
      </Field>
      <Field label="Live demo URL"><input value={form.liveUrl} onChange={set('liveUrl')} placeholder="https://…" inputMode="url" /></Field>
      <Field label="Demo video" hint="YouTube (unlisted is fine) — it plays on your page">
        <input value={form.videoUrl} onChange={set('videoUrl')} placeholder="https://youtu.be/…" inputMode="url" />
      </Field>
      <Field label="Thumbnail image" hint="Upload, or paste a link. Without one we generate a cover from your title. 16:9 looks best.">
        <input value={form.thumbnail} onChange={set('thumbnail')} inputMode="url" placeholder="https://…" />
      </Field>
      <ImageUpload projectId={projectId} kind="thumbnail" label="Upload thumbnail"
        onUploaded={(url) => setForm((f) => ({ ...f, thumbnail: url }))} />
      <Field label="Architecture diagram"><input value={form.architectureImage} onChange={set('architectureImage')} inputMode="url" placeholder="https://…" /></Field>
      <ImageUpload projectId={projectId} kind="architecture" label="Upload diagram"
        onUploaded={(url) => setForm((f) => ({ ...f, architectureImage: url }))} />
      {form.screenshots.length < 8 && (
        <ImageUpload projectId={projectId} kind="screenshot" label="Upload screenshot"
          onUploaded={(url) => setForm((f) => ({ ...f, screenshots: [...f.screenshots, url].slice(0, 8) }))} />
      )}
      <Field label="Screenshot links" hint="One per line, up to 8. Uploaded screenshots appear here.">
        <textarea rows={3} value={shots}
          onChange={(e) => setForm({ ...form, screenshots: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 8) })} />
      </Field>
    </>
  );
}

function Team({ form, setForm, isOwner, ownerId }) {
  const [mentors, setMentors] = useState([]);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { api.get('/users/mentors').then((r) => setMentors(r.data)).catch(() => {}); }, []);

  const add = async () => {
    setMsg('');
    try {
      const { data } = await api.get('/users/lookup', { params: { email } });
      if (form.members.some((m) => m.user._id === data._id)) return setMsg('Already on the team');
      if (form.members.length >= 6) return setMsg('A team has at most 6 members');
      setForm({ ...form, members: [...form.members, { user: data, role: 'Developer', githubUsername: data.githubUsername || '' }] });
      setEmail('');
    } catch (err) {
      setMsg(errorText(err, 'Not found'));
    }
  };
  const update = (i, key, value) => setForm({ ...form, members: form.members.map((m, j) => (j === i ? { ...m, [key]: value } : m)) });
  const remove = (i) => setForm({ ...form, members: form.members.filter((_, j) => j !== i) });

  const setComp = (i, key, value) => setForm({ ...form, competitions: form.competitions.map((c, j) => (j === i ? { ...c, [key]: value } : c)) });

  return (
    <>
      <h3>Team ({form.members.length}/6)</h3>
      <p className="hint">GitHub usernames link each member to their commits.</p>
      <ul className="member-edit">
        {form.members.map((m, i) => (
          <li key={m.user._id}>
            <Avatar name={m.user.name} />
            <div className="member-fields">
              <strong>{m.user.name}{String(m.user._id) === String(ownerId) && <span className="muted"> · owner</span>}</strong>
              <div className="grid-2">
                <input aria-label="Role" placeholder="Role (e.g. Frontend)" value={m.role} onChange={(e) => update(i, 'role', e.target.value)} disabled={!isOwner} />
                <input aria-label="GitHub username" placeholder="GitHub username" value={m.githubUsername} onChange={(e) => update(i, 'githubUsername', e.target.value)} disabled={!isOwner} />
              </div>
            </div>
            {isOwner && String(m.user._id) !== String(ownerId) && (
              <button type="button" className="ghost small" onClick={() => remove(i)} aria-label={`Remove ${m.user.name}`}>✕</button>
            )}
          </li>
        ))}
      </ul>
      {isOwner ? (
        <div className="inline-form">
          <input type="email" placeholder="Teammate's college email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="button" onClick={add} disabled={!email}>Add</button>
        </div>
      ) : <p className="hint">Only the project owner can change the team.</p>}
      {msg && <p className="error">{msg}</p>}

      <h3>Faculty mentor *</h3>
      <Field label="Mentor" hint="Your mentor approves the page before it goes public.">
        <select value={form.mentor} onChange={(e) => setForm({ ...form, mentor: e.target.value })}>
          <option value="">Choose your mentor…</option>
          {mentors.map((f) => <option key={f._id} value={f._id}>{f.name}{f.profile?.department ? ` (${f.profile.department})` : ''}</option>)}
        </select>
      </Field>

      <h3>Competitions</h3>
      {form.competitions.map((c, i) => (
        <div key={i} className="comp-row">
          <input placeholder="SIH 2026" value={c.name} onChange={(e) => setComp(i, 'name', e.target.value)} aria-label="Competition" />
          <input placeholder="PS ID" value={c.psId} onChange={(e) => setComp(i, 'psId', e.target.value)} aria-label="Problem statement ID" />
          <select value={c.stage} onChange={(e) => setComp(i, 'stage', e.target.value)} aria-label="Stage reached">
            {['registered', 'shortlisted', 'finalist', 'winner'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <button type="button" className="ghost small" onClick={() => setForm({ ...form, competitions: form.competitions.filter((_, j) => j !== i) })} aria-label="Remove competition">✕</button>
        </div>
      ))}
      {form.competitions.length < 5 && (
        <button type="button" className="ghost" onClick={() => setForm({ ...form, competitions: [...form.competitions, { name: '', psId: '', stage: 'registered' }] })}>
          + Add competition
        </button>
      )}
      <p className="hint">"Winner" shows as awaiting confirmation until the admin confirms it.</p>
    </>
  );
}

function CodeStep({ project, repoUrl }) {
  const [snap, setSnap] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cached, setCached] = useState(null);

  useEffect(() => {
    api.get(`/projects/${project._id}/snapshot`).then((r) => setSnap(r.data.snapshot)).catch(() => {});
  }, [project._id]);

  const run = async (force) => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/projects/${project._id}/import`, null, { params: force ? { force: 1 } : {}, timeout: 90000 });
      setSnap(data.snapshot);
      setCached(data.cached);
    } catch (err) {
      setError(errorText(err, 'Import failed'));
    } finally {
      setBusy(false);
    }
  };

  if (!repoUrl) return <p>No GitHub repo yet. Go back to <strong>Proof & media</strong> to add one — or skip this step if your project has no code (hardware/research).</p>;

  const names = new Map((project.members || []).filter((m) => m.user).map((m) => [String(m.user._id), m.user.name]));

  return (
    <>
      <p>We read <a href={repoUrl} target="_blank" rel="noreferrer">{repoUrl.replace('https://github.com/', '')}</a> from GitHub: stack, who committed what, and a check for leaked keys. Read-only.</p>
      <div className="actions">
        <button onClick={() => run(false)} disabled={busy}>{busy ? 'Importing… (up to 30 s)' : snap ? 'Refresh import' : 'Import from GitHub'}</button>
        {snap && <button className="ghost" onClick={() => run(true)} disabled={busy}>Force re-import</button>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {snap && (
        <div className="import-result">
          <p className="muted">
            {cached ? 'Cached result' : 'Imported'} · commit <code>{snap.sha?.slice(0, 7)}</code> on {snap.defaultBranch} · {timeAgo(snap.fetchedAt)}
            {snap.durationMs ? ` · ${(snap.durationMs / 1000).toFixed(1)} s` : ''}
          </p>
          <div className="chips">{(snap.stack || []).map((s) => <span key={s} className="chip soft">{s}</span>)}</div>
          <p className="small">
            {snap.files} files kept · {snap.skipped?.count || 0} skipped (dependencies, builds, lockfiles, binaries) · {snap.totalCommits} commits read
          </p>
          {snap.scan && !snap.scan.complete && <p className="small error">{snap.scan.note}</p>}

          <h3>Commits per member</h3>
          <table>
            <thead><tr><th>Member</th><th>Commits</th><th>Last</th></tr></thead>
            <tbody>
              {(snap.memberStats || []).map((s) => (
                <tr key={String(s.user)}><td>{names.get(String(s.user)) || s.githubUsername}</td><td>{s.commits}</td><td>{timeAgo(s.lastCommitAt)}</td></tr>
              ))}
              {snap.unmappedCommits > 0 && <tr><td className="muted">Not matched to a member</td><td>{snap.unmappedCommits}</td><td /></tr>}
            </tbody>
          </table>
          {snap.unmappedCommits > 0 && <p className="hint">Unmatched commits? Check each member's GitHub username in the Team step.</p>}

          {snap.secretWarnings?.length > 0
            ? <SecretWarnings warnings={snap.secretWarnings} />
            : <p className="ok-line">✓ No committed secrets found</p>}
        </div>
      )}
    </>
  );
}

function SubmitStep({ project, onChange }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const checks = [
    ['Tagline', !!project.tagline],
    ['Problem', !!project.problem],
    ['Solution', !!project.solution],
    ['Repo, live or video link', !!(project.repoUrl || project.liveUrl || project.videoUrl)],
    ['Faculty mentor', !!project.mentor],
    ['Repo imported (recommended)', !project.repoUrl || !!project.repo?.importedAt],
  ];

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/projects/${project._id}/submit`);
      onChange((p) => ({ ...p, status: data.status, review: data.review }));
    } catch (err) {
      setError(errorText(err, 'Could not submit'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ul className="checklist">
        {checks.map(([label, ok]) => <li key={label} className={ok ? 'rule ok' : 'rule bad'}>{ok ? '✓' : '○'} {label}</li>)}
      </ul>
      {project.status === 'draft' && (
        <>
          <p>When you submit, your mentor gets it in their approval queue. Nothing is public until they approve.</p>
          <button onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit for mentor review'}</button>
        </>
      )}
      {project.status === 'in_review' && <p className="info">Submitted. Waiting for your mentor to approve.</p>}
      {project.status === 'published' && <p className="info">Live! Edits you save show up on the public page straight away.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <p><Link to={`/p/${project.slug}`}>Preview the launch page →</Link></p>
    </>
  );
}
