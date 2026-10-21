import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Navigate, Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Notes from './pages/Notes.jsx';
import Admin from './pages/Admin.jsx';
import Feed from './feed/Feed.jsx';
import LaunchPage from './projects/LaunchPage.jsx';
import PosterPage from './projects/PosterPage.jsx';
import ProjectWizard from './projects/ProjectWizard.jsx';
import MyProjects from './projects/MyProjects.jsx';
import ReviewQueue from './review/ReviewQueue.jsx';
import Profile from './profiles/Profile.jsx';
import People from './admin/People.jsx';
import LabAdmin from './admin/LabAdmin.jsx';
import Leaderboards from './leaderboards/Leaderboards.jsx';
import LotusCheck from './lotus/LotusCheck.jsx';
import VivaView from './lotus/VivaView.jsx';
import Talent from './talent/Talent.jsx';
import MyIntros from './intros/MyIntros.jsx';
import Intros from './admin/Intros.jsx';
import Inbox from './feedback/Inbox.jsx';
import SenderThread from './feedback/SenderThread.jsx';
import Moderation from './admin/Moderation.jsx';
import Seasons from './seasons/Seasons.jsx';
import SeasonPage from './seasons/SeasonPage.jsx';
import JudgePage from './seasons/JudgePage.jsx';
import AdminSeasons from './admin/AdminSeasons.jsx';
import Reports from './admin/Reports.jsx';
import Settings from './pages/Settings.jsx';
import api from './api/axios';
import Tour from './tour/Tour.jsx';
import { stepsFor, TOUR_VERSION } from './tour/tourSteps.js';

