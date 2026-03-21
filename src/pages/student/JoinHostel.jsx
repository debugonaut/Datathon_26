import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scanner } from '@yudiel/react-qr-scanner';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { resolveRoomByCode, joinRoomWithCodeData } from '../../firebase/firestore';
import { fetchRoomHistory, generateRoomSummary } from '../../firebase/roomHistory';
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

  const [roomHistory, setRoomHistory] = useState(null);
  const [historySummary, setHistorySummary] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch when roomId is resolved
  useEffect(() => {
    if (!resolvedRoom?.roomData?.roomId) return;
    const load = async () => {
      setHistoryLoading(true);
      const history = await fetchRoomHistory(resolvedRoom.roomData.roomId);
      setRoomHistory(history);
      if (history.length > 0) {
        const summary = await generateRoomSummary(history);
        setHistorySummary(summary);
      }
      setHistoryLoading(false);
    };
    load();
  }, [resolvedRoom?.roomData?.roomId]);
  
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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'middle' }}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                  Scan Room QR Code
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
               <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                 <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                   <path d="M20 20V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v16M2 20h20M14 12v.01" />
                 </svg>
               </div>
               <h2 className="font-bold mb-1">Confirm Room</h2>
               <p className="text-muted mb-3" style={{ lineHeight: 1.5 }}>
                 You're joining <strong>Room {resolvedRoom.roomData.roomNumber}</strong><br/>
                 <span style={{ fontSize: '0.9rem' }}>{resolvedRoom.hostelName}</span>
               </p>

               {historyLoading && (
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)',
                   textAlign: 'center', padding: '12px' }}>
                   Loading room history...
                 </div>
               )}

               {!historyLoading && roomHistory !== null && (
                 <div style={{
                   marginTop: '16px', padding: '14px 16px', textShadow: 'none',
                   background: 'rgba(255,255,255,0.03)', textAlign: 'left',
                   border: '1px solid var(--border)', borderRadius: '10px',
                   marginBottom: '1rem'
                 }}>
                   <div style={{ fontWeight: 600, fontSize: '0.85rem',
                     marginBottom: '10px', color: 'var(--text-primary)' }}>
                     Room History
                   </div>

                   {roomHistory.length === 0 ? (
                     <div style={{ fontSize: '0.82rem', color: 'var(--green)' }}>
                       ✓ No complaints on record. This room has a clean history.
                     </div>
                   ) : (
                     <>
                       {historySummary?.aiSummary && (
                         <div style={{
                           fontSize: '0.82rem', color: 'var(--text-muted)',
                           fontStyle: 'italic', marginBottom: '12px',
                           padding: '8px 12px', borderRadius: '8px',
                           background: 'rgba(55,138,221,0.08)',
                           border: '1px solid rgba(55,138,221,0.2)'
                         }}>
                           "{historySummary.aiSummary}"
                         </div>
                       )}

                       <div style={{ display: 'flex', gap: '12px',
                         flexWrap: 'wrap', marginBottom: '12px' }}>
                         {[
                           { label: 'Total complaints', value: historySummary?.total },
                           { label: 'Resolved', value: historySummary?.resolved },
                           { label: 'Top issue', value: historySummary?.topCategory },
                           { label: 'Avg fix time',
                             value: historySummary?.avgResolutionHours
                               ? `${historySummary.avgResolutionHours}h` : 'N/A' },
                         ].map(({ label, value }) => (
                           <div key={label} style={{
                             background: 'rgba(255,255,255,0.04)',
                             borderRadius: '8px', padding: '8px 12px', flex: '1',
                             minWidth: '70px', textAlign: 'center'
                           }}>
                             <div style={{ fontSize: '0.68rem',
                               color: 'var(--text-muted)', marginBottom: '2px' }}>
                               {label}
                             </div>
                             <div style={{ fontSize: '0.9rem', fontWeight: 600,
                               color: 'var(--text-primary)' }}>
                               {value}
                             </div>
                           </div>
                         ))}
                       </div>

                       <div style={{ fontSize: '0.75rem',
                         color: 'var(--text-muted)', marginBottom: '6px' }}>
                         Recent complaints
                       </div>
                       {roomHistory.slice(0, 3).map((c, i) => (
                         <div key={i} style={{
                           display: 'flex', alignItems: 'center',
                           gap: '8px', padding: '5px 0',
                           borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
                           fontSize: '0.78rem'
                         }}>
                           <span style={{
                             width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                             background: c.status === 'resolved' ? 'var(--green)'
                               : c.priority === 'high' ? 'var(--red)' : 'var(--amber)'
                           }} />
                           <span style={{ color: 'var(--text-primary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                             {c.title}
                           </span>
                           <span style={{ color: 'var(--text-muted)' }}>
                             {c.category}
                           </span>
                           <span style={{
                             color: c.status === 'resolved' ? 'var(--green)' : 'var(--text-muted)'
                           }}>
                             {c.status === 'resolved' ? '✓' : '○'}
                           </span>
                         </div>
                       ))}
                       {roomHistory.length > 3 && (
                         <div style={{ fontSize: '0.72rem',
                           color: 'var(--text-muted)', marginTop: '6px' }}>
                           +{roomHistory.length - 3} more complaints on record
                         </div>
                       )}
                     </>
                   )}
                 </div>
               )}
               
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
