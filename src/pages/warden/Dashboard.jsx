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
    { id: 'overview', label: '🏠 Overview' },
    { id: 'complaints', label: '🛠️ Complaints' },
    { id: 'qrcodes', label: '🖨️ Print QRs' },
    { id: 'announcements', label: '📢 Announcements' },
    { id: '3dview', label: '🏢 3D Visualizer' },
  ];

  return (
    <div className="page">
      <Navbar />
      <div className="dashboard">
        <div className="dashboard-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1>{hostel?.name}</h1>
              <p className="text-muted">{hostel?.collegeName} · Warden: {userDoc?.name}</p>
            </div>
            <button className="btn btn-outline" onClick={() => navigate('/warden/setup')}>
              ✏️ Map Hostel
            </button>
          </div>
        </div>

        {/* Custom Tabs Navigation */}
        <div style={{ borderBottom: '1px solid var(--border)', display: 'flex', gap: '2rem', marginBottom: '2rem', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          {TABS.map(t => (
            <div 
              key={t.id} 
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '0.75rem 0',
                fontWeight: 600,
                cursor: 'pointer',
                color: activeTab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeTab === t.id ? '3px solid var(--primary)' : '3px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              {t.label}
            </div>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="animation-fade-in">
            <div className="stats-grid">
              {[
                { icon: '📦', label: 'Blocks', value: stats.blocks },
                { icon: '🏢', label: 'Buildings', value: stats.buildings },
                { icon: '🪜', label: 'Floors', value: stats.floors },
                { icon: '🚪', label: 'Rooms', value: stats.rooms },
              ].map((s) => (
                <div key={s.label} className="stat-card">
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value">{s.value}</div>
                </div>
              ))}
            </div>

            <div className="card mt-3" style={{ maxWidth: 700 }}>
              <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>📋 Warden Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="info-row">
                  <span className="info-icon">👤</span>
                  <div>
                    <div className="info-label">Name</div>
                    <div className="info-value">{userDoc?.name}</div>
                  </div>
                </div>
                <div className="info-row">
                  <span className="info-icon">📧</span>
                  <div>
                    <div className="info-label">Email</div>
                    <div className="info-value">{userDoc?.email}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>🛏️ Room Occupancy</h3>
              <OverviewOccupancy hostelId={hostel.id} />
            </div>
          </div>
        )}
        
      {activeTab === 'announcements' && <WardenAnnouncements hostelId={hostel.id} />}
      {activeTab === '3dview' && <Hostel3DView hostelId={hostel.id} />}
      {activeTab === 'qrcodes' && <WardenQRDirectory hostelId={hostel.id} />}

      {activeTab === 'complaints' && (
        <div className="animation-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', minHeight: '600px' }}>
          
          {/* Top Control Bar */}
          <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' }}>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className={`btn btn-sm ${viewMode === 'kanban' ? 'btn-primary' : 'btn-outline'}`} 
                onClick={() => setViewMode('kanban')}
              >
                Kanban Board
              </button>
              <button 
                className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setViewMode('list')}
              >
                List View
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select className="form-input" style={{ width: 'auto', padding: '0.4rem', outline: 'none' }} value={filters.building} onChange={e => setFilters({...filters, building: e.target.value})}>
                <option value="">All Buildings</option>
                {[...new Set(complaints.map(c => c.buildingName))].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <select className="form-input" style={{ width: 'auto', padding: '0.4rem', outline: 'none' }} value={filters.category} onChange={e => setFilters({...filters, category: e.target.value})}>
                <option value="">All Categories</option>
                {['Plumbing', 'Electrical', 'Cleaning', 'Furniture', 'Other'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select className="form-input" style={{ width: 'auto', padding: '0.4rem', outline: 'none' }} value={filters.priority} onChange={e => setFilters({...filters, priority: e.target.value})}>
                <option value="">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              {viewMode === 'list' && (
                <select className="form-input" style={{ width: 'auto', padding: '0.4rem', outline: 'none' }} value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
                  <option value="">All Statuses</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              )}
              {Object.values(filters).some(v => v !== '') && (
                <button className="btn btn-sm" style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }} onClick={() => setFilters({ building: '', category: '', priority: '', status: '' })}>
                  Clear
                </button>
              )}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            {viewMode === 'kanban' 
              ? <ComplaintsKanban complaints={filteredComplaints} /> 
              : <ComplaintsList complaints={filteredComplaints} />
            }
          </div>

        </div>
      )}

      </div>
    </div>
  );
}
