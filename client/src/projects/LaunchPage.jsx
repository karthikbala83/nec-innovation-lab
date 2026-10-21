// Public launch page: /p/:slug  (team / mentor / admin can also preview drafts)
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import {
  StageBadge, StatusBadge, PersonLink, Sparkline, Spinner,
  timeAgo, videoEmbed, errorText,
} from '../components/ui.jsx';
import MediaGallery from './MediaGallery.jsx';
import BackFollowBar from '../community/BackFollowBar.jsx';
import EngageBar from '../feedback/EngageBar.jsx';
import Backers from '../community/Backers.jsx';
import Comments from '../community/Comments.jsx';
import Timeline from '../updates/Timeline.jsx';
import PerformancePanel from '../score/PerformancePanel.jsx';
import LotusFlower, { LotusLine } from '../lotus/LotusFlower.jsx';
import RequestIntro from '../intros/RequestIntro.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function LaunchPage() {
  const { slug } = useParams();
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [backRefresh, setBackRefresh] = useState(0);
  const { user } = useAuth();
  const [params] = useSearchParams();
  const nav = useNavigate();

  useEffect(() => {
    setP(null);
    // ?src=qr: opened from the printed expo poster. Count it once, then drop it so a re-share doesn't count again.
    const src = params.get('src') === 'qr' ? 'qr' : undefined;
    api.get(`/projects/${slug}`, { params: { src } }).then((r) => setP(r.data)).catch((err) => setError(errorText(err, 'Project not found')));
    if (src) nav(`/p/${slug}`, { replace: true });
  }, [slug]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="card empty"><p>{error}</p><Link to="/">Back to all projects</Link></div>;
  if (!p) return <Spinner />;

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: p.title, text: p.tagline, url }); } catch { /* cancelled */ }
      return;
    }
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const playable = !!videoEmbed(p.videoUrl);
  const isHardware = p.category === 'hardware';
  const code = p.code;
  const commitsBy = new Map((code?.memberStats || []).map((s) => [String(s.user), s.commits]));
  const lotusBy = new Map((p.lotus || []).map((l) => [String(l.user), l]));
  const myLotus = user && lotusBy.get(String(user.id));

  return (
    <article className="launch">
      {p.status !== 'published' && (
        <div className={`banner status-${p.status}`}>
          <StatusBadge status={p.status} />{' '}
          {p.status === 'draft' && 'Only your team and mentor can see this page.'}
          {p.status === 'in_review' && 'Waiting for mentor approval. Not public yet.'}
          {p.status === 'archived' && 'Archived — hidden from the feed.'}
          {p.review?.note && <p><strong>Mentor's note:</strong> {p.review.note}</p>}
        </div>
      )}

      <header className="launch-hero">
        <MediaGallery project={p} />
        <div className="launch-head">
          <h1>{p.title}</h1>
          <p className="tagline big">{p.tagline}</p>
          <div className="chips">
            {p.isNewLaunch && <span className="chip new">New</span>}
            <StageBadge stage={p.stage} />
            <span className="chip">{p.category}</span>
            {p.department && <span className="chip">{p.department}{p.year ? ` · Year ${p.year}` : ''}</span>}
            {p.theme && <span className="chip soft">{p.theme}</span>}
          </div>
          <div className="actions">
            {p.liveUrl && <a className="btn" href={p.liveUrl} target="_blank" rel="noreferrer">Live demo ↗</a>}
            {p.repoUrl && <a className="btn ghost" href={p.repoUrl} target="_blank" rel="noreferrer">Code on GitHub ↗</a>}
            {p.videoUrl && !playable && <a className="btn ghost" href={p.videoUrl} target="_blank" rel="noreferrer">Demo video ↗</a>}
            <button className="ghost" onClick={share}>{copied ? 'Link copied' : 'Share'}</button>
            {p.viewer?.canEdit && <Link className="btn ghost" to={`/projects/${p._id}/edit`}>Edit</Link>}
            {p.status === 'published' && (p.viewer?.isTeam || p.viewer?.isMentor || p.viewer?.isAdmin) && (
              <Link className="btn ghost" to={`/p/${p.slug}/poster`}>🖨 Expo poster & QR</Link>
            )}
          </div>
          <p className="muted">
            {p.publishedAt ? `Launched ${timeAgo(p.publishedAt)}` : 'Not launched yet'} · 👁 {p.counts?.views || 0} views
            {p.counts?.qrScans > 0 && ` · ▣ ${p.counts.qrScans} QR scans`}
          </p>
          <BackFollowBar project={p} onCounts={() => setBackRefresh((n) => n + 1)} />
          <EngageBar project={p} />
          {p.status === 'published' && <RequestIntro project={p._id} label="Request intro to this team" />}
        </div>
      </header>

      {p.lookingFor?.length > 0 && (
        <section className="card looking-for">
          <h2>Looking for</h2>
          <ul>{p.lookingFor.map((ask) => <li key={ask}>🙋 {ask}</li>)}</ul>
          <p className="muted small">Can help? Leave a comment below or use Offer a pilot.</p>
        </section>
      )}

      {p.competitions?.length > 0 && (
        <div className="chips">
          {p.competitions.map((c, i) => (
            <span key={i} className={`chip comp ${c.stage === 'winner' && c.confirmed ? 'gold' : ''}`}>
              🏆 {c.name}{c.psId ? ` (${c.psId})` : ''} · {c.stage}{c.stage === 'winner' && !c.confirmed ? ' (awaiting confirmation)' : ''}
            </span>
          ))}
        </div>
      )}

      <div className="launch-grid">
        <div>
          {p.problem && <section className="card"><h2>The problem</h2><p className="prose">{p.problem}</p></section>}
          {p.solution && <section className="card"><h2>Our solution</h2><p className="prose">{p.solution}</p></section>}
          {p.impact && <section className="card"><h2>Impact so far</h2><p className="prose">{p.impact}</p></section>}
          {p.architectureImage && (
            <section className="card">
              <h2>{isHardware ? 'Circuit / block diagram' : 'Architecture'}</h2>
              <img className="full-img" src={p.architectureImage} alt={isHardware ? 'Circuit or block diagram' : 'Architecture diagram'} />
            </section>
          )}
          <Timeline project={p} />
          {p.status === 'published' && <Comments projectId={p._id} />}
        </div>

        <aside>
          {p.status === 'published' && <PerformancePanel project={p} />}
          <section className="card">
            <h2>Team</h2>
            <ul className="team">
              {p.members.map((m) => m.user && (
                <li key={m.user._id}>
                  <LotusFlower petals={lotusBy.get(String(m.user._id))?.petals} size={38} />
                  <div>
                    <PersonLink user={m.user} />
                    {m.user.verified && <span className="verified" title="College-verified student">✔</span>}
                    <div className="muted">
                      {m.role}
                      {commitsBy.has(String(m.user._id)) && ` · ${commitsBy.get(String(m.user._id))} commits`}
                    </div>
                    <LotusLine lotus={lotusBy.get(String(m.user._id))} />
                  </div>
                </li>
              ))}
            </ul>
            {p.mentor && (
              <p className="muted mentor-line">
                Mentor: <PersonLink user={p.mentor} />{p.mentor.profile?.department ? ` (${p.mentor.profile.department})` : ''}
                {p.status === 'published' && ' · approved for publishing'}
              </p>
            )}
            {p.viewer?.isTeam && user?.role === 'student' && p.repo?.importedAt && (
              <Link className="btn small lotus-cta" to={`/projects/${p._id}/lotus`}>
                {!myLotus || myLotus.status === 'not_started' ? '🪷 Take your Lotus check' : myLotus.status === 'scored' ? '🪷 See your Lotus results' : '🪷 Continue your Lotus check'}
              </Link>
            )}
            {(p.viewer?.isMentor || p.viewer?.isAdmin) && <Link className="btn ghost small" to={`/review/viva/${p._id}`}>Open viva mode</Link>}
          </section>

          {code ? <CodePanel code={code} /> : p.repoUrl && (
            <section className="card"><h2>Code</h2><p className="muted">Repo not imported yet.</p></section>
          )}
          {p.status === 'published' && <Backers projectId={p._id} refreshKey={backRefresh} />}
        </aside>
      </div>
      <DemoBar p={p} playable={playable} onShare={share} copied={copied} />
    </article>
  );
}

