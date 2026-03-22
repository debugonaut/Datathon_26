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
      const updates = { name: name.trim(), prn: prn.trim(), branch, year, profileComplete: true };
      await updateDoc(doc(db, 'users', user.uid), updates);
      setUserDoc(prev => ({ ...prev, ...updates }));
      navigate('/student/room-register');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#F1F5F9', fontSize: 14, fontFamily: 'inherit', outline: 'none' };
  const labelStyle = { fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#334155', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' };

  return (
    <div style={{ fontFamily: "'Sora','Inter',sans-serif", height: '100vh', background: '#08090F', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Navbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none"><polygon points="16,2 28,9 28,23 16,30 4,23 4,9" stroke="#6C63FF" strokeWidth="1.5"/><path d="M16 9 L16 16 L20 19" stroke="#6C63FF" strokeWidth="1.8" strokeLinecap="round"/></svg>
          Fix My Hostel
        </div>
        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {[['✓','Role','done'],['2','Profile','active'],['3','Room','idle']].map(([n,l,s],i) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {i > 0 && <div style={{ width: 24, height: 1, background: s === 'idle' ? 'rgba(255,255,255,0.07)' : '#10B981' }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: s === 'done' ? '#10B981' : s === 'active' ? '#F1F5F9' : '#1E293B' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, background: s === 'done' ? '#10B981' : s === 'active' ? '#6C63FF' : 'rgba(255,255,255,0.05)', color: s === 'idle' ? '#1E293B' : '#fff' }}>{n}</div>
                {l}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#6C63FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>AK</div>
          <div style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>{userDoc?.name || user?.displayName} · student</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}>
        {/* Left column */}
        <div style={{ width: 260, flexShrink: 0, padding: '36px 32px', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 12 }}>Complete<br/>your<br/>profile.</div>
            <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.7 }}>One-time setup before you can join your room. Takes about a minute.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.6 }}>Email is locked — verified via <span style={{ color: '#6C63FF' }}>Google OAuth</span> and cannot be changed.</div>
          </div>
        </div>

        {/* Fields */}
        <div style={{ flex: 1, padding: '28px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '9px 13px', fontSize: 12, color: '#ef4444' }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={labelStyle}>Full Name</div>
              <input style={inputStyle} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
            </div>
            <div>
              <div style={labelStyle}>College Email</div>
              <input style={{ ...inputStyle, color: '#334155', cursor: 'not-allowed', borderColor: 'rgba(255,255,255,0.04)' }} type="email" value={user?.email || ''} readOnly />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={labelStyle}>PRN <span style={{ fontSize: 10, color: '#1E293B', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{prn.length}/12 digits</span></div>
              <input style={inputStyle} type="text" value={prn} onChange={e => setPrn(e.target.value.replace(/\D/g,'').slice(0,12))} placeholder="e.g. 211090100001" />
            </div>
            <div>
              <div style={labelStyle}>Branch</div>
              <select style={{ ...inputStyle, color: branch ? '#F1F5F9' : '#334155' }} value={branch} onChange={e => setBranch(e.target.value)}>
                <option value="">Select your branch</option>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div style={labelStyle}>Year of study</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {['1st','2nd','3rd','4th'].map(y => (
                <button key={y} onClick={() => setYear(y)} style={{ padding: '10px 0', borderRadius: 9, border: `1px solid ${year === y ? '#6C63FF' : 'rgba(255,255,255,0.07)'}`, background: year === y ? '#6C63FF' : 'transparent', color: year === y ? '#fff' : '#1E293B', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '14px 36px 14px 296px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
        <button onClick={handleSubmit} disabled={loading} style={{ padding: '12px 28px', background: '#6C63FF', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Saving…' : 'Continue to Room Registration →'}
        </button>
      </div>
    </div>
  );
}
