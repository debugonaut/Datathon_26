import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Scanner } from '@yudiel/react-qr-scanner';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { resolveRoomByCode, joinRoomTransaction } from '../../firebase/firestore';

async function computePRNHash(prn) {
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(prn)
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function RoomRegister() {
  const { user, userDoc, setUserDoc } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [manualCode, setManualCode] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolvedRoom, setResolvedRoom] = useState(null);
  const [hostelName, setHostelName] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [occupancyCheck, setOccupancyCheck] = useState(null); // { current, max, isFull }

  // Auto-prefill from pendingRoomId or URL param
  useEffect(() => {
    const prefill = searchParams.get('prefill');
    const pending = localStorage.getItem('pendingRoomId');
    const code = prefill || pending;
    if (code) {
      localStorage.removeItem('pendingRoomId');
      handleResolveCode(code);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResolveCode = async (codeStr) => {
    if (!codeStr || codeStr.length < 6) return;
    setResolving(true);
    setError('');
    setOccupancyCheck(null);

    try {
      let codeToSearch = typeof codeStr === 'string' ? codeStr : String(codeStr);
      if (codeToSearch.includes('/room/')) {
        const parts = codeToSearch.split('/');
        codeToSearch = parts[parts.length - 1].slice(-6);
      } else {
        codeToSearch = codeToSearch.slice(-6);
      }

      const roomData = await resolveRoomByCode(codeToSearch);
      if (!roomData) throw new Error('Invalid or unrecognized Room Code.');

      const hostelSnap = await getDoc(doc(db, 'hostels', roomData.hostelId));
      let hName = 'Unknown Hostel';
      if (hostelSnap.exists()) hName = hostelSnap.data().name;
      setHostelName(hName);

      // Compute occupancy
      const current = roomData.data.currentOccupants || 0;
      const max = roomData.data.maxOccupants || 2;
      setOccupancyCheck({ current, max, isFull: current >= max });

      // Check PRN hash uniqueness
      if (userDoc?.PRN) {
        const prnHash = await computePRNHash(userDoc.PRN);
        const occupants = roomData.data.occupants || [];
        if (occupants.some(o => o.PRN_hash === prnHash)) {
          setError('Your PRN is already registered to this room.');
          setResolving(false);
          return;
        }
      }

      // Check if student is already registered elsewhere
      if (userDoc?.roomId) {
        setError('You are already registered to a room. Contact your warden to change rooms.');
        setResolving(false);
        return;
      }

      setResolvedRoom(roomData);
    } catch (err) {
      setError(err.message);
    } finally {
      setResolving(false);
    }
  };

  const handleConfirmJoin = async () => {
    if (!resolvedRoom || joining) return;
    setJoining(true);
    setError('');

    try {
      const prnHash = await computePRNHash(userDoc.PRN);

      await joinRoomTransaction(user.uid, resolvedRoom, {
        name: userDoc.name,
        PRN_hash: prnHash
      });

      // Update local context
      setUserDoc(prev => ({
        ...prev,
        roomId: resolvedRoom.roomId,
        hostelId: resolvedRoom.hostelId,
        blockId: resolvedRoom.blockId,
        buildingId: resolvedRoom.buildingId,
        floorId: resolvedRoom.floorId,
        roomNumber: resolvedRoom.roomNumber,
        isRegistered: true,
      }));

      setTimeout(() => {
        navigate('/student/dashboard', { replace: true });
      }, 800);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to join room.');
      setJoining(false);
    }
  };

  const occPercent = occupancyCheck ? Math.round((occupancyCheck.current / occupancyCheck.max) * 100) : 0;

  return (
    <div className="page">
      <Navbar />
      <div className="auth-center" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        <div className="auth-card animation-fade-in" style={{ maxWidth: 500, width: '100%' }}>

          {!resolvedRoom ? (
            <>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 1rem', display: 'block' }}>
                <path d="M20 20V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v16M2 20h20M14 12v.01" />
              </svg>
              <h2 className="auth-title">Join Your Room</h2>
              <p className="auth-subtitle mb-3">Scan the QR code on your door, or enter the 6-character room code.</p>

              {error && <div className="form-error">{error}</div>}

              {cameraActive ? (
                <div style={{ borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--border)', marginBottom: '1.5rem', background: '#000', position: 'relative' }}>
                  <Scanner
                    onScan={(result) => {
                      if (!result) return;
                      const val = Array.isArray(result) ? result[0].rawValue : (result.rawValue || result.text || result);
                      if (val) { setCameraActive(false); handleResolveCode(val); }
                    }}
                    components={{ audio: false }}
                  />
                  <button className="btn btn-sm btn-ghost" style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)', color: 'white' }} onClick={() => setCameraActive(false)}>Close Camera</button>
                </div>
              ) : (
                <button className="btn btn-outline btn-full mb-3" onClick={() => setCameraActive(true)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'middle' }}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                  Scan Room QR Code
                </button>
              )}

              <div className="divider">OR ENTER MANUALLY</div>

              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="e.g. A9B2C4"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  style={{ textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center', fontWeight: 'bold' }}
                />
                <button
                  className="btn btn-primary"
                  disabled={manualCode.length < 6 || resolving}
                  onClick={() => handleResolveCode(manualCode)}
                >
                  {resolving ? 'Searching...' : 'Search'}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div style={{
                width: 64, height: 64, margin: '0 auto 1rem', borderRadius: '50%',
                background: occupancyCheck?.isFull ? 'rgba(240,101,101,0.1)' : 'rgba(34,211,160,0.1)',
                color: occupancyCheck?.isFull ? 'var(--red)' : 'var(--green)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem'
              }}>
                {occupancyCheck?.isFull ? '✕' : '✓'}
              </div>

              <h2 className="font-bold mb-1">Room Found</h2>
              <p className="text-secondary mb-3" style={{ lineHeight: 1.5 }}>
                <strong>Room {resolvedRoom.roomNumber}</strong><br />
                <span style={{ fontSize: '0.9rem' }}>{hostelName}</span>
              </p>

              {error && <div className="form-error text-left mb-2">{error}</div>}

              {/* Occupancy Bar */}
              {occupancyCheck && (
                <div style={{
                  background: 'var(--bg-raised)', padding: '1rem', borderRadius: '8px',
                  marginBottom: '1.5rem', border: '1px solid var(--border)'
                }}>
                  <div className="text-xs text-muted mb-1">Occupancy</div>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    {occupancyCheck.current} of {occupancyCheck.max} beds filled
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      width: `${occPercent}%`,
                      background: occupancyCheck.isFull ? 'var(--red)' : occPercent > 75 ? 'var(--amber)' : 'var(--green)',
                      transition: 'width 0.3s'
                    }} />
                  </div>
                  {occupancyCheck.isFull && (
                    <div className="text-xs mt-1" style={{ color: 'var(--red)' }}>
                      This room is full. Please contact your warden.
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button className="btn btn-ghost flex-1" onClick={() => { setResolvedRoom(null); setError(''); setOccupancyCheck(null); }} disabled={joining}>Back</button>
                <button
                  className="btn btn-primary flex-1"
                  onClick={handleConfirmJoin}
                  disabled={joining || occupancyCheck?.isFull || !!error}
                  style={{ padding: '1rem' }}
                >
                  {joining ? 'Joining...' : 'Confirm & Join'}
                </button>
              </div>

              <p className="text-center text-xs text-muted mt-3">
                This action cannot be reversed without warden approval.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
