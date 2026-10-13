// Public launch page: /p/:slug  (team / mentor / admin can also preview drafts)
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import {
  StageBadge, StatusBadge, Avatar, Thumb, PersonLink, Sparkline, Spinner,
  timeAgo, youTubeId, errorText,
} from '../components/ui.jsx';
import BackFollowBar from '../community/BackFollowBar.jsx';
import Backers from '../community/Backers.jsx';
import Comments from '../community/Comments.jsx';
import Timeline from '../updates/Timeline.jsx';
import PerformancePanel from '../score/PerformancePanel.jsx';

export default function LaunchPage() {
  const { slug } = useParams();
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [backRefresh, setBackRefresh] = useState(0);

  useEffect(() => {
    setP(null);
    api.get(`/projects/${slug}`).then((r) => setP(r.data)).catch((err) => setError(errorText(err, 'Project not found')));
  }, [slug]);

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

  const yt = youTubeId(p.videoUrl);
  const code = p.code;
  const commitsBy = new Map((code?.memberStats || []).map((s) => [String(s.user), s.commits]));

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
        {yt ? (
          <div className="video">
            <iframe src={`https://www.youtube-nocookie.com/embed/${yt}`} title={`${p.title} demo video`}
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
          </div>
        ) : (
          <Thumb project={p} className="hero-thumb" />
        )}
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
            {p.videoUrl && !yt && <a className="btn ghost" href={p.videoUrl} target="_blank" rel="noreferrer">Demo video ↗</a>}
            <button className="ghost" onClick={share}>{copied ? 'Link copied' : 'Share'}</button>
            {p.viewer?.canEdit && <Link className="btn ghost" to={`/projects/${p._id}/edit`}>Edit</Link>}
          </div>
          <p className="muted">
            {p.publishedAt ? `Launched ${timeAgo(p.publishedAt)}` : 'Not launched yet'} · 👁 {p.counts?.views || 0} views
          </p>
          <BackFollowBar project={p} onCounts={() => setBackRefresh((n) => n + 1)} />
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
            <section className="card"><h2>Architecture</h2><img className="full-img" src={p.architectureImage} alt="Architecture diagram" /></section>
          )}
          {p.screenshots?.length > 0 && (
            <section className="card">
              <h2>Screenshots</h2>
              <div className="shots">
                {p.screenshots.map((s) => <a key={s} href={s} target="_blank" rel="noreferrer"><img src={s} alt="" loading="lazy" /></a>)}
              </div>
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
                  <Avatar name={m.user.name} />
                  <div>
                    <PersonLink user={m.user} />
                    {m.user.verified && <span className="verified" title="College-verified student">✔</span>}
                    <div className="muted">
                      {m.role}
                      {commitsBy.has(String(m.user._id)) && ` · ${commitsBy.get(String(m.user._id))} commits`}
                    </div>
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
          </section>

          {code ? <CodePanel code={code} /> : p.repoUrl && (
            <section className="card"><h2>Code</h2><p className="muted">Repo not imported yet.</p></section>
          )}
          {p.status === 'published' && <Backers projectId={p._id} refreshKey={backRefresh} />}
        </aside>
      </div>
    </article>
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
    </section>
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
