import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

const BRANCHES = ['Computer Engineering', 'Information Technology', 'Mechanical Engineering', 'Civil Engineering', 'Electronics', 'Other'];

export default function ProfileSetup() {
  const { user, userDoc, setUserDoc } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(userDoc?.name || user?.displayName || '');
  const [prn, setPrn] = useState(userDoc?.prn || '');
  const [branch, setBranch] = useState(userDoc?.branch || '');
  const [year, setYear] = useState(userDoc?.year || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !prn.trim() || !branch || !year) { setError('Please fill in all fields.'); return; }
    if (prn.trim().length !== 12) { setError('PRN must be exactly 12 digits.'); return; }
    setLoading(true); setError('');
    try {
      const updates = { name: name.trim(), prn: prn.trim(), branch, year, isProfileComplete: true };
      await updateDoc(doc(db, 'users', user.uid), updates);
      setUserDoc(prev => ({ ...prev, ...updates }));
      navigate('/student/room-register');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#F1F5F9', fontSize: 14, fontFamily: 'inherit', outline: 'none' };
  const labelStyle = { fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#475569', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' };

  return (
    <div style={{ fontFamily: "'Sora','Inter',sans-serif", minHeight: '100vh', background: '#08090F', display: 'flex', flexDirection: 'column' }}>
      {/* Steps Header */}
      <div style={{ background: '#131720', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 20px', flexShrink: 0 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 72 }}>
          <div className="nav-steps-responsive" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.4 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>✓</div>
              <span className="step-label" style={{ fontSize: 12, fontWeight: 600 }}>Role Selection</span>
            </div>
            <div className="step-connector" style={{ width: 32, height: 1, background: '#10B981' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#6C63FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>2</div>
              <span className="step-label" style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9' }}>Profile Setup</span>
            </div>
            <div className="step-connector" style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.4 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>3</div>
              <span className="step-label" style={{ fontSize: 12, fontWeight: 600 }}>Verify Room</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div className="grid-2 responsive" style={{ maxWidth: 900, width: '100%', gap: 40 }}>
          
          {/* Left Side: Info */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 32, fontWeight: 700, color: '#F1F5F9', marginBottom: 12, lineHeight: 1.1 }}>Complete your profile.</h2>
              <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6 }}>One-time setup before you can join your room. Takes about a minute.</p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 }}>
              <span className="material-icons-round" style={{ color: '#475569', fontSize: 18 }}>lock</span>
              <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>Email is locked — verified via <span style={{ color: '#6C63FF' }}>Google OAuth</span> and cannot be changed.</p>
            </div>
          </div>

          {/* Right Side: Form */}
          <div style={{ background: '#131720', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 24, padding: 32 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ef4444' }}>{error}</div>}
              
              <div className="grid-2 responsive" style={{ gap: 16 }}>
                <div>
                  <div style={labelStyle}>Full Name</div>
                  <input style={inputStyle} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" />
                </div>
                <div>
                  <div style={labelStyle}>PRN <span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.6 }}>{prn.length}/12</span></div>
                  <input style={inputStyle} type="text" value={prn} onChange={e => setPrn(e.target.value.replace(/\D/g,'').slice(0,12))} placeholder="PRN Number" />
                </div>
              </div>

              <div>
                <div style={labelStyle}>Branch</div>
                <select style={{ ...inputStyle, background: 'rgba(255,255,255,0.04)', color: branch ? '#F1F5F9' : '#475569' }} value={branch} onChange={e => setBranch(e.target.value)}>
                  <option value="">Select your branch</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <div style={labelStyle}>Year of study</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {['1st','2nd','3rd','4th'].map(y => (
                    <button key={y} onClick={() => setYear(y)} style={{ height: 44, borderRadius: 10, border: `1px solid ${year === y ? '#6C63FF' : 'rgba(255,255,255,0.08)'}`, background: year === y ? '#6C63FF' : 'transparent', color: year === y ? '#fff' : '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleSubmit} disabled={loading} style={{ width: '100%', height: 48, background: '#6C63FF', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8 }}>
                {loading ? 'Saving…' : 'Continue to Room Registration →'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
