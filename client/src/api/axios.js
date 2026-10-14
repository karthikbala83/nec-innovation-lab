// One axios instance for the whole app.
// Interceptor attaches the JWT to every request automatically.
import axios from 'axios';

// Accepts "https://api.example.com", ".../api" or ".../api/" — every route lives under /api.
// (A bare host without /api once broke the live site, so normalise instead of trusting the env.)
export const apiBase = (raw) => {
  const url = String(raw || 'http://localhost:5000/api').trim().replace(/\/+$/, '');
  return /\/api$/.test(url) ? url : `${url}/api`;
};

const api = axios.create({ baseURL: apiBase(import.meta.env.VITE_API_URL) });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the token expires, kick the user back to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes('/auth/')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
