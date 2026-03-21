import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { registerUser, signInWithGoogle, getUserDoc, checkWardenExists } from '../firebase/auth';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function RegisterPage() {
  const [params] = useSearchParams();
  const initialRole = params.get('role') === 'warden' ? 'warden' : 'student';

  const [role, setRole] = useState(initialRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { setUserDoc } = useAuth();
  const navigate = useNavigate();

  // ── Google sign-in ────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const user = await signInWithGoogle();
      const doc = await getUserDoc(user.uid);
      if (!doc) {
        // Brand new user → pick role
        navigate('/setup-role', { replace: true });
      } else {
        setUserDoc(doc);
        if (doc.role === 'warden') {
          navigate(doc.hostelId ? '/warden/dashboard' : '/warden/setup', { replace: true });
        } else {
          if (doc.hostelId) navigate('/student/dashboard', { replace: true });
          else {
            const savedId = sessionStorage.getItem('selectedHostelId');
            if (savedId) navigate(`/student/join?hostelId=${savedId}`, { replace: true });
            else navigate('/', { replace: true });
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Email/password register ────────────────────────────────────────────────────
  const validate = () => {
    if (!name.trim()) return 'Please enter your full name.';
    if (role === 'student' && !email.endsWith('@mitaoe.ac.in'))
      return 'Students must register with their @mitaoe.ac.in email.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (password !== confirm) return 'Passwords do not match.';
    return null;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);
    try {
      if (role === 'warden') {
        const wardenExists = await checkWardenExists();
        if (wardenExists && adminCode !== 'MITAOE_WARDEN_2026') {
          setError('Invalid Admin Code. A warden already exists for this system.');
          setLoading(false);
          return;
        }
      }

      await registerUser(email, password, name, role);

      const pending = localStorage.getItem('pendingRoomId');
      if (pending) {
        localStorage.removeItem('pendingRoomId');
        navigate(`/room/${pending}`, { replace: true });
        return;
      }

      if (role === 'warden') {
        navigate('/warden/setup', { replace: true });
      } else {
        navigate('/student/join', { replace: true });
      }
    } catch (err2) {
      setError(getFirebaseError(err2.code));
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
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join MITAOE Hostel Management</p>

          {error && <div className="alert-error">{error}</div>}

          <button onClick={handleGoogle} disabled={googleLoading} style={{ width:'100%', background:'#fff', color:'#111', border:'none', borderRadius:'var(--radius-sm)', padding:'11px', fontSize:13, fontWeight:600, fontFamily:'var(--font-body)', display:'flex', alignItems:'center', justifyContent:'center', gap:10, cursor:'pointer', marginBottom:20, transition:'opacity 0.15s' }} onMouseOver={e=>e.currentTarget.style.opacity='.9'} onMouseOut={e=>e.currentTarget.style.opacity='1'}>
            {googleLoading ? 'Signing in…' : (<><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8.9 20-20 0-1.3-.1-2.7-.4-4z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.6-3-11.3-7.2l-6.5 5C9.5 39.6 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.5-4.5 6l6.2 5.2C41 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/></svg>Sign up with Google (@mitaoe.ac.in)</>)}
          </button>

          <div className="divider">or register with email</div>

          <div className="role-toggle">
            <button type="button" className={`role-btn ${role==='student'?'active':''}`} onClick={()=>setRole('student')}>Student</button>
            <button type="button" className={`role-btn ${role==='warden'?'active':''}`} onClick={()=>setRole('warden')}>Warden</button>
          </div>

          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: 14 }}>
              <label className="label">Full Name</label>
              <input className="input" type="text" placeholder="Aadesh Khande" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder={role === 'student' ? 'PRN@mitaoe.ac.in' : 'warden@mitaoe.ac.in'} value={email} onChange={(e) => setEmail(e.target.value)} required />
              {role === 'student' && <p style={{ fontSize: 11, color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>Must use your official @mitaoe.ac.in email.</p>}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="Min. 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="label">Confirm Password</label>
              <input className="input" type="password" placeholder="Repeat password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            
            {role === 'warden' && (
              <div style={{ background:'rgba(124,110,250,0.05)', border:'1px solid rgba(124,110,250,0.15)', borderRadius:'var(--radius-sm)', padding:'14px 16px', marginBottom:16 }}>
                <label className="label">Admin Code</label>
                <input className="input" type="password" placeholder="Enter code if a warden exists" value={adminCode} onChange={e=>setAdminCode(e.target.value)} />
                <p style={{ fontSize:11, color:'var(--text-ghost)', fontFamily:'var(--font-mono)', marginTop:6 }}>Leave blank if you are the first warden.</p>
              </div>
            )}

            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
              {loading ? 'Creating account…' : `Register as ${role === 'warden' ? 'Warden' : 'Student'}`}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
            Already have an account? <Link to="/login" style={{ color: 'var(--violet)', textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function getFirebaseError(code) {
  switch (code) {
    case 'auth/email-already-in-use': return 'An account with this email already exists.';
    case 'auth/invalid-email': return 'Invalid email address.';
    case 'auth/weak-password': return 'Password is too weak.';
    default: return 'Registration failed. Please try again.';
  }
}
