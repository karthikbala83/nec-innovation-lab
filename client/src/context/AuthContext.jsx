import { createContext, useContext, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const saveAuth = ({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    saveAuth(data);
    return data.user;
  };

  const signup = async (payload) => {
    const { data } = await api.post('/auth/signup', payload);
    saveAuth(data);
    return data.user;
  };

  // "Continue with Google": Google's ID token -> our session (college Workspace only)
  const googleLogin = async (credential) => {
    const { data } = await api.post('/auth/google', { credential });
    saveAuth(data);
    return data.user;
  };

  // After editing the profile on /settings
  const refreshUser = (next) => {
    const merged = { ...user, ...next };
    localStorage.setItem('user', JSON.stringify(merged));
    setUser(merged);
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  // App tour finished/skipped: remember locally at once, then on the account (so other devices skip it too)
  const markTourDone = (version) => {
    const next = { ...user, tourVersion: Math.max(version, user?.tourVersion || 0) };
    localStorage.setItem('user', JSON.stringify(next));
    setUser(next);
    api.patch('/auth/tour', { version }).catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, markTourDone, googleLogin, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
