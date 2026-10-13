import { useState } from 'react';
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

// Route guards — the frontend half of protection.
// (The API enforces it too. Never trust only the frontend.)
function Protected({ children, roles }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

export default function App() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <nav className="nav">
        <Link to="/" className="brand" onClick={close}>NEC <span>Innovation Lab</span></Link>
        <button className="menu-btn" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>☰</button>
        <div className={open ? 'nav-links open' : 'nav-links'} onClick={close}>
          <NavLink to="/" end>Explore</NavLink>
          {user ? (
            <>
              <NavLink to="/me/projects">My projects</NavLink>
              {['faculty', 'admin'].includes(user.role) && <NavLink to="/review">Review</NavLink>}
              {user.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
              {user.handle && <NavLink to={`/u/${user.handle}`}>Profile</NavLink>}
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

          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          <Route path="/me/projects" element={<Protected><MyProjects /></Protected>} />
          <Route path="/projects/new" element={<Protected roles={['student', 'admin']}><ProjectWizard /></Protected>} />
          <Route path="/projects/:id/edit" element={<Protected><ProjectWizard /></Protected>} />
          <Route path="/review" element={<Protected roles={['faculty', 'admin']}><ReviewQueue /></Protected>} />
          <Route path="/admin" element={<Protected roles={['admin']}><Admin /></Protected>} />
          <Route path="/admin/people" element={<Protected roles={['admin']}><People /></Protected>} />

          {/* Starter demo, kept for teaching; not part of the portal */}
          <Route path="/notes" element={<Protected><Notes /></Protected>} />
          <Route path="*" element={<div className="card empty"><p>Page not found.</p><Link to="/">Back to projects</Link></div>} />
        </Routes>
      </main>
    </>
  );
}
