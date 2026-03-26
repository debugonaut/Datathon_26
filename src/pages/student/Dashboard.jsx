import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { logoutUser } from '../../firebase/auth';
import ThemeToggle from '../../components/ThemeToggle';
import { getAnnouncements, markAnnouncementRead } from '../../firebase/firestore';
import { fetchRoomHistory, generateRoomSummary } from '../../firebase/roomHistory';
import StudentAnalytics from '../../components/student/StudentAnalytics';
import MiniTimeline from '../../components/student/MiniTimeline';
import RoomHistoryModal from '../../components/shared/RoomHistoryModal';

export default function StudentDashboard() {
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [roomData, setRoomData] = useState(null);
  const [hierarchyNames, setHierarchyNames] = useState({ block: '', building: '', floor: '' });
  const [announcements, setAnnouncements] = useState([]);
  const [recentComplaints, setRecentComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);

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
    if (!user || !userDoc?.hostelId) {
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
          block: blkSnap.data()?.name || userDoc.blockName || 'Unknown Block',
          building: bldSnap.data()?.name || userDoc.buildingName || 'Unknown Building',
          floor: flrSnap.data()?.floorNumber || userDoc.floorNumber || '0'
        });

        // Fetch Announcements
        const feeds = await getAnnouncements(hostelId);
        setAnnouncements(feeds);

        // Fetch Recent Complaints
        const qC = query(collection(db, 'complaints'), where('roomId', '==', roomId));
        const compSnap = await getDocs(qC);
        const comps = compSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a,b) => (b.createdAt?.toMillis()||0) - (a.createdAt?.toMillis()||0));
        setRecentComplaints(comps);
      } catch (err) {
        console.error('Error loading student dashboard data', err);
      }
      setLoading(false);
    };

    loadData();
  }, [userDoc, user]);

  const handleReadAnnouncement = async (annId, currentReadBy) => {
    if (currentReadBy.includes(user.uid)) return;
    await markAnnouncementRead(annId, user.uid, currentReadBy);
    setAnnouncements(prev => prev.map(a => {
      if (a.id === annId) return { ...a, readBy: [...a.readBy, user.uid] };
      return a;
    }));
  };

  if (!user || loading) return (
    <div className="page">
      <Navbar />
      <div className="loading-screen"><div className="spinner" /></div>
    </div>
  );

  if (!userDoc) return (
    <div className="page">
      <Navbar />
      <div className="loading-screen"><div className="spinner" /></div>
    </div>
  );

  if (!userDoc?.hostelId) {
    return (
      <div className="page">
        <Navbar />
        <div className="auth-center text-center">
          <div className="card" style={{ maxWidth: 400 }}>
            <h2>No Hostel Assigned</h2>
            <p className="text-secondary mt-1 mb-2">You haven't joined a hostel room yet.</p>
            <button className="btn btn-primary" onClick={() => navigate('/student/join')}>Join with Room QR</button>
          </div>
        </div>
      </div>
    );
  }

  const unreadCount = announcements.filter(a => !a.readBy.includes(user.uid)).length;
  // Score percentage for circle gradient (0 to 100)
  const score = roomData?.score || 0;
  let scoreColor = score <= 40 ? 'var(--red)' : score <= 70 ? 'var(--amber)' : 'var(--green)';
  if (score === 0) scoreColor = 'var(--text-secondary)';

  return (
  <div className="app-shell">
    {/* Sidebar */}
    <aside className={`app-sidebar ${isSidebarMinimized ? 'minimized' : ''}`}>
      <Link to="/" className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <span className="material-icons-round" style={{fontSize:18}}>apartment</span>
        </div>
        <span className="sidebar-brand-name">Fix My Hostel</span>
      </Link>

      <nav className="sidebar-nav">
        <span className="sidebar-section-label">My Room</span>
        {[
          ['overview',   'home',          'Overview'],
          ['complaints', 'task_alt',      'My Complaints'],
          ['stats',      'bar_chart',     'Analytics'],
        ].map(([id,icon,label])=>(
          <div key={id} className={`sidebar-item ${activeTab===id?'active':''}`} onClick={()=>setActiveTab(id)}>
            <span className="material-icons-round">{icon}</span>
            <span className="item-label">{label}</span>
          </div>
        ))}

        <span className="sidebar-section-label">Actions</span>
        <Link to="/complaint/new" className="sidebar-item">
          <span className="material-icons-round">add_circle_outline</span>
          <span className="item-label">File Complaint</span>
        </Link>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {userDoc?.name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
          </div>
          <div>
            <div className="sidebar-user-name">{userDoc?.name}</div>
            <div className="sidebar-user-role">Room {userDoc?.roomNumber}</div>
          </div>
        </div>
      </div>
    </aside>

    {/* Main */}
    <div className={`app-main ${isSidebarMinimized ? 'minimized' : ''}`}>
      <div className="app-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button className="sidebar-toggle-btn" onClick={() => setIsSidebarMinimized(!isSidebarMinimized)}>
            <span className="material-icons-round" style={{fontSize: 20}}>menu</span>
          </button>
          <div>
            <div className="header-title">Room {userDoc?.roomNumber}</div>
            <div style={{fontSize:12,color:'var(--text-3)',marginTop:1}}>{hierarchyNames.building} · Floor {hierarchyNames.floor}</div>
          </div>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <Link to="/complaint/new" className="btn btn-primary btn-sm">
            <span className="material-icons-round" style={{fontSize:15}}>add</span>
            File Complaint
          </Link>
          <button className="btn btn-ghost btn-sm" onClick={async()=>{await logoutUser();navigate('/');}}>
            <span className="material-icons-round" style={{fontSize:16}}>logout</span>
          </button>
        </div>
      </div>

      <div style={{background:'var(--bg-card)',borderBottom:'1px solid var(--border)',padding:'0 24px'}}>
        <div className="tabs">
          {[['overview','Overview'],['complaints','My Complaints'],['stats','Analytics']].map(([id,label])=>(
            <div key={id} className={`tab ${activeTab===id?'active':''}`} onClick={()=>setActiveTab(id)}>{label}</div>
          ))}
        </div>
      </div>

      <div className="app-content animation-fade-in">
        {activeTab==='overview' && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:20}}>
            <div style={{display:'flex',flexDirection:'column',gap:16}}>

              {/* Score */}
              <div className="card" style={{'--accent-color': score>70?'var(--green)':score>40?'var(--amber)':'var(--red)'}}>
                <div className="label">Room Health Score</div>
                <div style={{display:'flex',alignItems:'center',gap:20,marginTop:12}}>
                  <svg width="72" height="72" viewBox="0 0 100 100" style={{transform:'rotate(-90deg)',flexShrink:0}}>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="10"/>
                    <circle cx="50" cy="50" r="42" fill="none"
                      stroke={score>70?'var(--green)':score>40?'var(--amber)':'var(--red)'}
                      strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={`${score*2.638} 263.8`}
                      style={{transition:'stroke-dasharray 0.6s ease'}}
                    />
                  </svg>
                  <div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:36,fontWeight:500,color:score>70?'var(--green)':score>40?'var(--amber)':'var(--red)',lineHeight:1}}>
                      {score}<span style={{fontSize:16,color:'var(--text-3)'}}>/100</span>
                    </div>
                    <p style={{fontSize:12.5,color:'var(--text-2)',marginTop:6,lineHeight:1.5}}>Maintain above 70 to keep a green rating.</p>
                  </div>
                </div>
              </div>

              <div className="card-flat">
                <div className="label">Announcements</div>
                {announcements.length===0
                  ? <p style={{fontSize:13,color:'var(--text-3)',marginTop:8}}>No announcements yet.</p>
                  : announcements.map(a=>(
                    <div key={a.id} style={{padding:'12px 0',borderBottom:'1px solid var(--border)',display:'flex',gap:12,alignItems:'flex-start'}}>
                      <span className="material-icons-round" style={{fontSize:16,color:'var(--primary)',flexShrink:0,marginTop:1}}>campaign</span>
                      <div style={{flex:1}}>
                        <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.5}}>{a.message}</p>
                        <span style={{fontSize:11,color:'var(--text-3)',fontFamily:'var(--font-mono)'}}>
                          {a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString('en-IN') : 'Recent'}
                        </span>
                      </div>
                      {!a.readBy?.includes(user.uid) && (
                        <button onClick={()=>handleReadAnnouncement(a.id,a.readBy)}
                          style={{fontSize:11,color:'var(--primary)',background:'none',border:'none',cursor:'pointer',flexShrink:0}}>
                          Mark read
                        </button>
                      )}
                    </div>
                  ))
                }
              </div>

              <MiniTimeline 
                complaints={recentComplaints} 
                onSeeAll={() => setActiveTab('complaints')} 
              />
            </div>

            {/* Right */}
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {roomData?.qrCodeUrl && (
                <div className="card-flat" style={{textAlign:'center'}}>
                  <div className="label" style={{marginBottom:12}}>My Room QR</div>
                  <div style={{background:'#fff',padding:8,borderRadius:8,display:'inline-block',boxShadow:'var(--shadow-sm)'}}>
                    <img src={roomData.qrCodeUrl} alt="QR" style={{width:130,height:130,display:'block'}} />
                  </div>
                  <p style={{fontSize:11,color:'var(--text-3)',fontFamily:'var(--font-mono)',margin:'10px 0 12px',lineHeight:1.4}}>Stick this to your room door</p>
                  <a href={roomData.qrCodeUrl} download={`Room_${userDoc.roomNumber}_QR.png`} className="btn btn-secondary btn-sm btn-full">
                    <span className="material-icons-round" style={{fontSize:14}}>download</span>
                    Download QR
                  </a>
                </div>
              )}

              <div className="card-flat">
                <button onClick={()=>setShowFullHistory(true)} style={{width:'100%',background:'none',border:'none',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',color:'var(--text)'}}>
                  <span style={{fontSize:13,fontWeight:600}}>Room History</span>
                  <span style={{fontSize:11,color:'var(--text-3)',fontFamily:'var(--font-mono)'}}>{fullRoomHistory.length} records →</span>
                </button>

                {showFullHistory && (
                  <RoomHistoryModal 
                    room={{
                      id: userDoc.roomId,
                      roomNumber: userDoc.roomNumber,
                      buildingName: hierarchyNames.building,
                      floorNumber: hierarchyNames.floor
                    }} 
                    onClose={() => setShowFullHistory(false)} 
                  />
                )}
              </div>

            </div>
          </div>
        )}

        {activeTab==='complaints' && <StudentAnalytics roomScore={roomData?.score} view="complaints" />}
        {activeTab==='stats' && <StudentAnalytics roomScore={roomData?.score} view="analytics" />}
      </div>
    </div>
  </div>
);
}
