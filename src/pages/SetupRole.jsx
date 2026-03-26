import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

export default function SetupRole() {
  const { user, setUserDoc } = useAuth();
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const firstName = (user?.displayName || 'there').split(' ')[0];
  const email = user?.email || '';

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
      else navigate('/warden/setup');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const tiles = [
    {
      r: 'student',
      wm: 'S',
      label: 'Student',
      desc: 'Raise hostel complaints in 60 seconds, track them live, see warden ETA in real time.',
      feats: ['Raise complaints with media', 'Live status tracking', 'Room score dashboard'],
      iconBg: 'rgba(108,99,255,0.18)',
      iconColor: '#a89fff',
      iconPath: (
        <>
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </>
      ),
    },
    {
      r: 'warden',
      wm: 'W',
      label: 'Warden',
      desc: 'Manage all complaints from one dashboard. AI triage, SLA timers, cluster alerts.',
      feats: ['AI-triaged kanban board', 'SLA breach alerts', 'Cluster detection'],
      iconBg: 'rgba(16,185,129,0.15)',
      iconColor: '#10B981',
      iconPath: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    },
  ];

  return (
    <div style={{
      fontFamily: "'Sora','Inter',sans-serif",
      height: '100vh',
      background: '#060810',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* Navbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em', textDecoration: 'none' }}>
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
            <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" stroke="#6C63FF" strokeWidth="1.5" />
            <path d="M16 9 L16 16 L20 19" stroke="#6C63FF" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Fix My Hostel
        </Link>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
          color: '#6C63FF', background: 'rgba(108,99,255,0.1)',
          border: '1px solid rgba(108,99,255,0.2)', padding: '3px 9px', borderRadius: 4,
        }}>
          PS-15 · Datathon 2026
        </div>
      </div>

      {/* Full-bleed tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1 }}>
        {tiles.map(({ r, wm, label, desc, feats, iconBg, iconColor, iconPath }) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            style={{
              padding: '24px 28px',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              cursor: 'pointer', border: 'none', fontFamily: 'inherit', textAlign: 'left',
              position: 'relative', overflow: 'hidden', transition: 'background 0.2s',
              background: role === r ? 'rgba(108,99,255,0.07)' : '#060810',
              borderRight: r === 'student' ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}
          >
            {/* Watermark */}
            <div style={{
              position: 'absolute', fontSize: 90, fontWeight: 700, lineHeight: 1,
              bottom: -8, right: -6, letterSpacing: '-0.05em', pointerEvents: 'none',
              opacity: role === r ? 0.07 : 0.025,
              color: role === r ? '#6C63FF' : '#fff',
            }}>
              {wm}
            </div>

            {/* Top content */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Selection dot */}
              <div style={{
                width: 9, height: 9, borderRadius: '50%', marginBottom: 16,
                border: `2px solid ${role === r ? '#6C63FF' : '#1E293B'}`,
                background: role === r ? '#6C63FF' : 'transparent',
                transition: 'all 0.2s',
              }} />

              {/* Icon */}
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.8">
                  {iconPath}
                </svg>
              </div>

              <div style={{ fontSize: 20, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.04em', marginBottom: 6 }}>
                {label}
              </div>
              <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.6, maxWidth: 220 }}>
                {desc}
              </div>
            </div>

            {/* Feature list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', zIndex: 1 }}>
              {feats.map(f => (
                <div key={f} style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{
                    width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
                    background: role === r ? '#6C63FF' : '#334155',
                    transition: 'background 0.2s',
                  }} />
                  {f}
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '13px 24px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', background: '#6C63FF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff',
          }}>
            {firstName[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9' }}>Welcome, {firstName}!</div>
            <div style={{ fontSize: 10, color: '#334155' }}>{email}</div>
          </div>
        </div>
        <button
          onClick={handleContinue}
          disabled={loading}
          style={{
            padding: '10px 22px', background: '#6C63FF', border: 'none',
            borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', opacity: loading ? 0.7 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {loading ? 'Setting up…' : `Continue as ${role === 'student' ? 'Student' : 'Warden'} →`}
        </button>
      </div>
    </div>
  );
}
