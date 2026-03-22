import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { searchHostels } from '../firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

export default function LandingPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(false);
    const hostels = await searchHostels(query.trim());
    setResults(hostels);
    setSearched(true);
    setLoading(false);
  };

  const handleJoin = (hostelId) => {
    sessionStorage.setItem('selectedHostelId', hostelId);
    if (user) {
      navigate(`/student/join?hostelId=${hostelId}`);
    } else {
      navigate('/register?role=student');
    }
  };

  return (
    <div className="page" style={{ position: 'relative', overflow: 'hidden', backgroundColor: 'var(--bg)' }}>
      {/* Sleek deep purple/blue ambient glow */}
      <div className="ambient-wrapper"></div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar />
        
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
          
          <div style={{ width: '100%', maxWidth: '840px', padding: '16px 0', textAlign: 'center', animation: 'fadeIn 0.6s ease-out' }}>
            
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(108, 99, 255, 0.08)', border: '1px solid rgba(108, 99, 255, 0.2)', padding: '6px 16px', borderRadius: 100, fontSize: 13, color: '#A78BFA', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 24 }}>
              MITAOE Hostel Management
            </div>

            <h1 style={{ fontFamily: 'var(--font)', fontSize: 'clamp(44px, 7vw, 84px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.04em', margin: '0 0 16px 0', color: 'var(--text)' }}>
              Your Hostel,<br/>
              <span className="highlight-purple">Managed Smart</span>
            </h1>

            <p style={{ fontSize: 'clamp(16px, 2.5vw, 20px)', color: 'var(--text-2)', maxWidth: 640, margin: '0 auto 32px', lineHeight: 1.6 }}>
              Search for your hostel, join with your <strong style={{ color: 'var(--text)' }}>@mitaoe.ac.in</strong> email, and get settled in. Wardens can map entire hostel blocks with a few clicks.
            </p>

            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, maxWidth: 540, margin: '0 auto 32px' }}>
              <input 
                className="search-input-sheer w-full" 
                style={{ padding: '16px 28px', fontSize: 15, fontFamily: 'var(--font)' }} 
                placeholder="Search for your hostel (e.g. Boys Hostel A) ..." 
                value={query} 
                onChange={e => setQuery(e.target.value)} 
              />
              <button className="btn btn-primary" type="submit" disabled={loading} style={{ padding: '0 32px', borderRadius: 100, fontSize: 15, fontWeight: 500 }}>
                {loading ? '...' : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                )}
              </button>
            </form>

            {searched && results.length === 0 && (
              <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 16, animation: 'fadeIn 0.3s ease' }}>No hostels found. Is your warden registered? Ask them to create your hostel first.</p>
            )}

            {results.length > 0 && (
              <div style={{ display: 'grid', gap: 16, maxWidth: 540, margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>
                {results.map(h => (
                  <div key={h.id} className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', textAlign: 'left', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <h3 style={{ fontFamily: 'var(--font)', fontSize: 16, margin: 0, fontWeight: 600, color: 'var(--text)' }}>{h.name}</h3>
                      <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, marginTop: 4 }}>{h.collegeName}</p>
                    </div>
                    <button className="btn btn-primary btn-sm" style={{ borderRadius: 100, padding: '10px 24px', fontSize: 14, fontWeight: 500 }} onClick={() => handleJoin(h.id)}>
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="divider" style={{ maxWidth: 280, margin: '32px auto', opacity: 0.8, color: 'var(--text-2)', fontSize: 14 }}>or explore</div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              <button 
                className="btn btn-secondary" 
                style={{ borderRadius: 100, padding: '14px 28px', fontSize: 15, fontWeight: 500 }} 
                onClick={() => document.getElementById('demo-modal').showModal()}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                Try Datathon Demo
              </button>
              
              <Link 
                to="/register?role=warden" 
                className="btn btn-ghost" 
                style={{ borderRadius: 100, padding: '14px 28px', fontSize: 15, textDecoration: 'none', fontWeight: 500, color: 'var(--text-primary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(108, 99, 255, 0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <svg width="18" height="18" style={{ marginRight: 8, opacity: 0.8 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Warden Registration
              </Link>
            </div>

          </div>
        </div>
      </div>
      
      {/* Demo Modal */}
      <dialog id="demo-modal" className="glass-panel" style={{ padding: 0, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg-card)', outline: 'none', margin: 'auto', borderRadius: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }} onClick={(e) => { if (e.target.id === 'demo-modal') e.target.close() }}>
        <div style={{ padding: 36, width: 440, maxWidth: '90vw' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3 style={{ fontFamily: 'var(--font)', fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--text)' }}>PS-15 Demo Mode</h3>
            <button className="btn btn-ghost btn-sm" style={{ padding: 6, borderRadius: '50%' }} onClick={() => document.getElementById('demo-modal').close()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <DemoCardBody />
        </div>
      </dialog>

      {/* Features Section */}
      <div style={{ padding: '40px 24px 80px', maxWidth: 1200, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16 }}>
            <span className="highlight-purple">Intelligent Infrastructure Management</span>
          </h2>
          <p style={{ fontSize: 18, color: 'var(--text-2)', maxWidth: 640, margin: '0 auto', lineHeight: 1.6 }}>
            Built with modern web technologies and AI to streamline complaint tracking, room management, and student-warden communication.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          
          {/* Feature 1 */}
          <div className="glass-panel" style={{ padding: 32, textAlign: 'left', borderRadius: 24, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(108, 99, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A78BFA', marginBottom: 24 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>AI-Powered Triage</h3>
            <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
              Claude 3.5 Sonnet analyzes photos and descriptions to automatically categorize issues and set priority levels instantly.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="glass-panel" style={{ padding: 32, textAlign: 'left', borderRadius: 24, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60A5FA', marginBottom: 24 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Voice Reporting</h3>
            <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
              Effortlessly log complaints using dual-tier voice dictation with automatic native-to-English translation.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="glass-panel" style={{ padding: 32, textAlign: 'left', borderRadius: 24, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34D399', marginBottom: 24 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Automated SLAs</h3>
            <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
              Strict countdown timers enforce resolution deadlines based on priority, with auto-escalation for breached cases.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="glass-panel" style={{ padding: 32, textAlign: 'left', borderRadius: 24, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FBBF24', marginBottom: 24 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 7v6"/><path d="M12 7v8"/><path d="M16 7v4"/></svg>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Interactive Kanban</h3>
            <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
              Wardens can easily track and manage workflow by dragging and dropping complaints across status columns.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="glass-panel" style={{ padding: 32, textAlign: 'left', borderRadius: 24, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F87171', marginBottom: 24 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Systemic Issue Clustering</h3>
            <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
              Automatically detect and cluster recurring problems across rooms and floors to highlight widespread infrastructure failures.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="glass-panel" style={{ padding: 32, textAlign: 'left', borderRadius: 24, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A78BFA', marginBottom: 24 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Advanced Analytics</h3>
            <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
              Monitor real-time Room Health scores and view comprehensive tracking dashboards to identify maintenance patterns.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

function DemoCardBody() {
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

      window.open(destination, '_blank');

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
    <div>
      <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 28, lineHeight: 1.6 }}>
        Experience the full platform instantly. Click a role below to bypass authentication and enter the populated demo environment.
      </p>

      <div className="alert-info" style={{ marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
        <svg width="18" height="18" style={{ flexShrink: 0, marginTop: 1, color: 'var(--text-2)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Each role opens in a new tab — open both to see real-time sync side by side.</div>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: 20, borderRadius: 12 }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button 
          className="btn btn-primary btn-full" 
          onClick={() => handleDemoLogin('student')} 
          disabled={loadingRole !== null} 
          style={{ padding: '14px', justifyContent: 'center', borderRadius: 12, fontSize: 14, fontWeight: 500 }}
        >
          {loadingRole === 'student' ? 'Connecting...' : (
            <><svg width="18" height="18" style={{ marginRight: 8 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> Enter as Student</>
          )}
        </button>
        <button 
          className="btn btn-secondary btn-full" 
          onClick={() => handleDemoLogin('warden')} 
          disabled={loadingRole !== null} 
          style={{ padding: '14px', justifyContent: 'center', borderRadius: 12, fontSize: 14, fontWeight: 500 }}
        >
          {loadingRole === 'warden' ? 'Connecting...' : (
            <><svg width="18" height="18" style={{ marginRight: 8 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Enter as Warden</>
          )}
        </button>
      </div>
    </div>
  );
}
