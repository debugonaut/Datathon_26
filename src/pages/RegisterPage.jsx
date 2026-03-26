import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { registerUser, signInWithGoogle, getUserDoc, checkWardenExists } from '../firebase/auth';
import { useAuth } from '../context/AuthContext';

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

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const user = await signInWithGoogle();
      const doc = await getUserDoc(user.uid);
      if (!doc) {
        navigate('/setup-role', { replace: true });
      } else {
        setUserDoc(doc);
        if (doc.role === 'warden') {
          navigate(doc.hostelId ? '/warden/dashboard' : '/warden/setup', { replace: true });
        } else {
          if (doc.hostelId) navigate('/student/dashboard', { replace: true });
          else navigate('/', { replace: true });
        }
      }
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const validate = () => {
    if (!name.trim()) return 'Please enter your full name.';
    // Removed domain restriction for demo purposes
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
      if (role === 'warden') navigate('/warden/setup', { replace: true });
      else navigate('/student/join', { replace: true });
    } catch (err2) {
      setError(err2.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.05)', color: '#F1F5F9', fontSize: 13, fontFamily: 'inherit', outline: 'none' };
  const labelStyle = { fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#475569', marginBottom: 5 };

  return (
    <div style={{
      fontFamily: "'Sora', 'Inter', sans-serif",
      minHeight: '100vh',
      background: '#060810',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>

      {/* Grid Background */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        zIndex: 0, pointerEvents: 'none',
      }} />

      {/* Navbar overlay */}
      <div style={{ 
        position: 'absolute', top: 0, left: 0, right: 0, 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
        padding: '24px 20px', zIndex: 10 
      }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" stroke="#6C63FF" strokeWidth="2" />
              <path d="M16 9 L16 16 L20 19" stroke="#6C63FF" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>Fix My Hostel</span>
          </div>
        </Link>
        <Link to="/" style={{ fontSize: 11, fontWeight: 600, color: '#475569', textDecoration: 'none' }}>
          ← Back
        </Link>
      </div>

      {/* Centered card */}
      <div className="auth-card-responsive" style={{ width: '100%', maxWidth: 460, background: '#131720', borderRadius: 20, padding: '32px 32px 36px', border: '1px solid rgba(255,255,255,0.07)', position: 'relative', zIndex: 1, marginTop: 40 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.03em', marginBottom: 4 }}>Create Account</div>
        <div style={{ fontSize: 13, color: '#475569', marginBottom: 20 }}>Join MITAOE Hostel Management</div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 13px', marginBottom: 16, fontSize: 12, color: '#ef4444' }}>
            {error}
          </div>
        )}

        <button onClick={handleGoogle} disabled={googleLoading || loading}
          style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#E2E8F0', fontSize: 13, fontWeight: 600, cursor: googleLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16, opacity: googleLoading ? 0.7 : 1 }}>
          {googleLoading ? '…' : (<>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8.9 20-20 0-1.3-.1-2.7-.4-4z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.6-3-11.3-7.2l-6.5 5C9.5 39.6 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.5-4.5 6l6.2 5.2C41 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/></svg>
            Sign up with Google
          </>)}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
          <span style={{ fontSize: 10, color: '#1E293B', fontWeight: 600, textTransform: 'uppercase' }}>or register with email</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {['student', 'warden'].map(r => (
            <button key={r} onClick={() => setRole(r)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${role === r ? '#6C63FF' : 'rgba(255,255,255,0.06)'}`, background: role === r ? 'rgba(108,99,255,0.1)' : 'transparent', color: role === r ? '#F1F5F9' : '#334155', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>{r}</button>
          ))}
        </div>

        <form onSubmit={handleRegister}>
          <div className="grid-2 responsive" style={{ gap: 12, marginBottom: 12 }}>
            <div>
              <div style={labelStyle}>Full Name</div>
              <input style={inputStyle} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" required />
            </div>
            <div>
              <div style={labelStyle}>Email</div>
              <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={role==='student'?'Your Email':'Warden Email'} required />
            </div>
          </div>
          <div className="grid-2 responsive" style={{ gap: 12, marginBottom: 12 }}>
            <div>
              <div style={labelStyle}>Password</div>
              <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 chars" required />
            </div>
            <div>
              <div style={labelStyle}>Confirm</div>
              <input style={inputStyle} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat" required />
            </div>
          </div>

          {role === 'warden' && (
            <div style={{ background: 'rgba(108,99,255,0.04)', border: '1px solid rgba(108,99,255,0.1)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
              <div style={labelStyle}>Admin Code</div>
              <input style={inputStyle} type="password" value={adminCode} onChange={e => setAdminCode(e.target.value)} placeholder="Enter code" />
            </div>
          )}

          <button type="submit" disabled={loading || googleLoading}
            style={{ width: '100%', padding: 13, borderRadius: 10, background: loading ? 'rgba(108,99,255,0.5)' : '#6C63FF', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
            {loading ? 'Creating account…' : `Register as ${role}`}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: 12, color: '#334155', marginTop: 14 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#6C63FF', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
