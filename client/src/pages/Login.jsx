import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import gsap from 'gsap';
import { useAuth } from '../context/AuthContext.jsx';

// ---------------------------------------------------------------
// ANIMATION TEASER (full GSAP + Lottie session coming next time)
// Two tiny effects:
//   1. Card slides up + fades in on page load
//   2. Card shakes when login fails (instant, wordless feedback)
// Notice: animation never blocks logic — it decorates it.
// ---------------------------------------------------------------
export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const cardRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Runs once after the card first renders
  // useEffect(() => {
  //   gsap.from(cardRef.current, { y: 40, opacity: 0, duration: 0.6, ease: 'power2.out' });
  // }, []);

  useEffect(() => {
  const tween = gsap.fromTo(
    cardRef.current,
    { y: 40, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' }
  );
  return () => tween.kill();   // cleanup for StrictMode's double-run
}, []);

  const shake = () => {
    gsap.fromTo(cardRef.current, { x: -8 }, {
      x: 8, duration: 0.07, repeat: 5, yoyo: true, clearProps: 'x',
    });
  };

  const submit = async () => {
    setError('');
    try {
      await login(email, password);
      nav('/notes');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      shake();                       // feel the failure, not just read it
    }
  };

  return (
    <div className="card auth-card" ref={cardRef}>
      <h2>Login</h2>
      {error && <p className="error">{error}</p>}
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={password}
             onChange={(e) => setPassword(e.target.value)}
             onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <button onClick={submit}>Login</button>
      <p><Link to="/forgot-password">Forgot password?</Link></p>
      <p>New here? <Link to="/signup">Create an account</Link></p>
    </div>
  );
}
