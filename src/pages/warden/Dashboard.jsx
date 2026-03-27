import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { logoutUser } from '../../firebase/auth';
import ThemeToggle from '../../components/ThemeToggle';
import { getWardenHostel, getBlocks, getBuildings, getFloors, getRooms, bulkDeleteResolvedComplaints } from '../../firebase/firestore';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import WardenAnnouncements from '../../components/warden/WardenAnnouncements';
import Hostel3DView from '../../components/warden/Hostel3DView';
import ComplaintsKanban from '../../components/warden/ComplaintsKanban';
import ComplaintsList from '../../components/warden/ComplaintsList';
import WardenQRDirectory from '../../components/warden/WardenQRDirectory';
import OverviewOccupancy from '../../components/warden/OverviewOccupancy';
import WardenAnalytics from '../../components/warden/WardenAnalytics';
import { clusterComplaints } from '../../utils/clusterComplaints';
import { getSLAStatus } from '../../utils/sla';

export default function WardenDashboard() {
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();
  const [hostel, setHostel] = useState(null);
  const [stats, setStats] = useState({ floors: 0, blocks: 0, rooms: 0, buildings: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  
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
    { id: 'complaints', label: 'Complaints' },
    { id: 'occupancy', label: 'Occupancy' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'qrcodes', label: 'QR Codes' },
    { id: 'announcements', label: 'Announcements' },
    { id: '3dview', label: '3D Visualizer' },
  ];

  return (
  <div className="app-shell">
    {/* Sidebar */}
    <aside className={`app-sidebar ${isSidebarMinimized ? 'minimized' : ''}`}>
      <Link to="/" className="sidebar-brand">
        <div className="sidebar-brand-icon" style={{background:'var(--primary-soft)', color:'var(--primary)'}}>
          <span className="material-icons-round" style={{fontSize:20}}>apartment</span>
        </div>
        <span className="sidebar-brand-name">Fix My Hostel</span>
      </Link>

      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Main</span>
        {[
          ['overview',      'dashboard',      'Overview'],
          ['complaints',    'task_alt',       'Complaints'],
          ['occupancy',     'people_alt',     'Occupancy'],
          ['analytics',     'bar_chart',      'Analytics'],
          ['3dview',        'view_in_ar',     '3D Visualizer'],
          ['qrcodes',       'qr_code_2',      'QR Codes'],
          ['announcements', 'campaign',       'Announcements'],
        ].map(([id, icon, label]) => (
          <div key={id}
            className={`sidebar-item ${activeTab === id ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <span className="material-icons-round">{icon}</span>
            <span className="item-label">{label}</span>
          </div>
        ))}
      </nav>

    </aside>

    {/* Main */}
    <div className={`app-main ${isSidebarMinimized ? 'minimized' : ''}`}>
      <div className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="sidebar-toggle-btn" onClick={() => setIsSidebarMinimized(!isSidebarMinimized)}>
            <span className="material-icons-round" style={{fontSize: 20}}>menu</span>
          </button>
          <div>
            <div className="header-title" style={{fontSize: 15, fontWeight: 700}}>{hostel?.name}</div>
            <div style={{fontSize: 11, color: 'var(--text-3)', marginTop: 1}}>{hostel?.collegeName}</div>
          </div>
        </div>
        <div className="header-actions" style={{display:'flex', alignItems:'center', gap:16}}>
          <ThemeToggle />
          <div style={{display:'flex', alignItems:'center', gap:10, borderLeft:'1px solid var(--border)', paddingLeft:16}}>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:13, fontWeight:600, color:'var(--text)'}}>{userDoc?.name}</div>
              <div style={{fontSize:11, color:'var(--text-3)'}}>Warden</div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{padding:'6px'}} title="Logout" onClick={async () => { await logoutUser(); navigate('/'); }}>
              <span className="material-icons-round" style={{fontSize:20, color:'var(--red)'}}>logout</span>
            </button>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} /> {/* Spacer */}

      {/* Content */}
      <div className="app-content">
        <div key={activeTab} className="animation-fade-in">

        {/* Alerts */}
        {activeTab==='complaints' && clusterComplaints(complaints).length > 0 && (
          <div className="alert alert-warning mb-4">
            <span className="material-icons-round" style={{fontSize:16,flexShrink:0}}>warning</span>
            <span>{clusterComplaints(complaints).length} complaint cluster — {clusterComplaints(complaints)[0].category} on Floor {clusterComplaints(complaints)[0].floor}</span>
          </div>
        )}
        {activeTab==='complaints' && complaints.some(c=>getSLAStatus(c)?.breached) && (
          <div className="alert alert-error mb-4">
            <span className="material-icons-round" style={{fontSize:16,flexShrink:0}}>schedule</span>
            <span>SLA breached: {complaints.filter(c=>getSLAStatus(c)?.breached).length} overdue complaint(s)</span>
          </div>
        )}

        {activeTab==='overview' && (
          <>
            {/* KPI stats */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              {[
                {label:'Total',    value:complaints.length,                                    icon:'inbox',      color:'var(--primary)'},
                {label:'Open',     value:complaints.filter(c=>c.status==='todo').length,        icon:'radio_button_unchecked', color:'var(--red)'},
                {label:'Progress', value:complaints.filter(c=>c.status==='in_progress').length, icon:'autorenew',  color:'var(--amber)'},
                {label:'Resolved', value:complaints.filter(c=>c.status==='resolved').length,    icon:'check_circle',color:'var(--green)'},
                {label:'Rooms',    value:stats.rooms,                                           icon:'meeting_room',color:'var(--blue)'},
              ].map(s=>(
                <div key={s.label} className="stat-card" style={{'--accent-color':s.color}}>
                  <div className="stat-icon" style={{background:`${s.color}18`, color:s.color}}>
                    <span className="material-icons-round" style={{fontSize:18}}>{s.icon}</span>
                  </div>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value">{s.value}</div>
                </div>
              ))}
            </div>            {/* Two column */}
            <div className="grid-2 responsive" style={{ gap: 16, marginBottom: 24 }}>
              <div className="card-flat">
                <div className="label" style={{marginBottom:12}}>Warden details</div>
                {[['Name',userDoc?.name],['Email',userDoc?.email],['Hostel',hostel?.name],['College',hostel?.collegeName]].map(([k,v])=>(
                  <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13.5}}>
                    <span style={{color:'var(--text-3)',fontWeight:500}}>{k}</span>
                    <span style={{color:'var(--text)',fontFamily:k==='Email'?'var(--font-mono)':''}}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="card-flat">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div className="label">Recent Complaints</div>
                  <Link to="#" onClick={()=>setActiveTab('complaints')} style={{fontSize:12,color:'var(--primary)',textDecoration:'none',fontWeight:600}}>View all</Link>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {complaints.filter(c=>c.status!=='resolved').slice(0,3).length === 0 ? (
                    <div style={{fontSize:13,color:'var(--text-3)',textAlign:'center',padding:'20px 0'}}>No active complaints</div>
                  ) : (
                    complaints.filter(c=>c.status!=='resolved').slice(0,3).map(c=>(
                      <div key={c.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px',background:'var(--bg-hover)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:c.priority==='high'?'var(--red)':c.priority==='medium'?'var(--amber)':'var(--green)'}} />
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.title}</div>
                          <div style={{fontSize:11,color:'var(--text-3)'}}>Room {c.roomNumber} • {c.category}</div>
                        </div>
                        <span className="material-icons-round" style={{fontSize:16,color:'var(--text-ghost)'}}>chevron_right</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab==='occupancy' && <OverviewOccupancy hostelId={hostel.id} />}

        {activeTab==='announcements' && <WardenAnnouncements hostelId={hostel.id} />}
        {activeTab==='analytics' && <WardenAnalytics hostelId={hostel.id} />}
        {activeTab==='3dview' && <Hostel3DView hostelId={hostel.id} complaints={complaints} />}
        {activeTab==='qrcodes' && <WardenQRDirectory hostelId={hostel.id} />}

        {activeTab==='complaints' && (
          <div className="animation-fade-in">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
              <div style={{fontSize:13,fontWeight:600,color:'var(--text-2)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Complaints</div>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                {['','Plumbing','Electrical','Cleaning','Furniture','Other'].map(cat=>(
                  <button key={cat||'all'} onClick={()=>setFilters(f=>({...f,category:cat}))}
                    className={filters.category===cat ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>
                    {cat||'All'}
                  </button>
                ))}
                
                {complaints.some(c => c.status === 'resolved') && (
                  <button 
                    onClick={async () => {
                      const resolved = complaints.filter(c => c.status === 'resolved');
                      if (!window.confirm(`Delete all ${resolved.length} resolved tickets? This cannot be undone.`)) return;
                      await bulkDeleteResolvedComplaints(resolved.map(r => r.id));
                    }}
                    className="btn btn-sm"
                    style={{ background: 'var(--red-soft)', color: 'var(--red)', border: '1px solid var(--red-border)', marginLeft: 8 }}
                  >
                    <span className="material-icons-round" style={{ fontSize: 16, marginRight: 6 }}>delete_sweep</span>
                    Clear Resolved
                  </button>
                )}

                <div style={{display:'flex',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',overflow:'hidden'}}>
                  {[['kanban','view_kanban'],['list','format_list_bulleted']].map(([v,icon])=>(
                    <button key={v} onClick={()=>setViewMode(v)}
                      style={{padding:'7px 12px',border:'none',cursor:'pointer',background:viewMode===v?'var(--bg-hover)':'transparent',color:viewMode===v?'var(--text)':'var(--text-3)',transition:'all 0.15s',display:'flex',alignItems:'center'}}>
                      <span className="material-icons-round" style={{fontSize:16}}>{icon}</span>
                    </button>
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
  </div>
);
}
