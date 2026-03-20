import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scanner } from '@yudiel/react-qr-scanner';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { resolveRoomByCode, joinRoomWithCodeData } from '../../firebase/firestore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

export default function JoinHostel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [manualCode, setManualCode] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolvedRoom, setResolvedRoom] = useState(null); // { roomData, hostelName }
  const [cameraActive, setCameraActive] = useState(false);
  
  const handleResolveCode = async (codeStr) => {
    if (!codeStr || codeStr.length < 6) return;
    setResolving(true);
    setError('');
    try {
      // If they scanned the full URL, extract the last bit
      let codeToSearch = typeof codeStr === 'string' ? codeStr : String(codeStr);
      if (codeToSearch.includes('/room/')) {
        const parts = codeToSearch.split('/');
        codeToSearch = parts[parts.length - 1].slice(-6);
      } else {
         codeToSearch = codeToSearch.slice(-6);
      }

      const roomData = await resolveRoomByCode(codeToSearch);
      if (!roomData) throw new Error("Invalid or unrecognized Room Code.");
      
      const hostelSnap = await getDoc(doc(db, 'hostels', roomData.hostelId));
      let hName = 'Unknown Hostel';
      if (hostelSnap.exists()) hName = hostelSnap.data().name;

      setResolvedRoom({ roomData, hostelName: hName });
    } catch (err) {
      setError(err.message);
    } finally {
      setResolving(false);
    }
  };

  const handleConfirmJoin = async () => {
    setLoading(true);
    setError('');
    try {
      await joinRoomWithCodeData(user.uid, resolvedRoom.roomData);
      navigate('/student/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <Navbar />
      <div className="join-page center-page" style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div className="auth-card animation-fade-in" style={{ maxWidth: '500px', width: '100%' }}>
          
          {!resolvedRoom ? (
            <>
              <h2 className="auth-title">Join Your Room</h2>
              <p className="auth-subtitle mb-3">Scan the QR code on your door, or enter the 6-character room code.</p>
              
              {error && <div className="form-error">{error}</div>}

              {cameraActive ? (
                <div style={{ borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--border)', marginBottom: '1.5rem', background: '#000', position: 'relative' }}>
                  <Scanner 
                    onScan={(result) => {
                      if (!result) return;
                      const val = Array.isArray(result) ? result[0].rawValue : (result.rawValue || result.text || result);
                      if (val) handleResolveCode(val);
                    }} 
                    components={{ audio: false }}
                  />
                  <button className="btn btn-sm btn-ghost" style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)', color: 'white' }} onClick={() => setCameraActive(false)}>Close Camera</button>
                </div>
              ) : (
                <button className="btn btn-outline btn-full mb-3" onClick={() => setCameraActive(true)}>
                  📷 Scan Room QR Code
                </button>
              )}

              <div className="divider">OR ENTER MANUALLY</div>

              <div className="flex gap-2">
                <input 
                  className="form-input flex-1" 
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
               <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚪</div>
               <h2 className="font-bold mb-1">Confirm Room</h2>
               <p className="text-muted mb-3" style={{ lineHeight: 1.5 }}>
                 You're joining <strong>Room {resolvedRoom.roomData.roomNumber}</strong><br/>
                 <span style={{ fontSize: '0.9rem' }}>{resolvedRoom.hostelName}</span>
               </p>
               
               {error && <div className="form-error text-left">{error}</div>}

               <div className="flex gap-2 mt-3">
                  <button className="btn btn-ghost flex-1" onClick={() => setResolvedRoom(null)} disabled={loading}>Back</button>
                  <button className="btn btn-primary flex-1" onClick={handleConfirmJoin} disabled={loading}>
                    {loading ? 'Joining...' : 'Confirm'}
                  </button>
               </div>
             </div>
          )}

        </div>
      </div>
    </div>
  );
}
