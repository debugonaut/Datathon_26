import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { resolveRoomByCode, joinRoomTransaction } from '../../firebase/firestore';
import { fetchRoomHistory, generateRoomSummary } from '../../firebase/roomHistory';
import { Scanner } from '@yudiel/react-qr-scanner';

export default function RoomRegister() {
  const { user, userDoc, setUserDoc } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');
  
  const [inspectingRoom, setInspectingRoom] = useState(null);
  const [roomHistory, setRoomHistory] = useState([]);
  const [roomSummary, setRoomSummary] = useState(null);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  const [wardenEmail, setWardenEmail] = useState('');
  const [showWardenContact, setShowWardenContact] = useState(false);

  const handleResolveCode = async (codeStr) => {
    if (!codeStr) return;
    let targetCode = typeof codeStr === 'string' ? codeStr.trim() : String(codeStr).trim();

    if (targetCode.includes('/room/')) {
      const parts = targetCode.split('/');
      targetCode = parts[parts.length - 1].slice(-6);
    } else if (targetCode.length > 6) {
      targetCode = targetCode.slice(-6);
    }

    targetCode = targetCode.toUpperCase();
    if (targetCode.length < 6) return;

    setResolving(true);
    setError('');
    
    try {
      const roomData = await resolveRoomByCode(targetCode);
      if (!roomData) { 
        setError(`Room code "${targetCode}" not found.`); 
        return; 
      }
      
      // Fetch warden contact info
      const hostelSnap = await getDoc(doc(db, 'hostels', roomData.hostelId));
      if (hostelSnap.exists()) {
        const wardenId = hostelSnap.data().wardenId;
        const wardenSnap = await getDoc(doc(db, 'users', wardenId));
        if (wardenSnap.exists()) setWardenEmail(wardenSnap.data().email);
      }

      setInspectionLoading(true);
      const history = await fetchRoomHistory(roomData.roomId);
      setRoomHistory(history);
      if (history.length > 0) {
        setRoomSummary(await generateRoomSummary(history));
      }
      setInspectionLoading(false);
      setInspectingRoom(roomData);
    } catch (err) {
      setError(err.message);
    } finally {
      setResolving(false);
    }
  };

  const handleAcceptRoom = async () => {
    setLoading(true);
    try {
      await joinRoomTransaction(user.uid, inspectingRoom, {
        name: userDoc.name,
        PRN_hash: userDoc.PRN_hash || user.uid
      });
      setUserDoc(prev => ({ ...prev, ...inspectingRoom, isRegistered: true }));
      navigate('/student/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const prefill = searchParams.get('prefill');
    if (prefill) handleResolveCode(prefill);
  }, [searchParams]);

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", minHeight: '100vh', background: '#060810', display: 'flex', flexDirection: 'column' }}>
      {/* Steps Header */}
      <div style={{ background: '#131720', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 20px', flexShrink: 0 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 72 }}>
          <div className="nav-steps-responsive" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.4 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>1</div>
              <span className="step-label" style={{ fontSize: 12, fontWeight: 600 }}>Role Selection</span>
            </div>
            <div className="step-connector" style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.4 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>2</div>
              <span className="step-label" style={{ fontSize: 12, fontWeight: 600 }}>Profile Setup</span>
            </div>
            <div className="step-connector" style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#6C63FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>3</div>
              <span className="step-label" style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9' }}>Verify Room</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: inspectingRoom ? 600 : 850 }}>
          
          {!inspectingRoom ? (
            <div className="grid-2 responsive" style={{ gap: 24 }}>
              {/* Left: QR Interaction */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ background: '#131720', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 32, textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(108,99,255,0.1)', color: '#6C63FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <span className="material-icons-round">qr_code_scanner</span>
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9', marginBottom: 8 }}>Scan Room QR</h3>
                  <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, marginBottom: 24 }}>Point your camera at the QR code on your room door</p>
                  
                  {cameraActive ? (
                    <div style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid #6C63FF', background: '#000', position: 'relative' }}>
                      <Scanner 
                        onScan={(result) => {
                          if (!result) return;
                          const val = Array.isArray(result) ? result[0].rawValue : (result.rawValue || result.text || result);
                          if (val) handleResolveCode(val);
                        }} 
                        components={{ audio: false }}
                      />
                      <button onClick={() => setCameraActive(false)} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Close</button>
                    </div>
                  ) : (
                    <button onClick={() => setCameraActive(true)} style={{ width: '100%', background: '#6C63FF', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span className="material-icons-round" style={{ fontSize: 18 }}>videocam</span>
                      Open Camera
                    </button>
                  )}
                </div>
              </div>

              {/* Right: Manual Code */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.15em', marginBottom: 16 }}>OR ENTER MANUALLY</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                      style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px', color: '#F1F5F9', textAlign: 'center', fontSize: 18, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase' }}
                      placeholder="CODE"
                      value={manualCode}
                      onChange={e => setManualCode(e.target.value.toUpperCase())}
                      maxLength={6}
                    />
                    <button 
                      onClick={() => handleResolveCode(manualCode)}
                      disabled={manualCode.length < 6 || resolving}
                      style={{ background: manualCode.length === 6 ? '#6C63FF' : 'rgba(255,255,255,0.05)', color: manualCode.length === 6 ? '#fff' : '#475569', border: 'none', borderRadius: 10, padding: '0 20px', fontWeight: 600, cursor: manualCode.length === 6 ? 'pointer' : 'default' }}
                    >
                      {resolving ? '...' : 'Verify'}
                    </button>
                  </div>
                  {error && <div style={{ marginTop: 12, color: '#EF4444', fontSize: 12 }}>{error}</div>}
                </div>
              </div>
            </div>
          ) : (
            /* Inspection View */
            <div className="animation-fade-in" style={{ background: '#131720', borderRadius: 24, padding: 32, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, color: '#F1F5F9' }}>Room {inspectingRoom.roomNumber}</h2>
                  <p style={{ fontSize: 14, color: '#475569', marginTop: 4 }}>Please review the room history before accepting.</p>
                </div>
                <button onClick={() => setInspectingRoom(null)} style={{ background: 'none', border: 'none', color: '#6C63FF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Change Room</button>
              </div>

              {showWardenContact ? (
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
                  <span className="material-icons-round" style={{ fontSize: 40, color: '#EF4444', marginBottom: 16 }}>contact_support</span>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9', marginBottom: 8 }}>Contact Warden</h3>
                  <p style={{ fontSize: 14, color: '#E2E8F0', lineHeight: 1.6, marginBottom: 20 }}>Please reach out to your warden for reallocation.</p>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8, color: '#6C63FF', fontWeight: 600, fontFamily: 'monospace', marginBottom: 20 }}>
                    {wardenEmail || 'warden@mitaoe.ac.in'}
                  </div>
                  <button onClick={() => setShowWardenContact(false)} className="btn btn-ghost btn-sm">Go Back</button>
                </div>
              ) : (
                <>
                  {roomSummary?.aiSummary && (
                    <div style={{ background: 'rgba(108,99,255,0.05)', border: '1px solid rgba(108,99,255,0.15)', borderRadius: 12, padding: 16, marginBottom: 24, fontSize: 13.5, color: '#E2E8F0', lineHeight: 1.6, fontStyle: 'italic' }}>
                      "{roomSummary.aiSummary}"
                    </div>
                  )}

                  <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 16, padding: 20, marginBottom: 32, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                      Recent Issues 
                      <span style={{ color: '#475569', fontWeight: 400 }}>{roomHistory.length} total</span>
                    </div>
                    {roomHistory.length === 0 ? (
                      <p style={{ fontSize: 13, color: '#10B981' }}>✓ No complaints recorded for this room.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {roomHistory.slice(0, 3).map(c => (
                          <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.status === 'resolved' ? '#10B981' : '#F59E0B' }} />
                            <div style={{ flex: 1, fontSize: 13, color: '#E2E8F0' }}>{c.title}</div>
                            <div style={{ fontSize: 11, color: '#475569' }}>{c.status}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={handleAcceptRoom} disabled={loading} style={{ flex: 1, height: 48, background: '#6C63FF', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {loading ? 'Joining...' : 'Accept Room'}
                    </button>
                    <button onClick={() => setShowWardenContact(true)} style={{ flex: 1, height: 48, background: 'transparent', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Report Issue
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
