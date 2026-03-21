import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { getWardenHostel, getBlocks, getBuildings, getFloors, getRooms } from '../../firebase/firestore';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import WardenAnnouncements from '../../components/warden/WardenAnnouncements';
import Hostel3DView from '../../components/warden/Hostel3DView';
import ComplaintsKanban from '../../components/warden/ComplaintsKanban';
import ComplaintsList from '../../components/warden/ComplaintsList';
import WardenQRDirectory from '../../components/warden/WardenQRDirectory';
import OverviewOccupancy from '../../components/warden/OverviewOccupancy';
import WardenAnalytics from '../../components/warden/WardenAnalytics';

export default function WardenDashboard() {
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();
  const [hostel, setHostel] = useState(null);
  const [stats, setStats] = useState({ floors: 0, blocks: 0, rooms: 0, buildings: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Complaints State
  const [complaints, setComplaints] = useState([]);
  const [viewMode, setViewMode] = useState('kanban'); // kanban | list
  const [filters, setFilters] = useState({ building: '', category: '', priority: '', status: '' });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const h = await getWardenHostel(user.uid);
      if (!h) { navigate('/warden/setup', { replace: true }); return; }
      setHostel(h);

      // Deep count for overview
      const blocks = await getBlocks(h.id);
      let totalBuildings = 0, totalFloors = 0, totalRooms = 0;
      
      for (const b of blocks) {
        const buildings = await getBuildings(h.id, b.id);
        totalBuildings += buildings.length;
        for (const bld of buildings) {
          const floors = await getFloors(h.id, b.id, bld.id);
          totalFloors += floors.length;
          for (const fl of floors) {
            const rooms = await getRooms(h.id, b.id, bld.id, fl.id);
            totalRooms += rooms.length;
          }
        }
      }
      
      setStats({ 
        blocks: blocks.length, 
        buildings: totalBuildings,
        floors: totalFloors, 
        rooms: totalRooms 
      });
      setLoading(false);
    };
    load();
  }, [user]);

  // Live Complaints Subscription
  useEffect(() => {
    if (!hostel) return;
    const q = query(collection(db, 'complaints'), where('hostelId', '==', hostel.id));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      setComplaints(data);
    });
    return () => unsub();
  }, [hostel]);

  const filteredComplaints = complaints.filter(c => {
    if (filters.building && c.buildingName !== filters.building) return false;
    if (filters.category && c.category !== filters.category) return false;
    if (filters.priority && c.priority !== filters.priority) return false;
    if (filters.status && c.status !== filters.status) return false;
    return true;
  });

  if (loading) return (
    <div className="page">
      <Navbar />
      <div className="loading-screen"><div className="spinner" /></div>
    </div>
  );

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'complaints', label: 'Complaints' },
    { id: 'qrcodes', label: 'QR Codes' },
    { id: 'announcements', label: 'Announcements' },
    { id: '3dview', label: '3D Visualizer' },
  ];

  return (
    <div className="page">
      <Navbar />
      <div className="dashboard">
        <div className="dashboard-header">
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
            <div>
              <h1 className="dashboard-title">{hostel?.name}</h1>
              <p className="dashboard-subtitle">{hostel?.collegeName} · {userDoc?.name}</p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={()=>navigate('/warden/setup')}>Edit hostel</button>
          </div>
          <div className="tabs">
            {[['overview','Overview'],['complaints','Complaints'],['analytics','Analytics'],['3dview','3D Visualizer'],['qrcodes','QR Codes'],['announcements','Announcements']].map(([id,label])=>(
              <div key={id} className={`tab ${activeTab===id?'active':''}`} onClick={()=>setActiveTab(id)}>{label}</div>
            ))}
          </div>
        </div>

        <div className="dashboard-body animation-fade-in">
          {/* Cluster alert */}
          {activeTab==='complaints' && clusterComplaints(complaints).length > 0 && (
            <div className="alert-warning mb-4" style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--amber)', flexShrink:0 }} />
              {clusterComplaints(complaints).length} complaint cluster detected — {clusterComplaints(complaints)[0].category} on Floor {clusterComplaints(complaints)[0].floor}
            </div>
          )}

          {/* SLA breach alert */}
          {activeTab==='complaints' && complaints.some(c=>getSLAStatus(c)?.breached) && (
            <div className="alert-error mb-4" style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--red)', flexShrink:0 }} />
              SLA breached: {complaints.filter(c=>getSLAStatus(c)?.breached).length} complaint(s) overdue
            </div>
          )}

          {activeTab==='overview' && (
            <div className="animation-fade-in">
              {/* Stats */}
              <div className="stats-grid" style={{ gridTemplateColumns:'repeat(4,minmax(0,1fr))' }}>
                {[
                  { label:'Blocks', value:stats.blocks, accent:'var(--violet)' },
                  { label:'Buildings', value:stats.buildings, accent:'var(--blue)' },
                  { label:'Floors', value:stats.floors, accent:'var(--amber)' },
                  { label:'Rooms', value:stats.rooms, accent:'var(--green)' },
                ].map(s=>(
                  <div key={s.label} className="stat-card" style={{ borderTop:`2px solid ${s.accent}` }}>
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-value">{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Two column */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:16 }}>
                <div className="card-static" style={{ borderTop:'2px solid var(--violet)' }}>
                  <span className="label">Warden details</span>
                  {[['Name',userDoc?.name],['Email',userDoc?.email]].map(([k,v])=>(
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                      <span style={{ color:'var(--text-secondary)' }}>{k}</span>
                      <span style={{ color:'var(--text)', fontFamily: k==='Email'?'var(--font-mono)':'' }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div className="card-static" style={{ borderTop:'2px solid var(--amber)' }}>
                  <span className="label">Complaint summary</span>
                  {[
                    ['Open', complaints.filter(c=>c.status==='todo').length, 'var(--red)'],
                    ['In progress', complaints.filter(c=>c.status==='in_progress').length, 'var(--amber)'],
                    ['Resolved', complaints.filter(c=>c.status==='resolved').length, 'var(--green)'],
                  ].map(([k,v,color])=>(
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                      <span style={{ color:'var(--text-secondary)' }}>{k}</span>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:18, color, lineHeight:1 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop:24 }}>
                <OverviewOccupancy hostelId={hostel.id} />
              </div>
            </div>
          )}

          {activeTab==='announcements' && <WardenAnnouncements hostelId={hostel.id} />}
          {activeTab==='analytics' && <WardenAnalytics hostelId={hostel.id} />}
          {activeTab==='3dview' && <Hostel3DView hostelId={hostel.id} />}
          {activeTab==='qrcodes' && <WardenQRDirectory hostelId={hostel.id} />}

          {activeTab==='complaints' && (
            <div className="animation-fade-in">
              {/* Control bar */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
                <span className="label" style={{ margin:0 }}>Complaints board</span>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  {['','Plumbing','Electrical','Cleaning','Furniture','Other'].map(cat=>(
                    <button key={cat||'all'} onClick={()=>setFilters(f=>({...f,category:cat}))}
                      style={{ padding:'4px 12px', borderRadius:20, fontSize:12, cursor:'pointer', transition:'all 0.15s',
                        background: filters.category===cat ? 'var(--violet)' : 'transparent',
                        color: filters.category===cat ? '#fff' : 'var(--text-secondary)',
                        border: filters.category===cat ? '1px solid var(--violet)' : '1px solid var(--border)'
                      }}>{cat||'All'}</button>
                  ))}
                  <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                    {[['kanban','Kanban'],['list','List']].map(([v,l])=>(
                      <button key={v} onClick={()=>setViewMode(v)}
                        style={{ padding:'5px 14px', fontSize:12, border:'none', cursor:'pointer', transition:'all 0.15s',
                          background: viewMode===v ? 'var(--bg-raised)' : 'transparent',
                          color: viewMode===v ? 'var(--text)' : 'var(--text-secondary)',
                          fontFamily:'var(--font-body)', fontWeight: viewMode===v ? 600 : 400
                        }}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
              {viewMode==='kanban' ? <ComplaintsKanban complaints={filteredComplaints} /> : <ComplaintsList complaints={filteredComplaints} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
