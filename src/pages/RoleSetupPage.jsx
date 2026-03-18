import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { createUserDoc } from '../firebase/auth';

// This page is shown once to new Google sign-in users who don't have a role yet.
export default function RoleSetupPage() {
  const { user, setUserDoc } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setLoading(true);
    try {
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
      else navigate('/student/join', { replace: true });
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
