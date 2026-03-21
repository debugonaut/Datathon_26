import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createUserDoc, checkWardenExists } from '../firebase/auth';
import ThemeToggle from '../components/ThemeToggle';

// This page is shown once to new Google sign-in users who don't have a role yet.
export default function RoleSetupPage() {
  const { user, setUserDoc } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('student');
  const [adminCode, setAdminCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      if (role === 'warden') {
        const wardenExists = await checkWardenExists();
        if (wardenExists && adminCode !== 'MITAOE_WARDEN_2026') {
          setError('Invalid Admin Code. A warden already exists for this system.');
          setLoading(false);
          return;
        }
      }

      await createUserDoc(
        user.uid,
        user.displayName || user.email.split('@')[0],
        user.email,
        role
      );
      const newDoc = {
        uid: user.uid,
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        role,
        hostelId: null,
        floorId: null,
        blockId: null,
        roomNumber: null,
      };
      setUserDoc(newDoc);

      const pending = localStorage.getItem('pendingRoomId');
      if (pending) {
        localStorage.removeItem('pendingRoomId');
        navigate(`/room/${pending}`, { replace: true });
        return;
      }

      if (role === 'warden') navigate('/warden/setup', { replace: true });
      else navigate('/student/join', { replace: true });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0];

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div className="sidebar-brand-icon">
            <span className="material-icons-round" style={{fontSize:16}}>apartment</span>
          </div>
          <span className="sidebar-brand-name">Fix My Hostel</span>
        </div>
        <ThemeToggle />
      </div>
      <div className="auth-center">
        <div className="auth-card animation-fade-in" style={{ maxWidth: 400, borderTop: '2px solid var(--violet)' }}>
          {user?.photoURL && (
            <img 
              src={user.photoURL} 
              alt="Profile avatar" 
              style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid var(--violet)', display: 'block', margin: '0 auto 16px' }}
            />
          )}
          <h1 className="auth-title" style={{ fontFamily: 'var(--font-heading)', textAlign: 'center' }}>Welcome, {firstName}!</h1>
          <p className="auth-subtitle" style={{ textAlign: 'center' }}>
            Signed in as <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{user?.email}</span>.<br />
            How will you be using this platform?
          </p>

          {error && <div className="alert-error">{error}</div>}

          <div className="role-toggle">
            <button type="button" className={`role-btn ${role==='student'?'active':''}`} onClick={()=>setRole('student')}>Student</button>
            <button type="button" className={`role-btn ${role==='warden'?'active':''}`} onClick={()=>setRole('warden')}>Warden</button>
          </div>

          {role === 'warden' && (
            <div style={{ background:'rgba(124,110,250,0.05)', border:'1px solid rgba(124,110,250,0.15)', borderRadius:'var(--radius-sm)', padding:'14px 16px', marginBottom:16 }}>
              <label className="label">Admin Code</label>
              <input className="input" type="password" placeholder="Enter code if a warden exists" value={adminCode} onChange={e=>setAdminCode(e.target.value)} />
              <p style={{ fontSize:11, color:'var(--text-ghost)', fontFamily:'var(--font-mono)', marginTop:6 }}>Leave blank if you are the first warden.</p>
            </div>
          )}

          <button className="btn btn-primary btn-full" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Setting up…' : `Continue as ${role === 'warden' ? 'Warden' : 'Student'} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
