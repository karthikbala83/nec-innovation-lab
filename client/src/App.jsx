import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Notes from './pages/Notes.jsx';
import Admin from './pages/Admin.jsx';

//import BadEffect from './pages/BadEffect.jsx';

// Route guards — the frontend half of protection.
// (The API enforces it too. Never trust only the frontend.)
function Protected({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}
function AdminOnly({ children }) {
  const { user } = useAuth();
  return user?.role === 'admin' ? children : <Navigate to="/notes" />;
}

export default function App() {
  const { user, logout } = useAuth();
  return (
    <>
      <nav className="nav">
        <span className="brand">MERN Starter</span>
        <div>
          {user ? (
            <>
              <Link to="/notes">Notes</Link>
              {user.role === 'admin' && <Link to="/admin">Admin</Link>}
              <button className="link-btn" onClick={logout}>Logout ({user.name})</button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/signup">Signup</Link>
            </>
          )}
        </div>
      </nav>
      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to={user ? '/notes' : '/login'} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/notes" element={<Protected><Notes /></Protected>} />
          <Route path="/admin" element={<AdminOnly><Admin /></AdminOnly>} />
          {/* <Route path="/bad-effect" element={<Protected><BadEffect /></Protected>} /> */}
        </Routes>
      </main>
    </>
  );
}
