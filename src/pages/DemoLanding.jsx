import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

export default function DemoLanding() {
  const [loadingRole, setLoadingRole] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUserDoc } = useAuth();

  const handleDemoLogin = async (role) => {
    setLoadingRole(role);
    setError('');
    
    const email = role === 'student' ? 'demo.student@fixmyhostel.dev' : 'demo.warden@fixmyhostel.dev';
    const password = role === 'student' ? 'DemoStudent123' : 'DemoWarden123';

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userSnap = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userSnap.exists()) {
        const uDoc = userSnap.data();
        setUserDoc(uDoc);
        if (uDoc.role === 'warden') {
          navigate('/warden/dashboard', { replace: true });
        } else {
          // If profile is incomplete, send to setup, but demo should already be complete
          if (!uDoc.isProfileComplete) navigate('/student/setup', { replace: true });
          else if (!uDoc.roomId) navigate('/student/join', { replace: true });
          else navigate('/student/dashboard', { replace: true });
        }
      } else {
        throw new Error('User document not found. Run the seed script first.');
      }
    } catch (err) {
      console.error(err);
      setError(`Login failed: ${err.message}. Ensure seed script has been run.`);
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div className="page center-page" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div className="text-center mb-4">
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.5rem' }}>
          Fix My Hostel
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Judge Demo Mode
        </p>
      </div>

      <div className="auth-card animation-fade-in" style={{ maxWidth: '450px', width: '100%', padding: '2rem' }}>
        <p className="text-center text-muted mb-4" style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
          Experience the full platform instantly. Click a role below to bypass authentication and enter the populated demo environment.
        </p>

        {error && (
          <div className="form-error mb-4" style={{ textAlign: 'center' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
          <button 
            className="btn btn-primary" 
            style={{ padding: '1rem', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            onClick={() => handleDemoLogin('student')}
            disabled={loadingRole !== null}
          >
            {loadingRole === 'student' ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : '🎓 Enter as Student'}
          </button>

          <button 
            className="btn btn-outline" 
            style={{ padding: '1rem', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            onClick={() => handleDemoLogin('warden')}
            disabled={loadingRole !== null}
          >
            {loadingRole === 'warden' ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : '🛡️ Enter as Warden'}
          </button>
        </div>
        
        <div className="text-center mt-4">
           <div className="text-xs text-muted">Datathon 2026 Presentation</div>
        </div>
      </div>
    </div>
  );
}
