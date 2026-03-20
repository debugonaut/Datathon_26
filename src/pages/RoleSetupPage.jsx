import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { createUserDoc, checkWardenExists } from '../firebase/auth';

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

      if (role === 'warden') navigate('/warden/setup', { replace: true });
      else {
        const qrCode = sessionStorage.getItem('qrRedirect');
        if (qrCode) {
          sessionStorage.removeItem('qrRedirect');
          navigate(`/student/join?code=${qrCode}`, { replace: true });
        } else {
          navigate('/student/join', { replace: true });
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <Navbar />
      <div className="center-page">
        <div className="auth-card">
          {/* Google avatar */}
          {user?.photoURL && (
            <img
              src={user.photoURL}
              alt="Profile"
              style={{
                width: 64, height: 64, borderRadius: '50%',
                border: '3px solid var(--primary)',
                marginBottom: '1.25rem', display: 'block',
              }}
            />
          )}
          <h1 className="auth-title">Welcome, {user?.displayName?.split(' ')[0]}!</h1>
          <p className="auth-subtitle" style={{ marginBottom: '1.5rem' }}>
            Signed in as <strong>{user?.email}</strong>.<br />
            How will you be using this platform?
          </p>

          {error && <div className="form-error">{error}</div>}

          <div className="role-toggle" style={{ marginBottom: '2rem' }}>
            <button
              type="button"
              className={`role-btn ${role === 'student' ? 'active' : ''}`}
              onClick={() => setRole('student')}
            >
              🎓 Student
            </button>
            <button
              type="button"
              className={`role-btn ${role === 'warden' ? 'active' : ''}`}
              onClick={() => setRole('warden')}
            >
              🔑 Warden
            </button>
          </div>

          {role === 'warden' && (
            <div className="form-group text-left" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
              <label className="form-label" style={{ display: 'block' }}>Hostel Admin Code</label>
              <input 
                className="form-input" 
                type="password" 
                placeholder="Enter code (if a warden already exists)" 
                value={adminCode} 
                onChange={(e) => setAdminCode(e.target.value)} 
                style={{ width: '100%' }}
              />
              <p className="text-sm text-muted mt-1">If you are the first warden, leave this blank (auto-approved).</p>
            </div>
          )}

          <button
            className="btn btn-primary btn-full"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Setting up…' : `Continue as ${role === 'warden' ? 'Warden' : 'Student'} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
