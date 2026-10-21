// /p/:slug/poster — printable expo material for a published project:
// an A4 stall poster, or 4 QR table cards per A4 sheet to cut out.
// The QR opens the launch page with ?src=qr so the team sees how many people scanned it.
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../api/axios';
import { Spinner, Thumb, errorText } from '../components/ui.jsx';

const clip = (s = '', n) => { const t = String(s).replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : t; };

export default function PosterPage() {
  const { slug } = useParams();
  const [p, setP] = useState(null);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'cards' ? 'cards' : 'poster');
  const pageUrl = `${window.location.origin}/p/${slug}`;

  useEffect(() => {
    api.get(`/projects/${slug}`).then((r) => setP(r.data)).catch((err) => setError(errorText(err, 'Project not found')));
    QRCode.toDataURL(`${pageUrl}?src=qr`, { width: 720, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1b1f3b', light: '#ffffff' } })
      .then(setQr).catch(() => {});
  }, [slug, pageUrl]);

  useEffect(() => {
    document.body.classList.add('print-sheet');
    return () => document.body.classList.remove('print-sheet');
  }, []);

  if (error) return <div className="card empty"><p>{error}</p><Link to="/">Back to all projects</Link></div>;
  if (!p) return <Spinner />;
  if (p.status !== 'published') {
    return <div className="card empty"><p>The poster is ready once your mentor approves the project.</p><Link to={`/p/${slug}`}>Back to the project</Link></div>;
  }

  const team = p.members.filter((m) => m.user).map((m) => ({ name: m.user.name, role: m.role }));
  const shortUrl = pageUrl.replace(/^https?:\/\//, '');

  return (
    <div className="poster-page">
      <div className="poster-tools card">
        <div className="row-between">
          <Link to={`/p/${slug}`}>← {p.title}</Link>
          <button type="button" onClick={() => window.print()} disabled={!qr}>🖨 Print / Save as PDF</button>
        </div>
        <div className="tabs" role="tablist" aria-label="What to print">
          <button type="button" role="tab" aria-selected={mode === 'poster'} className={mode === 'poster' ? 'tab active' : 'tab'} onClick={() => setMode('poster')}>A4 poster</button>
          <button type="button" role="tab" aria-selected={mode === 'cards'} className={mode === 'cards' ? 'tab active' : 'tab'} onClick={() => setMode('cards')}>QR cards ×4</button>
        </div>
        <p className="muted small">
          Print on A4 (or "Save as PDF" and take it to a print shop). In the print dialog set margins to <strong>None</strong> and turn on <strong>Background graphics</strong>.
          Every scan is counted on your project page.
        </p>
      </div>

      {mode === 'poster' ? (
        <section className="sheet poster" aria-label="A4 poster preview">
          <header className="poster-band">
            <span className="poster-brand">NEC <b>Innovation Lab</b></span>
            <span>Nandha Engineering College{p.department ? ` · ${p.department}` : ''}</span>
          </header>
          <div className="poster-body">
            <h1 className="poster-title">{p.title}</h1>
            <p className="poster-tagline">{p.tagline}</p>
            <Thumb project={p} className="poster-cover" />   {/* picture, or the generated cover art */}
            <div className="poster-story">
              {p.problem && <div><h2>The problem</h2><p>{clip(p.problem, 260)}</p></div>}
              {p.solution && <div><h2>Our solution</h2><p>{clip(p.solution, 260)}</p></div>}
            </div>
          </div>
          <footer className="poster-foot">
            <div className="poster-qr">
              {qr && <img src={qr} alt={`QR code for ${shortUrl}`} />}
            </div>
            <div className="poster-cta">
              <strong>Scan to watch the demo,<br />try it &amp; give feedback</strong>
              <ul className="poster-team">
                {team.map((m) => <li key={m.name}>{m.name}<span> · {m.role}</span></li>)}
              </ul>
              {p.mentor && <p className="poster-mentor">Mentor: {p.mentor.name}</p>}
              <p className="poster-url">{shortUrl}</p>
            </div>
          </footer>
        </section>
      ) : (
        <section className="sheet cards" aria-label="QR cards preview">
          {[0, 1, 2, 3].map((i) => (
            <div className="qr-card" key={i}>
              <span className="poster-brand small">NEC <b>Innovation Lab</b></span>
              <h2>{p.title}</h2>
              <p>{clip(p.tagline, 90)}</p>
              {qr && <img src={qr} alt={i === 0 ? `QR code for ${shortUrl}` : ''} />}
              <strong>Scan for the demo &amp; feedback</strong>
              <span className="qr-card-team">{team.map((m) => m.name).join(' · ')}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
