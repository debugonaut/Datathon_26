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
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>

        {/* Dashboard Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, letterSpacing: '-0.02em', margin: 0, color: 'var(--text-primary)' }}>{hostel?.name}</h1>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 13 }}>{hostel?.collegeName} · Warden: {userDoc?.name}</p>
          </div>
          <button onClick={() => navigate('/warden/setup')}
            style={{
              background: 'transparent', border: '1px solid var(--border-v2)',
              borderRadius: 7, padding: '7px 14px', fontSize: 13,
              color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)',
              transition: 'border-color 0.2s ease'
            }}
            onMouseEnter={e => e.target.style.borderColor = 'var(--border-hover)'}
            onMouseLeave={e => e.target.style.borderColor = 'var(--border-v2)'}
          >Edit Hostel</button>
        </div>

        {/* Tab Bar */}
        <div style={{
          background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-v2)',
          display: 'flex', gap: 0, marginBottom: 24, overflowX: 'auto', scrollbarWidth: 'none',
          borderRadius: '8px 8px 0 0'
        }}>
          {TABS.map(t => (
            <div
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '12px 20px', fontWeight: 500, cursor: 'pointer',
                fontSize: 13, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
                color: activeTab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === t.id ? '2px solid var(--violet)' : '2px solid transparent',
                transition: 'all 0.2s ease'
              }}
            >
              {t.label}
            </div>
          ))}
        </div>

        {/* ── Overview Tab ─────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div>
            {/* Stats Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Total', value: complaints.length, accent: 'var(--violet)' },
                { label: 'Open', value: complaints.filter(c => c.status === 'todo').length, accent: 'var(--red)' },
                { label: 'In Progress', value: complaints.filter(c => c.status === 'in_progress').length, accent: 'var(--amber)' },
                { label: 'Resolved', value: complaints.filter(c => c.status === 'resolved').length, accent: 'var(--green)' },
                { label: 'Rooms', value: stats.rooms, accent: 'var(--blue)' },
              ].map(s => (
                <div key={s.label} className="data-card" style={{ borderTop: `2px solid ${s.accent}` }}>
                  <div className="section-label">{s.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Two Column Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
              {/* Left — Warden Details + Occupancy */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="data-card" style={{ borderTop: '2px solid var(--violet)' }}>
                  <div className="section-label" style={{ marginBottom: 12 }}>Warden Details</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { label: 'Name', value: userDoc?.name },
                      { label: 'Email', value: userDoc?.email },
                      { label: 'Hostel', value: hostel?.name },
                      { label: 'College', value: hostel?.collegeName },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.label}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <OverviewOccupancy hostelId={hostel.id} />
              </div>

              {/* Right — Complaint Summary */}
              <div className="data-card" style={{ borderTop: '2px solid var(--amber)', height: 'fit-content' }}>
                <div className="section-label" style={{ marginBottom: 16 }}>Complaint Summary</div>
                {[
                  { label: 'Open', value: complaints.filter(c => c.status === 'todo').length, color: 'var(--red)' },
                  { label: 'In Progress', value: complaints.filter(c => c.status === 'in_progress').length, color: 'var(--amber)' },
                  { label: 'Resolved', value: complaints.filter(c => c.status === 'resolved').length, color: 'var(--green)' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{row.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600, color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
      {activeTab === 'announcements' && <WardenAnnouncements hostelId={hostel.id} />}
      {activeTab === 'analytics' && <WardenAnalytics hostelId={hostel.id} />}
      {activeTab === '3dview' && <Hostel3DView hostelId={hostel.id} />}
      {activeTab === 'qrcodes' && <WardenQRDirectory hostelId={hostel.id} />}

      {activeTab === 'complaints' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 600 }}>
          
          {/* Control Bar */}
          <div className="data-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
            
            <div style={{ display: 'flex', gap: 6 }}>
              {['kanban', 'list'].map(mode => (
                <button key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12,
                    background: viewMode === mode ? 'var(--violet)' : 'var(--bg-raised)',
                    color: viewMode === mode ? '#fff' : 'var(--text-secondary)',
                    border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)',
                    transition: 'all 0.2s ease'
                  }}
                >{mode === 'kanban' ? 'Kanban' : 'List'}</button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { key: 'building', label: 'All Buildings', options: [...new Set(complaints.map(c => c.buildingName))] },
                { key: 'category', label: 'All Categories', options: ['Plumbing', 'Electrical', 'Cleaning', 'Furniture', 'Other'] },
                { key: 'priority', label: 'All Priorities', options: ['high', 'medium', 'low'] },
              ].map(sel => (
                <select key={sel.key}
                  value={filters[sel.key]}
                  onChange={e => setFilters({...filters, [sel.key]: e.target.value})}
                  style={{
                    background: 'var(--bg-raised)', border: '1px solid var(--border-v2)',
                    borderRadius: 7, padding: '7px 12px', color: 'var(--text-primary)',
                    fontSize: 13, outline: 'none', fontFamily: 'var(--font-body)'
                  }}
                >
                  <option value="">{sel.label}</option>
                  {sel.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ))}
              {Object.values(filters).some(v => v !== '') && (
                <button onClick={() => setFilters({ building: '', category: '', priority: '', status: '' })}
                  style={{
                    background: 'transparent', border: '1px solid var(--border-v2)',
                    borderRadius: 7, padding: '6px 12px', fontSize: 12,
                    color: 'var(--text-ghost)', cursor: 'pointer'
                  }}>Clear</button>
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
