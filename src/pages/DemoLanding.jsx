import { useState } from 'react';
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

export default function DemoLanding() {
  const [loadingRole, setLoadingRole] = useState(null);
  const [error, setError] = useState('');
  const { setUserDoc } = useAuth();

  const handleDemoLogin = async (role) => {
    setLoadingRole(role);
    setError('');

    const email = role === 'student' ? 'demo.student@fixmyhostel.dev' : 'demo.warden@fixmyhostel.dev';
    const password = role === 'student' ? 'DemoStudent123' : 'DemoWarden123';

    try {
      await setPersistence(auth, browserSessionPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userSnap = await getDoc(doc(db, 'users', userCredential.user.uid));

      if (!userSnap.exists()) {
        throw new Error('User document not found. Run the seed script first.');
      }

      const uDoc = userSnap.data();
      setUserDoc(uDoc);

      const destination = uDoc.role === 'warden' ? '/warden/dashboard' : '/student/dashboard';

      // Open dashboard in new tab — judge keeps /demo open to switch roles
      window.open(destination, '_blank');

      // Wait 2.5s so new tab fully loads auth state before signing out here
      setTimeout(async () => {
        await auth.signOut();
        setUserDoc(null);
      }, 2500);

    } catch (err) {
      console.error(err);
      setError(`Login failed: ${err.message}. Ensure seed script has been run.`);
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div className="page auth-center" style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <div className="text-center mb-4">
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--violet)', marginBottom: '0.5rem' }}>
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

        <p className="text-center mb-4" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-raised)', borderRadius: '8px', padding: '0.6rem 1rem' }}>
          Each role opens in a <strong>new tab</strong> — open both to see real-time sync side by side
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
            {loadingRole === 'student'
              ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
              : 'Enter as Student'}
          </button>

          <button
            className="btn btn-outline"
            style={{ padding: '1rem', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            onClick={() => handleDemoLogin('warden')}
            disabled={loadingRole !== null}
          >
            {loadingRole === 'warden'
              ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
              : 'Enter as Warden'}
          </button>
        </div>

        <div className="text-center mt-4">
          <div className="text-xs text-muted">Datathon 2026 Presentation · PS-15</div>
        </div>

        {/* Why This Demo Section */}
        <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Why this demo?
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ color: 'var(--violet)', marginTop: '2px' }}>
                <span className="material-icons-round" style={{ fontSize: '18px' }}>qr_code_scanner</span>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Frictionless Onboarding</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: '2px 0 0' }}>
                  Eliminating manual paperwork with instant room registration via unique per-room QR codes.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ color: 'var(--violet)', marginTop: '2px' }}>
                <span className="material-icons-round" style={{ fontSize: '18px' }}>analytics</span>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Data-Driven Governance</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: '2px 0 0' }}>
                  Using real-time analytics and SLA tracking to ensure student grievances are addressed transparently.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ color: 'var(--violet)', marginTop: '2px' }}>
                <span className="material-icons-round" style={{ fontSize: '18px' }}>hub</span>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Automated Clustering</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: '2px 0 0' }}>
                  Intelligent detection of systemic issues on specific floors or wings to help wardens prioritize repairs.
                </p>
              </div>
            </div>
            
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontStyle: 'italic', marginTop: '0.5rem', borderLeft: '2px solid var(--violet)', paddingLeft: '0.75rem' }}>
              This demo environment is pre-populated with realistic campus data to showcase the platform's advanced analytical capabilities.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