// Phones: the demo stays one thumb-tap away while reading the story
function DemoBar({ p, playable, onShare, copied }) {
  const show = !!(p.liveUrl || p.videoUrl);
  useEffect(() => {
    if (!show) return undefined;
    document.body.classList.add('has-demo-bar');
    return () => document.body.classList.remove('has-demo-bar');
  }, [show]);
  if (!show) return null;
  const watch = () => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return (
    <div className="demo-bar" role="region" aria-label="Demo">
      {p.videoUrl && (playable
        ? <button type="button" className="ghost small" onClick={watch}>▶ Watch</button>
        : <a className="btn ghost small" href={p.videoUrl} target="_blank" rel="noreferrer">▶ Watch</a>)}
      {p.liveUrl && <a className="btn small" href={p.liveUrl} target="_blank" rel="noreferrer">Try live demo ↗</a>}
      <button type="button" className="ghost small" onClick={onShare}>{copied ? 'Copied' : 'Share'}</button>
    </div>
  );
}

function CodePanel({ code }) {
  const langs = Object.entries(code.languages || {}).sort((a, b) => b[1] - a[1]);
  const totalBytes = langs.reduce((s, [, b]) => s + b, 0) || 1;
  const weekly = (code.weeklyCommits || []).map((w) => w.count);
  const lastCommit = code.commits?.[0]?.date;

  return (
    <section className="card code-panel">
      <h2>Code</h2>
      <p className="muted">Pulled by the college server from GitHub · {timeAgo(code.fetchedAt)}</p>

      {code.stack?.length > 0 && <div className="chips">{code.stack.map((s) => <span key={s} className="chip soft">{s}</span>)}</div>}

      {langs.length > 0 && (
        <>
          <div className="langbar" aria-hidden="true">
            {langs.slice(0, 5).map(([l, b], i) => <span key={l} className={`lang-${i}`} style={{ width: `${(b / totalBytes) * 100}%` }} />)}
          </div>
          <p className="muted small">
            {langs.slice(0, 5).map(([l, b]) => `${l} ${Math.round((b / totalBytes) * 100)}%`).join(' · ')}
          </p>
        </>
      )}

      <div className="row-between">
        <div>
          <div className="muted small">Commits per week (12 wks)</div>
          <Sparkline values={weekly} />
        </div>
        {lastCommit && <div className="muted small right">Last commit<br /><strong>{timeAgo(lastCommit)}</strong></div>}
      </div>
      {code.unmappedCommits > 0 && <p className="muted small">{code.unmappedCommits} commits by people not on the team list</p>}

      {code.secretWarnings?.length > 0 && <SecretWarnings warnings={code.secretWarnings} />}
      {code.duplicate && <DuplicateNotice dup={code.duplicate} />}
    </section>
  );
}

