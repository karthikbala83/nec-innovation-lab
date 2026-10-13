import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function ResetPassword() {
  const { token } = useParams();
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      nav('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed');
    }
  };

  return (
    <div className="card auth-card">
      <h2>Set new password</h2>
      {error && <p className="error">{error}</p>}
      <input type="password" placeholder="New password" value={password}
             onChange={(e) => setPassword(e.target.value)} />
      <button onClick={submit}>Update password</button>
    </div>
  );
}
