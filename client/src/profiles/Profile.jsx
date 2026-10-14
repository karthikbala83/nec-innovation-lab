// /u/:handle — public student profile. One URL + QR for the resume.
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../api/axios';
import ProjectCard from '../feed/ProjectCard.jsx';
import { Avatar, Spinner, errorText } from '../components/ui.jsx';
import LotusFlower, { LotusLine } from '../lotus/LotusFlower.jsx';
import RequestIntro from '../intros/RequestIntro.jsx';

export default function Profile() {
  const { handle } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/u/${handle}`;

  useEffect(() => {
    setData(null);
    setError('');
    api.get(`/profiles/${handle}`).then((r) => setData(r.data)).catch((err) => setError(errorText(err, 'Profile not found')));
    QRCode.toDataURL(url, { width: 512, margin: 2, color: { dark: '#1E3E7B', light: '#ffffff' } }).then(setQr).catch(() => {});
  }, [handle, url]);

  if (error) return <div className="card empty"><p>{error}</p><Link to="/">Browse projects</Link></div>;
  if (!data) return <Spinner />;
  const { user, projects } = data;

  const copy = async () => {
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="profile">
      <section className="card profile-head">
        <Avatar name={user.name} size={72} />
        <div className="grow">
          <h1>{user.name}</h1>
          {user.verified
            ? <span className="chip verified-chip">✔ College-verified · Nandha Engineering College</span>
            : <span className="chip">Nandha Engineering College</span>}
          <p className="muted">
            {user.role === 'faculty' ? 'Faculty' : 'Student'}
            {user.profile?.department && ` · ${user.profile.department}`}
            {user.profile?.batch && ` · Batch ${user.profile.batch}`}
          </p>
          {user.profile?.skills?.length > 0 && (
            <div className="chips">{user.profile.skills.map((s) => <span key={s} className="chip soft">{s}</span>)}</div>
          )}
          {user.githubUsername && (
            <p><a href={`https://github.com/${user.githubUsername}`} target="_blank" rel="noreferrer">github.com/{user.githubUsername} ↗</a></p>
          )}
        </div>
        <div className="qr-box">
          {qr && <img src={qr} alt={`QR code for ${url}`} width="140" height="140" />}
          <div className="actions">
            <button className="ghost small" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
            {qr && <a className="btn ghost small" href={qr} download={`nec-innovation-lab-${handle}.png`}>Download QR</a>}
          </div>
          <p className="muted small">Put this on your resume</p>
        </div>
        {user.role === 'student' && <RequestIntro student={user._id} />}
      </section>

      <h2>{user.role === 'faculty' ? 'Mentored projects' : 'Projects'} ({projects.length})</h2>
      {projects.length === 0 && <p className="muted">No published projects yet.</p>}
      <div className="card-grid">
        {projects.map((p) => (
          <ProjectCard key={p._id} project={p} extra={(
            <>
              {p.myRole && <p className="muted small">Role: {p.myRole}</p>}
              {p.myLotus && (
                <div className="profile-lotus"><LotusFlower petals={p.myLotus.petals} size={34} /><LotusLine lotus={p.myLotus} /></div>
              )}
            </>
          )} />
        ))}
      </div>
      <p className="muted small center">Recruiters: to contact this student, write to the NEC placement cell.</p>
    </div>
  );
}
