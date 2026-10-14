// Like (anyone, no account), feedback, "request a project like this",
// and — for the team — "share for feedback" (copy link / WhatsApp).
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { errorText } from '../components/ui.jsx';
import FeedbackPanel from './FeedbackPanel.jsx';

export default function EngageBar({ project }) {
  const [params, setParams] = useSearchParams();
  const [liked, setLiked] = useState(!!project.viewer?.liked);
  const [likes, setLikes] = useState(project.counts?.likes || 0);
  const [beat, setBeat] = useState(false);
  const [panel, setPanel] = useState(null);   // 'feedback' | 'request' | null
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');
  const isTeam = project.viewer?.isTeam;
  const summary = project.feedbackSummary;

  // Shared links open the right form straight away: /p/slug?feedback=1 or ?request=1
  useEffect(() => {
    if (isTeam) return;
    if (params.get('feedback')) setPanel('feedback');
    else if (params.get('request')) setPanel('request');
  }, [params, isTeam]);

  const close = () => {
    setPanel(null);
    if (params.get('feedback') || params.get('request')) setParams({}, { replace: true });
  };

  const like = async () => {
    setError('');
    try {
      const { data } = await api.post(`/projects/${project._id}/like`);
      setLiked(data.liked);
      setLikes(data.likes);
      if (data.liked) { setBeat(true); setTimeout(() => setBeat(false), 600); }
    } catch (err) {
      setError(errorText(err));
    }
  };

  const link = (q) => `${window.location.origin}/p/${project.slug}${q ? `?${q}=1` : ''}`;
  const copy = async (q) => {
    await navigator.clipboard?.writeText(link(q));
    setCopied(q);
    setTimeout(() => setCopied(''), 2000);
  };
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Check out our project "${project.title}" on NEC Innovation Lab — like it and tell us what you think: ${link('feedback')}`)}`;

  if (project.status !== 'published') return null;

  return (
    <div className="engage">
      <div className="engage-row">
        <button className={`like-btn ${liked ? 'on' : ''} ${beat ? 'beat' : ''}`} onClick={like} aria-pressed={liked}
          aria-label={`${liked ? 'Unlike' : 'Like'} — ${likes} likes`}>
          <span className="heart" aria-hidden="true">{liked ? '♥' : '♡'}</span> {likes}
        </button>
        {!isTeam && <button className="ghost" onClick={() => setPanel('feedback')}>💬 Give feedback</button>}
        {!isTeam && <button className="ghost" onClick={() => setPanel('request')}>🛠 Need one like this?</button>}
        {summary?.count > 0 && (
          <span className="chip fb-chip" title="Feedback the team received">
            {summary.avgRating ? `★ ${summary.avgRating} · ` : ''}{summary.count} feedback
          </span>
        )}
      </div>
      {error && <p className="small error">{error}</p>}

      {isTeam && (
        <div className="share-box">
          <strong>Share for likes &amp; feedback</strong>
          <p className="small muted">Anyone with the link can like your project and send feedback — no account needed. Messages are checked before they reach you.</p>
          <div className="actions">
            <a className="btn small whatsapp" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
            <button className="ghost small" onClick={() => copy('feedback')}>{copied === 'feedback' ? 'Copied!' : 'Copy feedback link'}</button>
            <button className="ghost small" onClick={() => copy('request')}>{copied === 'request' ? 'Copied!' : 'Copy “request” link'}</button>
          </div>
        </div>
      )}

      {panel && <FeedbackPanel key={panel} project={project} kind={panel} onClose={close} />}
    </div>
  );
}