// Mentor/admin only: overlap with other college projects (spec §9). Not proof of copying.
export function DuplicateNotice({ dup }) {
  return (
    <div className={dup.flagged ? 'secret-box' : 'dup-box'} role="note">
      <strong>{dup.flagged ? '⚠ Possible copy — only mentors and admins see this' : 'Similar projects (mentor view)'}</strong>
      <ul>
        {dup.matches.map((m, i) => (
          <li key={i}>
            {m.overlap}% of distinctive files identical to{' '}
            {m.project ? <Link to={`/p/${m.project.slug}`}>{m.project.title}</Link> : 'another project'}
            {' '}({m.sharedFiles} files{m.otherRepoCreatedAt ? `, their repo created ${new Date(m.otherRepoCreatedAt).toLocaleDateString('en-IN')}` : ''})
            {m.samplePaths?.length > 0 && <div className="muted small">e.g. {m.samplePaths.slice(0, 3).join(', ')}</div>}
          </li>
        ))}
      </ul>
      <p className="small">Shared starter templates are already ignored. Ask the team before concluding anything.</p>
    </div>
  );
}

// Shown to the team, mentor and admin only (the API leaves it out for everyone else)
export function SecretWarnings({ warnings }) {
  return (
    <div className="secret-box" role="alert">
      <strong>⚠ Possible secrets committed — only your team and mentor see this</strong>
      <ul>
        {warnings.map((w, i) => (
          <li key={i}><code>{w.path}{w.line ? `:${w.line}` : ''}</code> — {w.type}{w.preview ? ` (${w.preview})` : ''}</li>
        ))}
      </ul>
      <p className="small">Rotate (replace) each key now, remove it from the code, and load it from <code>.env</code> instead. Deleting the file is not enough — it stays in Git history.</p>
    </div>
  );
}
