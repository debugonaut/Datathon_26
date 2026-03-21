import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { getAnnouncements, markAnnouncementRead } from '../../firebase/firestore';
import { fetchRoomHistory, generateRoomSummary } from '../../firebase/roomHistory';
import StudentAnalytics from '../../components/student/StudentAnalytics';

export default function StudentDashboard() {
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [roomData, setRoomData] = useState(null);
  const [hierarchyNames, setHierarchyNames] = useState({ block: '', building: '', floor: '' });
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [fullRoomHistory, setFullRoomHistory] = useState([]);
  const [roomSummary, setRoomSummary] = useState(null);
  const [showFullHistory, setShowFullHistory] = useState(false);

  useEffect(() => {
    if (!userDoc?.roomId) return;
    fetchRoomHistory(userDoc.roomId).then(history => {
      setFullRoomHistory(history);
      if (history.length > 0) {
        generateRoomSummary(history).then(setRoomSummary);
      }
    });
  }, [userDoc?.roomId]);

  useEffect(() => {
    if (!userDoc?.hostelId) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const { hostelId, blockId, buildingId, floorId, roomId } = userDoc;

        // Fetch Room Data
        const roomRef = doc(db, 'hostels', hostelId, 'blocks', blockId, 'buildings', buildingId, 'floors', floorId, 'rooms', roomId);
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists()) setRoomData(roomSnap.data());

        // Fetch Names
        const [blkSnap, bldSnap, flrSnap] = await Promise.all([
          getDoc(doc(db, 'hostels', hostelId, 'blocks', blockId)),
          getDoc(doc(db, 'hostels', hostelId, 'blocks', blockId, 'buildings', buildingId)),
          getDoc(doc(db, 'hostels', hostelId, 'blocks', blockId, 'buildings', buildingId, 'floors', floorId))
        ]);
        
        setHierarchyNames({
          block: blkSnap.data()?.name || 'Unknown Block',
          building: bldSnap.data()?.name || 'Unknown Building',
          floor: flrSnap.data()?.floorNumber || '0'
        });

        // Fetch Announcements
        const feeds = await getAnnouncements(hostelId);
        setAnnouncements(feeds);
      } catch (err) {
        console.error('Error loading student dashboard data', err);
      }
      setLoading(false);
    };

    loadData();
  }, [userDoc]);

  const handleReadAnnouncement = async (annId, currentReadBy) => {
    if (currentReadBy.includes(user.uid)) return;
    await markAnnouncementRead(annId, user.uid, currentReadBy);
    setAnnouncements(prev => prev.map(a => {
      if (a.id === annId) return { ...a, readBy: [...a.readBy, user.uid] };
      return a;
    }));
  };

  if (loading) return (
    <div className="page">
      <Navbar />
      <div className="loading-screen"><div className="spinner" /></div>
    </div>
  );

  if (!userDoc?.hostelId) {
    return (
      <div className="page">
        <Navbar />
        <div className="center-page text-center">
          <div className="card" style={{ maxWidth: 400 }}>
            <h2>No Hostel Assigned</h2>
            <p className="text-muted mt-1 mb-2">You haven't joined a hostel room yet. Return to the homepage to search and join.</p>
            <button className="btn btn-primary" onClick={() => navigate('/student/join')}>Join with Room QR</button>
          </div>
        </div>
      </div>
    );
  }

  const unreadCount = announcements.filter(a => !a.readBy.includes(user.uid)).length;
  // Score percentage for circle gradient (0 to 100)
  const score = roomData?.score || 0;
  let scoreColor = score <= 40 ? '#ef4444' : score <= 70 ? '#f59e0b' : '#10b981';
  if (score === 0) scoreColor = '#94a3b8';

  return (
    <div className="page">
      <Navbar />
      <div className="dashboard">
        <div className="dashboard-header">
          <h1>👋 Hello, {userDoc?.name?.split(' ')[0]}!</h1>
          <p className="text-muted">Welcome to your hostel portal.</p>
        </div>

        {/* Custom Tabs Navigation */}
        <div style={{ borderBottom: '1px solid var(--border)', display: 'flex', gap: '2rem', marginBottom: '2rem', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          {[
            { id: 'overview', label: '🏠 Overview' },
            { id: 'stats', label: '📊 My Stats' }
          ].map(t => (
            <div 
              key={t.id} 
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '0.75rem 0', fontWeight: 600, cursor: 'pointer',
                color: activeTab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeTab === t.id ? '3px solid var(--primary)' : '3px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              {t.label}
            </div>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="animation-fade-in" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '2rem', alignItems: 'start' }}>
          
          {/* Main Info Area */}
          <div>
            <div className="card mb-3">
              <div className="flex align-items-center mb-2" style={{ justifyContent: 'space-between' }}>
                <h3 className="font-bold">Room Assignment</h3>
                <button 
                  className="btn btn-sm" 
                  style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.4rem 0.8rem' }}
                  onClick={() => navigate(`/complaint/new?roomId=${userDoc.roomId}`)}
                >
                  ⚠️ Report Issue
                </button>
              </div>
              <div className="stats-grid" style={{ marginBottom: 0 }}>
                <div className="stat-card" style={{ padding: '1rem' }}>
                  <div className="stat-label">Block</div>
                  <div className="stat-value text-sm">{hierarchyNames.block}</div>
                </div>
                <div className="stat-card" style={{ padding: '1rem' }}>
                  <div className="stat-label">Building</div>
                  <div className="stat-value text-sm">{hierarchyNames.building}</div>
                </div>
                <div className="stat-card" style={{ padding: '1rem' }}>
                  <div className="stat-label">Floor</div>
                  <div className="stat-value text-sm">{hierarchyNames.floor}</div>
                </div>
                <div className="stat-card" style={{ padding: '1rem', border: '1px solid var(--primary)' }}>
                  <div className="stat-label" style={{ color: 'var(--primary)' }}>Room</div>
                  <div className="stat-value text-sm">🚪 {userDoc.roomNumber}</div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex align-items-center mb-2" style={{ justifyContent: 'space-between' }}>
                <h3 className="font-bold">📢 Announcements</h3>
                {unreadCount > 0 && <span className="badge badge-primary">{unreadCount} Unread</span>}
              </div>
              
              {announcements.length === 0 ? (
                <p className="text-muted">No announcements from your warden yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {announcements.map(a => {
                    const isUnread = !a.readBy.includes(user.uid);
                    return (
                      <div 
                        key={a.id} 
                        className="p-3" 
                        style={{ 
                          background: isUnread ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)', 
                          border: isUnread ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border)',
                          borderRadius: '8px',
                          cursor: isUnread ? 'pointer' : 'default',
                          transition: 'background 0.2s'
                        }}
                        onClick={() => isUnread && handleReadAnnouncement(a.id, a.readBy)}
                      >
                        <div className="flex gap-1" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{a.message}</p>
                          {isUnread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: '5px' }} />}
                        </div>
                        <div className="text-muted text-sm mt-1">{a.createdAt?.toDate().toLocaleDateString() || 'Just now'}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Score Circle */}
            <div className="card text-center">
              <h4 className="font-bold mb-2">Room Score</h4>
              <div style={{ 
                width: '120px', height: '120px', margin: '0 auto',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `conic-gradient(${scoreColor} ${score}%, rgba(255,255,255,0.05) ${score}%)`,
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute', inset: '8px', background: 'var(--glass)', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'
                }}>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: scoreColor }}>{score}</span>
                  <span className="text-sm text-muted">/ 100</span>
                </div>
              </div>
              <p className="text-muted text-sm mt-2">Maintain above 70 to keep a green rating.</p>
            </div>

            <div style={{ marginTop: '0px' }}>
              <button
                onClick={() => setShowFullHistory(p => !p)}
                style={{
                  width: '100%', padding: '10px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)', borderRadius: '10px',
                  color: 'var(--text-primary)', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', fontSize: '0.85rem', fontWeight: 600
                }}
              >
                <span>Room History — All Tenants</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  {fullRoomHistory.length} complaints on record
                  {showFullHistory ? ' ▲' : ' ▼'}
                </span>
              </button>

              {showFullHistory && (
                <div style={{
                  marginTop: '8px', padding: '14px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)', borderRadius: '10px',
                  maxHeight: '400px', overflowY: 'auto'
                }}>
                  {roomSummary?.aiSummary && (
                    <div style={{
                      fontSize: '0.82rem', color: 'var(--text-muted)',
                      fontStyle: 'italic', marginBottom: '14px',
                      padding: '8px 12px', borderRadius: '8px',
                      background: 'rgba(55,138,221,0.08)',
                      border: '1px solid rgba(55,138,221,0.2)'
                    }}>
                      "{roomSummary.aiSummary}"
                    </div>
                  )}

                  {fullRoomHistory.map((c, i) => (
                    <div key={c.id} style={{
                      display: 'flex', gap: '12px',
                      paddingBottom: i < fullRoomHistory.length - 1 ? '14px' : '0',
                      position: 'relative'
                    }}>
                      {i < fullRoomHistory.length - 1 && (
                        <div style={{
                          position: 'absolute', left: '7px', top: '18px',
                          width: '2px', bottom: 0, background: 'var(--border)'
                        }} />
                      )}
                      <div style={{
                        width: '16px', height: '16px', borderRadius: '50%',
                        flexShrink: 0, marginTop: '2px',
                        background: c.status === 'resolved' ? '#10b981'
                          : c.priority === 'high' ? '#ef4444' : '#f59e0b'
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600,
                          color: 'var(--text-primary)' }}>
                          {c.title}
                        </div>
                        <div style={{ fontSize: '0.75rem',
                          color: 'var(--text-muted)', marginTop: '2px' }}>
                          {c.category} • {c.priority} priority •{' '}
                          {c.createdAt?.toDate?.().toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                          {c.status === 'resolved' && c.resolvedAt && (
                            <span style={{ color: '#10b981' }}>
                              {' '}• Fixed in {Math.round(
                                (c.resolvedAt.toDate() - c.createdAt.toDate()) / 3600000
                              )}h
                            </span>
                          )}
                          {c.studentUid !== user?.uid && (
                            <span style={{ color: 'var(--text-muted)' }}>
                              {' '}• Previous tenant
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* QR Code */}
            {roomData?.qrCodeUrl && (
              <div className="card text-center flex flex-column align-items-center">
                <h4 className="font-bold mb-2">My QR Room Key</h4>
                <div style={{ background: '#fff', padding: '0.5rem', borderRadius: '8px', display: 'inline-block' }}>
                  <img src={roomData.qrCodeUrl} alt="Room QR Code" style={{ width: '160px', height: '160px', display: 'block' }} />
                </div>
                <p className="text-muted text-sm mt-2 mb-3">Please download and stick this QR to your room door so complaints can be logged.</p>
                <a 
                  href={roomData.qrCodeUrl} 
                  download={`Room_${userDoc.roomNumber}_QR.png`} 
                  className="btn btn-primary w-full"
                >
                  📥 Download & Print QR
                </a>
              </div>
            )}

          </div>

        </div>
        )}

        {activeTab === 'stats' && (
          <div className="animation-fade-in">
            <StudentAnalytics roomScore={roomData?.score} />
          </div>
        )}
      </div>
    </div>
  );
}
