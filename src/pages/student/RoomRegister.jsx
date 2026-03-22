import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { resolveRoomByCode, joinRoomTransaction } from '../../firebase/firestore';
import { Scanner } from '@yudiel/react-qr-scanner';

export default function RoomRegister() {
  const { user, userDoc, setUserDoc } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [chars, setChars] = useState(['','','','','','']);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [error, setError] = useState('');
  const refs = [useRef(),useRef(),useRef(),useRef(),useRef(),useRef()];

  const code = chars.join('').toUpperCase();

  const handleChar = (i, val) => {
    const v = val.replace(/[^a-zA-Z0-9]/g,'').toUpperCase().slice(-1);
    const next = [...chars]; next[i] = v; setChars(next);
    if (v && i < 5) refs[i+1].current?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !chars[i] && i > 0) refs[i-1].current?.focus();
  };

  const handleResolveCode = async (codeStr) => {
    if (!codeStr) return;
    
    let targetCode = typeof codeStr === 'string' ? codeStr.trim() : String(codeStr).trim();

    // Handle full URL variants: https://.../, http://.../, or just the path
    if (targetCode.includes('/room/')) {
      const afterRoom = targetCode.split('/room/')[1];
      if (afterRoom) {
        const segments = afterRoom.split('/').filter(Boolean);
        const roomId = segments[segments.length - 1];
        targetCode = roomId.slice(-6);
      }
    } else if (targetCode.length > 6) {
      targetCode = targetCode.slice(-6);
    }

    targetCode = targetCode.toUpperCase();

    if (targetCode.length < 6) { 
      setError('Invalid room code. Make sure you\'re scanning the QR code on your room door, or ask your warden for the 6-character code.'); 
      return; 
    }

    setLoading(true); 
    setError('');
    
    try {
      const roomData = await resolveRoomByCode(targetCode);
      if (!roomData) { 
        setError(`Room code "${targetCode}" not found. Please check the code and try again.`); 
        setLoading(false); 
        return; 
      }
      
      await joinRoomTransaction(user.uid, roomData, {
        name: userDoc.name,
        PRN_hash: userDoc.PRN_hash || user.uid
      });

      setUserDoc(prev => ({ ...prev, ...roomData, isRegistered: true }));
      navigate('/student/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => handleResolveCode(code);

  // Handle prefill from URL (e.g. from RoomLanding redirect)
  useEffect(() => {
    const prefill = searchParams.get('prefill');
    if (prefill) {
      handleResolveCode(prefill);
    }
  }, [searchParams]);

  return (
    <div style={{ fontFamily: "'Sora','Inter',sans-serif", height: '100vh', background: '#060810', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Navbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none"><polygon points="16,2 28,9 28,23 16,30 4,23 4,9" stroke="#6C63FF" strokeWidth="1.5"/><path d="M16 9 L16 16 L20 19" stroke="#6C63FF" strokeWidth="1.8" strokeLinecap="round"/></svg>
          Fix My Hostel
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {[['✓','Role','done'],['✓','Profile','done'],['3','Room','active']].map(([n,l,s],i) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {i > 0 && <div style={{ width: 24, height: 1, background: '#10B981' }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: s === 'active' ? '#F1F5F9' : '#10B981' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, background: s === 'active' ? '#6C63FF' : '#10B981', color: '#fff' }}>{n}</div>
                {l}
              </div>
            </div>
          ))}
        </div>
        <div style={{ width: 120 }} />
      </div>

      {/* Body — 50/50 split */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
        {/* Left — QR scanner */}
        <div style={{ background: '#0E1015', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, padding: 36 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155', marginBottom: 28 }}>{showScanner ? 'Scanning...' : 'Scan QR on your room door'}</div>
          
          <div style={{ width: 240, height: 240, position: 'relative', marginBottom: 28 }}>
            {[['tl','top:-1px;left:-1px;border-width:3px 0 0 3px;border-radius:6px 0 0 0'],['tr','top:-1px;right:-1px;border-width:3px 3px 0 0;border-radius:0 6px 0 0'],['bl','bottom:-1px;left:-1px;border-width:0 0 3px 3px;border-radius:0 0 0 6px'],['br','bottom:-1px;right:-1px;border-width:0 3px 3px 0;border-radius:0 0 6px 0']].map(([k]) => (
              <div key={k} style={{ position: 'absolute', width: 22, height: 22, borderColor: '#6C63FF', borderStyle: 'solid', zIndex: 10, ...(k==='tl'?{top:-1,left:-1,borderWidth:'3px 0 0 3px',borderRadius:'6px 0 0 0'}:k==='tr'?{top:-1,right:-1,borderWidth:'3px 3px 0 0',borderRadius:'0 6px 0 0'}:k==='bl'?{bottom:-1,left:-1,borderWidth:'0 0 3px 3px',borderRadius:'0 0 0 6px'}:{bottom:-1,right:-1,borderWidth:'0 3px 3px 0',borderRadius:'0 0 6px 0'}) }} />
            ))}
            <div style={{ width: '100%', height: '100%', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {showScanner ? (
                <Scanner
                  onScan={(result) => {
                    if (!result) return;
                    const val = Array.isArray(result) ? result[0].rawValue : (result.rawValue || result.text || result);
                    if (val) {
                      const lastSegment = val.split('/').filter(Boolean).pop().trim().toUpperCase();
                      const extracted = lastSegment.slice(-6); 
                      setShowScanner(false);
                      handleResolveCode(extracted);
                    }
                  }}
                  onError={(err) => {
                    console.error("Scanner error:", err);
                    setError("Camera access or scanning failed. Please try manual entry.");
                    setShowScanner(false);
                  }}
                  styles={{ container: { width: '100%', height: '100%' } }}
                />
              ) : (
                <svg width="100" height="100" viewBox="0 0 80 80" fill="none">
                  <rect x="8" y="8" width="22" height="22" rx="3" stroke="rgba(108,99,255,0.25)" strokeWidth="1.5"/>
                  <rect x="12" y="12" width="14" height="14" rx="1" fill="rgba(108,99,255,0.18)"/>
                  <rect x="50" y="8" width="22" height="22" rx="3" stroke="rgba(108,99,255,0.25)" strokeWidth="1.5"/>
                  <rect x="54" y="12" width="14" height="14" rx="1" fill="rgba(108,99,255,0.18)"/>
                  <rect x="8" y="50" width="22" height="22" rx="3" stroke="rgba(108,99,255,0.25)" strokeWidth="1.5"/>
                  <rect x="12" y="54" width="14" height="14" rx="1" fill="rgba(108,99,255,0.18)"/>
                  <rect x="50" y="50" width="8" height="8" rx="1" fill="rgba(108,99,255,0.15)"/>
                  <rect x="62" y="50" width="8" height="8" rx="1" fill="rgba(108,99,255,0.15)"/>
                  <rect x="50" y="62" width="8" height="8" rx="1" fill="rgba(108,99,255,0.15)"/>
                  <rect x="62" y="62" width="8" height="8" rx="1" fill="rgba(108,99,255,0.15)"/>
                </svg>
              )}
            </div>
          </div>

          <button onClick={() => setShowScanner(!showScanner)} style={{ width: '100%', maxWidth: 220, padding: 13, background: showScanner ? '#1E293B' : '#6C63FF', border: 'none', borderRadius: 12, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            {showScanner ? 'Cancel Scan' : 'Open Camera'}
          </button>
          <div style={{ fontSize: 11, color: '#1E293B', marginTop: 14 }}>or enter code on the right</div>
        </div>

        {/* Right — manual code */}
        <div style={{ padding: '36px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6C63FF', background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.2)', padding: '4px 10px', borderRadius: 4, display: 'inline-block', marginBottom: 20 }}>Final step</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.05em', lineHeight: 1.0, marginBottom: 8 }}>Join your<br/>room.</div>
          <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.7, marginBottom: 32 }}>Scan the QR on your door or type the 6-character code printed below it.</div>

          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '9px 13px', fontSize: 12, color: '#ef4444', marginBottom: 16 }}>{error}</div>}

          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155', marginBottom: 10 }}>Room code</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {chars.map((ch, i) => (
              <input
                key={i}
                ref={refs[i]}
                value={ch}
                onChange={e => handleChar(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                maxLength={1}
                style={{
                  width: 48, height: 56, borderRadius: 10, textAlign: 'center',
                  border: `1px solid ${ch ? '#6C63FF' : 'rgba(255,255,255,0.09)'}`,
                  background: ch ? 'rgba(108,99,255,0.08)' : 'rgba(255,255,255,0.04)',
                  color: '#F1F5F9', fontSize: 22, fontWeight: 700,
                  fontFamily: "'Courier New', monospace",
                  outline: 'none', cursor: 'text', textTransform: 'uppercase',
                }}
              />
            ))}
          </div>
          <button onClick={handleSearch} disabled={loading} style={{ width: '100%', padding: 13, borderRadius: 10, background: code.length === 6 ? '#6C63FF' : 'rgba(108,99,255,0.3)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: code.length === 6 && !loading ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
            {loading ? 'Searching…' : 'Search Room'}
          </button>
          <div style={{ fontSize: 11, color: '#1E293B', marginTop: 12 }}>
            No code?{' '}
            <span onClick={() => navigate('/')} style={{ color: '#6C63FF', fontWeight: 600, cursor: 'pointer' }}>Find your hostel</span>
            {' '}on the home page or ask your warden.
          </div>
        </div>
      </div>
    </div>
  );
}
