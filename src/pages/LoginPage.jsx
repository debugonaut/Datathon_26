import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

function redirectByRole(role, navigate) {
  if (role === 'warden') navigate('/warden/dashboard');
  else navigate('/student/dashboard');
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUserDoc } = useAuth();
  const navigate = useNavigate();

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    try {
      await setPersistence(auth, browserSessionPersistence);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (!snap.exists()) throw new Error('User record not found.');
      const uDoc = snap.data();
      setUserDoc(uDoc);
      redirectByRole(uDoc.role, navigate);
    } catch (err) {
      setError(err.code === 'auth/invalid-credential' ? 'Invalid email or password.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await setPersistence(auth, browserSessionPersistence);
      const provider = new GoogleAuthProvider();
      // provider.setCustomParameters({ hd: 'mitaoe.ac.in' });
      const cred = await signInWithPopup(auth, provider);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (!snap.exists()) throw new Error('No account found. Please register first.');
      const uDoc = snap.data();
      setUserDoc(uDoc);
      redirectByRole(uDoc.role, navigate);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') setError(err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div style={{
      fontFamily: "'Sora', 'Inter', sans-serif",
      minHeight: '100vh',
      background: '#0A0C12',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
    }}>

      {/* Hero — left 65%, full height, diagonal cuts bottom-right */}
      <div className="mobile-hidden" style={{
        position: 'absolute', top: 0, left: 0,
        width: '65%', height: '100%',
        background: 'linear-gradient(135deg, #5B52E8 0%, #6C63FF 55%, #4F8EF7 100%)',
        clipPath: 'polygon(0 0, 100% 0, 72% 100%, 0 100%)',
        zIndex: 0,
      }} />
      {/* Grid overlay on hero */}
      <div className="mobile-hidden" style={{
        position: 'absolute', top: 0, left: 0,
        width: '65%', height: '100%',
        clipPath: 'polygon(0 0, 100% 0, 72% 100%, 0 100%)',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        zIndex: 1, pointerEvents: 'none',
      }} />

      {/* Navbar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '24px 32px', zIndex: 20 }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
              <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" stroke="#fff" strokeWidth="1.5" />
              <path d="M16 9 L16 16 L20 19" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Fix My Hostel</span>
          </div>
          <div style={{ marginTop: 7, display: 'inline-block', fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.12)', padding: '3px 10px', borderRadius: 4 }}>
            PS-15 · Datathon 2026
          </div>
        </Link>
        <Link to="/" style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)', textDecoration: 'none', marginTop: 4 }}>
          ← Back to home
        </Link>
      </div>

      {/* Tagline — vertically centered in hero */}
      <div className="mobile-hidden" style={{ position: 'absolute', top: '50%', left: 48, transform: 'translateY(-50%)', zIndex: 2, pointerEvents: 'none' }}>
        <div style={{ fontSize: 52, fontWeight: 700, color: '#fff', letterSpacing: '-0.05em', lineHeight: 1.0 }}>
          Welcome<br />back.
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 12, lineHeight: 1.65, maxWidth: 240 }}>
          Sign in to track and resolve<br />hostel complaints in real time.
        </div>
      </div>

      {/* Accent dots */}
      <div className="mobile-hidden" style={{ position: 'absolute', bottom: 28, left: 48, display: 'flex', gap: 10, zIndex: 5 }}>
        {[{ bg: '#6C63FF', shadow: '0 0 8px rgba(108,99,255,0.8)' }, { bg: '#10B981', shadow: 'none' }, { bg: '#F59E0B', shadow: 'none' }, { bg: '#EF4444', shadow: 'none' }].map((d, i) => (
          <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: d.bg, boxShadow: d.shadow }} />
        ))}
      </div>

      {/* Form card — vertically centered on right side */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 10,
        padding: '80px 20px 40px'
      }}>
        <div className="auth-card-responsive" style={{ width: 420, background: '#131720', borderRadius: 20, padding: '36px 32px 40px', border: '1px solid rgba(255,255,255,0.07)' }}>

          <div style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.03em', marginBottom: 4 }}>Sign in</div>
          <div style={{ fontSize: 13, color: '#475569', marginBottom: 24 }}>Sign in to your MITAOE account</div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 13px', marginBottom: 16, fontSize: 12, color: '#ef4444' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#E2E8F0', fontSize: 13, fontWeight: 600, cursor: googleLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20, opacity: googleLoading ? 0.7 : 1 }}
          >
            {googleLoading ? '…' : (<>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </>)}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
            <span style={{ fontSize: 11, color: '#1E293B', fontWeight: 600 }}>or sign in with email</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
          </div>

          <form onSubmit={handleEmailLogin}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>Email</div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="yourname@example.com" required
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.05)', color: '#F1F5F9', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>Password</div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.05)', color: '#F1F5F9', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <button type="submit" disabled={loading || googleLoading}
              style={{ width: '100%', padding: 13, borderRadius: 10, background: loading ? 'rgba(108,99,255,0.5)' : '#6C63FF', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 10 }}>
              {loading ? 'Signing in…' : 'Sign in with email'}
            </button>
          </form>

          <div style={{ textAlign: 'center', fontSize: 12, color: '#334155', marginTop: 16 }}>
            No account?{' '}
            <Link to="/register" style={{ color: '#6C63FF', fontWeight: 600, textDecoration: 'none' }}>Create one</Link>
          </div>
        </div>
      </div>
    </div>
  );
}