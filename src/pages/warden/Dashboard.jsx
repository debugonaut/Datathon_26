import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { getWardenHostel, getBlocks, getBuildings, getFloors, getRooms } from '../../firebase/firestore';
import WardenQRCodes from '../../components/warden/WardenQRCodes';
import WardenAnnouncements from '../../components/warden/WardenAnnouncements';
import Hostel3DView from '../../components/warden/Hostel3DView';

export default function WardenDashboard() {
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();
  const [hostel, setHostel] = useState(null);
  const [stats, setStats] = useState({ floors: 0, blocks: 0, rooms: 0, buildings: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

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

  if (loading) return (
    <div className="page">
      <Navbar />
      <div className="loading-screen"><div className="spinner" /></div>
    </div>
  );

  const TABS = [
    { id: 'overview', label: '🏠 Overview' },
    { id: 'qrcodes', label: '🔲 QR Codes' },
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
          </div>
        )}

        {activeTab === 'qrcodes' && <WardenQRCodes hostelId={hostel.id} />}
        
      {activeTab === 'announcements' && <WardenAnnouncements hostelId={hostel.id} />}

      {activeTab === '3dview' && <Hostel3DView hostelId={hostel.id} />}

      </div>
    </div>
  );
}