// Route guards — the frontend half of protection.
// (The API enforces it too. Never trust only the frontend.)
function Protected({ children, roles }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

// Logo: a flat 8-petal lotus (the portal's understanding check), one colour per petal
const MARK_COLORS = ['#ff5a36', '#ffc83d', '#19c39c', '#3d9bff', '#8b5cf6', '#ff6fae', '#8cc63f', '#ff9f1c'];
function BrandMark() {
  return (
    <svg className="brand-mark" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      {MARK_COLORS.map((c, i) => (
        <ellipse key={c} cx="15" cy="7.5" rx="3.6" ry="6.6" fill={c} stroke="#1b1f3b" strokeWidth="1.3" transform={`rotate(${i * 45} 15 15)`} />
      ))}
      <circle cx="15" cy="15" r="4" fill="#1b1f3b" />
    </svg>
  );
}

export default function App() {
  const { user, logout, markTourDone } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const location = useLocation();

  // Unread feedback / requests for students' projects (nav badge)
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (user?.role !== 'student') { setUnread(0); return undefined; }
    const load = () => api.get('/inbox/unread').then((r) => setUnread(r.data.unread)).catch(() => {});
    load();
    window.addEventListener('inbox-read', load);
    return () => window.removeEventListener('inbox-read', load);
  }, [user, location.pathname]);

  // First-run app tour: starts once per account (any device), replay with the ? button
  const [touring, setTouring] = useState(false);
  const tourSteps = useMemo(() => (user ? stepsFor(user) : []), [user?.role, user?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const noTourHere = /^\/(messages|reset-password|login|signup)/.test(location.pathname);
  useEffect(() => {
    if (!user || touring || noTourHere || (user.tourVersion || 0) >= TOUR_VERSION) return undefined;
    const t = setTimeout(() => setTouring(true), 800);
    return () => clearTimeout(t);
  }, [user, touring, noTourHere]);
  const endTour = () => { setTouring(false); markTourDone(TOUR_VERSION); };

  return (
    <>
      <nav className="nav">
        <Link to="/" className="brand" onClick={close}><BrandMark />NEC <span>Innovation Lab</span></Link>
        <button className="menu-btn" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>☰</button>
        <div className={open ? 'nav-links open' : 'nav-links'} onClick={close}>
          <NavLink to="/" end>Explore</NavLink>
          <NavLink to="/seasons" data-tour="nav-seasons">Seasons</NavLink>
          <NavLink to="/leaderboards" data-tour="nav-leaderboards">Leaderboards</NavLink>
          {user ? (
            <>
              {user.role !== 'recruiter' && <NavLink to="/me/projects" data-tour="nav-myprojects">My projects</NavLink>}
              {user.role === 'student' && (
                <NavLink to="/inbox" data-tour="nav-inbox">Inbox{unread > 0 && <span className="nav-badge" aria-label={`${unread} unread`}>{unread}</span>}</NavLink>
              )}
              {['recruiter', 'faculty', 'admin'].includes(user.role) && <NavLink to="/talent" data-tour="nav-talent">Talent</NavLink>}
              {user.role === 'recruiter' && <NavLink to="/intros" data-tour="nav-requests">My requests</NavLink>}
              {['faculty', 'admin'].includes(user.role) && <NavLink to="/review" data-tour="nav-review">Review</NavLink>}
              {user.role === 'admin' && <NavLink to="/admin" data-tour="nav-admin">Admin</NavLink>}
              {user.handle && ['student', 'faculty'].includes(user.role) && <NavLink to={`/u/${user.handle}`} data-tour="nav-profile">Profile</NavLink>}
              {['student', 'admin'].includes(user.role) && <NavLink to="/projects/new" className="nav-cta" data-tour="nav-launch">＋ Launch</NavLink>}
              <NavLink to="/settings" data-tour="nav-settings">Account</NavLink>
              <button className="link-btn" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/signup">Sign up</NavLink>
            </>
          )}
        </div>
      </nav>
      <main className="container">
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/p/:slug" element={<LaunchPage />} />
          <Route path="/p/:slug/poster" element={<PosterPage />} />
          <Route path="/u/:handle" element={<Profile />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route path="/seasons" element={<Seasons />} />
          <Route path="/seasons/:slug" element={<SeasonPage />} />
          <Route path="/seasons/:slug/judge" element={<Protected roles={['faculty', 'admin']}><JudgePage /></Protected>} />

          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          <Route path="/me/projects" element={<Protected><MyProjects /></Protected>} />
          <Route path="/projects/new" element={<Protected roles={['student', 'admin']}><ProjectWizard /></Protected>} />
          <Route path="/projects/:id/edit" element={<Protected><ProjectWizard /></Protected>} />
          <Route path="/review" element={<Protected roles={['faculty', 'admin']}><ReviewQueue /></Protected>} />
          <Route path="/review/viva/:projectId" element={<Protected roles={['faculty', 'admin']}><VivaView /></Protected>} />
          <Route path="/projects/:id/lotus" element={<Protected roles={['student']}><LotusCheck /></Protected>} />
          <Route path="/talent" element={<Protected roles={['recruiter', 'faculty', 'admin']}><Talent /></Protected>} />
          <Route path="/intros" element={<Protected><MyIntros /></Protected>} />
          <Route path="/admin/intros" element={<Protected roles={['admin']}><Intros /></Protected>} />
          <Route path="/admin/moderation" element={<Protected roles={['admin']}><Moderation /></Protected>} />
          <Route path="/admin/seasons" element={<Protected roles={['admin']}><AdminSeasons /></Protected>} />
          <Route path="/admin/reports" element={<Protected roles={['admin']}><Reports /></Protected>} />
          <Route path="/inbox" element={<Protected><Inbox /></Protected>} />
          <Route path="/settings" element={<Protected><Settings /></Protected>} />
          <Route path="/messages/:id" element={<SenderThread />} />
          <Route path="/admin" element={<Protected roles={['admin']}><Admin /></Protected>} />
          <Route path="/admin/people" element={<Protected roles={['admin']}><People /></Protected>} />
          <Route path="/admin/lab" element={<Protected roles={['admin']}><LabAdmin /></Protected>} />

          {/* Starter demo, kept for teaching; not part of the portal */}
          <Route path="/notes" element={<Protected><Notes /></Protected>} />
          <Route path="*" element={<div className="card empty"><p>Page not found.</p><Link to="/">Back to projects</Link></div>} />
        </Routes>
      </main>

      {user && !/\/lotus$/.test(location.pathname) && (
        <button className="tour-fab" data-tour="tour-fab" onClick={() => setTouring(true)} aria-label="Take the app tour" title="Take the app tour">?</button>
      )}
      {touring && tourSteps.length > 0 && <Tour steps={tourSteps} onClose={endTour} setMenuOpen={setOpen} />}
    </>
  );
}
