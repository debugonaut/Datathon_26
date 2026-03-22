import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

export default function SetupRole() {
  const { user, setUserDoc } = useAuth();
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleContinue = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const uDoc = {
        uid: user.uid,
        email: user.email,
        name: user.displayName || '',
        role,
        createdAt: Timestamp.now(),
      };
      await setDoc(doc(db, 'users', user.uid), uDoc, { merge: true });
      setUserDoc(uDoc);
      if (role === 'student') navigate('/student/profile-setup');
      else navigate('/warden/setup-hostel');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const firstName = (user?.displayName || 'there').split(' ')[0];
  const email = user?.email || '';

  const tile = (r, label, desc, feats, iconPath, iconColor, iconBg, wm) => (
    <button
      onClick={() => setRole(r)}
      style={{
        padding: '24px 28px', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', cursor: 'pointer', border: 'none',
        fontFamily: 'inherit', textAlign: 'left', position: 'relative',
        overflow: 'hidden', transition: 'background 0.2s',
        background: role === r ? 'rgba(108,99,255,0.07)' : '#060810',
        borderRight: r === 'student' ? '1px solid rgba(255,255,255,0.05)' : 'none',
      }}
    >
      {/* Watermark */}
      <div style={{
        position: 'absolute', fontSize: 90, fontWeight: 700, lineHeight: 1,
        bottom: -8, right: -6, letterSpacing: '-0.05em', pointerEvents: 'none',
        opacity: role === r ? 0.07 : 0.025, color: role === r ? '#6C63FF' : '#fff',
      }}>{wm}</div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Selection dot */}
        <div style={{
          width: 9, height: 9, borderRadius: '50%', marginBottom: 16,
          border: `2px solid ${role === r ? '#6C63FF' : '#1E293B'}`,
          background: role === r ? '#6C63FF' : 'transparent',
        }} />
        {/* Icon */}
        <div style={{ width: 40, height: 40, borderRadius: 11, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.8">{iconPath}</svg>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.04em', marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.6, maxWidth: 220 }}>{desc}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', zIndex: 1 }}>
        {feats.map(f => (
          <div key={f} style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: role === r ? '#6C63FF' : '#334155', flexShrink: 0 }} />
            {f}
          </div>
        ))}
      </div>
    </button>
  );

  return (
    <div style={{ fontFamily: "'Sora','Inter',sans-serif", height: '100vh', background: '#060810', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Navbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none"><polygon points="16,2 28,9 28,23 16,30 4,23 4,9" stroke="#6C63FF" strokeWidth="1.5"/><path d="M16 9 L16 16 L20 19" stroke="#6C63FF" strokeWidth="1.8" strokeLinecap="round"/></svg>
          Fix My Hostel
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#6C63FF', background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.2)', padding: '3px 9px', borderRadius: 4 }}>
          PS-15 · Datathon 2026
        </div>
      </div>

      {/* Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1 }}>
        {tile('student', 'Student',
          'Raise hostel complaints in 60 seconds, track them live, see warden ETA in real time.',
          ['Raise complaints with media', 'Live status tracking', 'Room score dashboard'],
          <><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></>,
          '#a89fff', 'rgba(108,99,255,0.12)', 'S'
        )}
        {tile('warden', 'Warden',
          'Manage all complaints from one dashboard. AI triage, SLA timers, cluster alerts.',
          ['AI-triaged kanban board', 'SLA breach alerts', 'Cluster detection'],
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
          '#10B981', 'rgba(16,185,129,0.1)', 'W'
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '13px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#6C63FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
            {firstName[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9' }}>Welcome, {firstName}!</div>
            <div style={{ fontSize: 10, color: '#334155' }}>{email}</div>
          </div>
        </div>
        <button onClick={handleContinue} disabled={loading} style={{ padding: '10px 22px', background: '#6C63FF', border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Setting up…' : `Continue as ${role === 'student' ? 'Student' : 'Warden'} →`}
        </button>
      </div>
    </div>
  );
}
