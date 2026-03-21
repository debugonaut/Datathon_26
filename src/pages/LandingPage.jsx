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
    <div className="page">
      <Navbar />
      <div style={{ maxWidth:800, margin:'0 auto', padding:'60px 24px', textAlign:'center', animation:'fadeIn 0.3s ease' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'var(--violet-dim)', border:'1px solid var(--violet-border)', padding:'6px 14px', borderRadius:20, fontSize:12, color:'var(--violet)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:24 }}>
          MITAOE Hostel Management
        </div>
        <h1 style={{ fontFamily:'var(--font-heading)', fontSize:48, fontWeight:700, lineHeight:1.1, letterSpacing:'-0.03em', marginBottom:20 }}>
          Your Hostel,<br/>
          <span style={{ background:'linear-gradient(to right, var(--violet), var(--blue))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Managed Smart</span>
        </h1>
        <p style={{ fontSize:15, color:'var(--text-secondary)', maxWidth:500, margin:'0 auto 40px', lineHeight:1.6 }}>
          Search for your hostel, join with your <strong style={{ color:'var(--text)' }}>@mitaoe.ac.in</strong> email, and get settled in. Wardens can map entire hostel blocks with a few clicks.
        </p>

        <form onSubmit={handleSearch} style={{ display:'flex', gap:8, maxWidth:500, margin:'0 auto 24px' }}>
          <input className="input" style={{ flex:1, padding:'14px 18px', fontSize:14 }} placeholder="Search for your hostel (e.g. Boys Hostel A) ..." value={query} onChange={e=>setQuery(e.target.value)} />
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ padding:'0 24px' }}>
            {loading ? '...' : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            )}
          </button>
        </form>

        {searched && results.length===0 && (
          <p style={{ fontSize:13, color:'var(--text-ghost)', marginTop:12 }}>No hostels found. Is your warden registered? Ask them to create your hostel first.</p>
        )}

        {results.length > 0 && (
          <div style={{ display:'grid', gap:12, maxWidth:500, margin:'0 auto' }}>
            {results.map(h => (
              <div key={h.id} className="card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', textAlign:'left' }}>
                <div>
                  <h3 style={{ fontFamily:'var(--font-heading)', fontSize:15, margin:0, color:'var(--text)' }}>{h.name}</h3>
                  <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>{h.collegeName}</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={()=>handleJoin(h.id)}>Join</button>
              </div>
            ))}
          </div>
        )}

        <div className="divider" style={{ maxWidth:300, margin:'40px auto' }}>or</div>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16, flexWrap:'wrap' }}>
          <button className="btn btn-primary" style={{ background:'linear-gradient(to right, #10b981, #3b82f6)', border:'none' }} onClick={() => document.getElementById('demo-modal').showModal()}>
            Try Datathon Demo
          </button>
          <Link to="/register?role=warden" className="btn btn-outline" style={{ textDecoration:'none' }}>
            <svg width="16" height="16" style={{ marginRight: 6 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Warden Registration
          </Link>
        </div>
      </div>
      
      {/* Demo Modal */}
      <dialog id="demo-modal" style={{ padding:0, border:'none', background:'transparent', outline:'none', margin:'auto' }} onClick={(e)=>{if(e.target.id==='demo-modal')e.target.close()}}>
        <div style={{ background:'var(--bg-base)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:32, width:400, maxWidth:'90vw' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <h3 style={{ fontFamily:'var(--font-heading)', fontSize:18, margin:0, color: 'var(--text)' }}>PS-15 Demo Mode</h3>
            <button className="btn btn-ghost btn-sm" style={{ padding:4 }} onClick={()=>document.getElementById('demo-modal').close()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <DemoCardBody />
        </div>
      </dialog>
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
      <p style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:20 }}>
        Experience the full platform instantly. Click a role below to bypass authentication and enter the populated demo environment.
      </p>

      <div className="alert-info" style={{ marginBottom:20, display:'flex', gap:8, alignItems:'flex-start' }}>
        <svg width="16" height="16" style={{ flexShrink:0, marginTop:2 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        Each role opens in a new tab — open both to see real-time sync side by side.
      </div>

      {error && <div className="alert-error" style={{ marginBottom:16 }}>{error}</div>}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <button className="btn btn-primary btn-full" onClick={()=>handleDemoLogin('student')} disabled={loadingRole!==null} style={{ padding:'12px', justifyContent:'center' }}>
          {loadingRole === 'student' ? '...' : (
            <><svg width="18" height="18" style={{ marginRight: 6 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> Enter as Student</>
          )}
        </button>
        <button className="btn btn-outline btn-full" onClick={()=>handleDemoLogin('warden')} disabled={loadingRole!==null} style={{ padding:'12px', justifyContent:'center' }}>
          {loadingRole === 'warden' ? '...' : (
            <><svg width="18" height="18" style={{ marginRight: 6 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Enter as Warden</>
          )}
        </button>
      </div>
    </div>
  );
}
