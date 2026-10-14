import { useEffect, useState } from 'react';
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
import api from './api/axios';

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
  const { user, logout } = useAuth();
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

  return (
    <>
      <nav className="nav">
        <Link to="/" className="brand" onClick={close}><BrandMark />NEC <span>Innovation Lab</span></Link>
        <button className="menu-btn" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>☰</button>
        <div className={open ? 'nav-links open' : 'nav-links'} onClick={close}>
          <NavLink to="/" end>Explore</NavLink>
          <NavLink to="/leaderboards">Leaderboards</NavLink>
          {user ? (
            <>
              {user.role !== 'recruiter' && <NavLink to="/me/projects">My projects</NavLink>}
              {user.role === 'student' && (
                <NavLink to="/inbox">Inbox{unread > 0 && <span className="nav-badge" aria-label={`${unread} unread`}>{unread}</span>}</NavLink>
              )}
              {['recruiter', 'faculty', 'admin'].includes(user.role) && <NavLink to="/talent">Talent</NavLink>}
              {user.role === 'recruiter' && <NavLink to="/intros">My requests</NavLink>}
              {['faculty', 'admin'].includes(user.role) && <NavLink to="/review">Review</NavLink>}
              {user.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
              {user.handle && ['student', 'faculty'].includes(user.role) && <NavLink to={`/u/${user.handle}`}>Profile</NavLink>}
              {['student', 'admin'].includes(user.role) && <NavLink to="/projects/new" className="nav-cta">＋ Launch</NavLink>}
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
          <Route path="/u/:handle" element={<Profile />} />
          <Route path="/leaderboards" element={<Leaderboards />} />

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
          <Route path="/inbox" element={<Protected><Inbox /></Protected>} />
          <Route path="/messages/:id" element={<SenderThread />} />
          <Route path="/admin" element={<Protected roles={['admin']}><Admin /></Protected>} />
          <Route path="/admin/people" element={<Protected roles={['admin']}><People /></Protected>} />
          <Route path="/admin/lab" element={<Protected roles={['admin']}><LabAdmin /></Protected>} />

          {/* Starter demo, kept for teaching; not part of the portal */}
          <Route path="/notes" element={<Protected><Notes /></Protected>} />
          <Route path="*" element={<div className="card empty"><p>Page not found.</p><Link to="/">Back to projects</Link></div>} />
        </Routes>
      </main>
    </>
  );
}
