import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { loginUser, signInWithGoogle, getUserDoc } from '../firebase/auth';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { setUserDoc } = useAuth();
  const navigate = useNavigate();

  // ── Google login ──────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const user = await signInWithGoogle();
      const doc = await getUserDoc(user.uid);
      if (!doc) {
        // New Google user → pick role
        navigate('/setup-role', { replace: true });
      } else {
        setUserDoc(doc);
        redirectByRole(doc, navigate);
      }
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Email/password login ──────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await loginUser(email, password);
      const doc = await getUserDoc(user.uid);
      setUserDoc(doc);
      redirectByRole(doc, navigate);
    } catch (err) {
      setError(getFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <Link to="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <div className="sidebar-brand-icon">
            <span className="material-icons-round" style={{fontSize:16}}>apartment</span>
          </div>
          <span className="sidebar-brand-name">Fix My Hostel</span>
        </Link>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <ThemeToggle />
          <Link to="/" className="text-secondary text-sm" style={{textDecoration:'none', fontWeight:500}}>Back to home</Link>
        </div>
      </div>
      <div className="auth-center">
        <div className="auth-card animation-fade-in">
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to your MITAOE account</p>

          {error && <div className="alert-error">{error}</div>}

          <button onClick={handleGoogle} disabled={googleLoading} style={{ width:'100%', background:'#fff', color:'#111', border:'none', borderRadius:'var(--radius-sm)', padding:'11px', fontSize:13, fontWeight:600, fontFamily:'var(--font-body)', display:'flex', alignItems:'center', justifyContent:'center', gap:10, cursor:'pointer', marginBottom:20, transition:'opacity 0.15s' }} onMouseOver={e=>e.currentTarget.style.opacity='.9'} onMouseOut={e=>e.currentTarget.style.opacity='1'}>
            {googleLoading ? 'Signing in…' : (<><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8.9 20-20 0-1.3-.1-2.7-.4-4z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.6-3-11.3-7.2l-6.5 5C9.5 39.6 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.5-4.5 6l6.2 5.2C41 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/></svg>Continue with Google (@mitaoe.ac.in)</>)}
          </button>

          <div className="divider">or sign in with email</div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="yourname@mitaoe.ac.in" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="btn btn-outline btn-full" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in with email'}
            </button>
          </form>

          <p style={{ textAlign:'center', marginTop:16, fontSize:13, color:'var(--text-secondary)' }}>
            No account? <Link to="/register" style={{ color:'var(--violet)', textDecoration:'none' }}>Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function redirectByRole(doc, navigate) {
  const pending = localStorage.getItem('pendingRoomId');
  if (pending) {
    localStorage.removeItem('pendingRoomId');
    navigate(`/room/${pending}`, { replace: true });
    return;
  }

  if (doc?.role === 'warden') {
    navigate(doc.hostelId ? '/warden/dashboard' : '/warden/setup', { replace: true });
  } else {
    navigate(doc?.roomId ? '/student/dashboard' : '/student/join', { replace: true });
  }
}

function getFirebaseError(code) {
  switch (code) {
    case 'auth/user-not-found': return 'No account found with this email.';
    case 'auth/wrong-password': return 'Incorrect password.';
    case 'auth/invalid-credential': return 'Invalid email or password.';
    case 'auth/too-many-requests': return 'Too many attempts. Try again later.';
    default: return 'Something went wrong. Please try again.';
  }
}
