import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { getWardenHostel, getFloors, getBlocks, getRooms } from '../../firebase/firestore';
import AnalyticsDashboard from '../../components/dashboard/AnalyticsDashboard';

export default function WardenDashboard() {
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();
  const [hostel, setHostel] = useState(null);
  const [stats, setStats] = useState({ floors: 0, blocks: 0, rooms: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Analytics'); // Default to Analytics for demo

  const tabs = ['Overview', 'Analytics', 'Complaints', 'Print QRs', 'Announcements', '3D Visualizer'];

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const h = await getWardenHostel(user.uid);
      if (!h) { navigate('/warden/setup', { replace: true }); return; }
      setHostel(h);

      // Count totals
      const floors = await getFloors(h.id);
      let totalBlocks = 0, totalRooms = 0;
      for (const f of floors) {
        const blocks = await getBlocks(h.id, f.id);
        totalBlocks += blocks.length;
        for (const b of blocks) {
          const rooms = await getRooms(h.id, f.id, b.id);
          totalRooms += rooms.length;
        }
      }
      setStats({ floors: floors.length, blocks: totalBlocks, rooms: totalRooms });
      setLoading(false);
    };
    load();
  }, [user]); // eslint-disable-line

  if (loading) return (
    <div className="page">
      <Navbar />
      <div className="loading-screen"><div className="spinner" /></div>
    </div>
  );

  return (
    <div className="page">
      <Navbar />
      <div className="dashboard" style={{ paddingTop: '1rem' }}>
        
        {/* Modern Tabs Navigation */}
        <div style={{
          display: 'flex',
          gap: '24px',
          borderBottom: '1px solid var(--border)',
          marginBottom: '2rem',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch'
        }}>
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '12px 0 16px 0',
                margin: 0,
                fontSize: '0.9rem',
                fontFamily: 'var(--font-heading)',
                fontWeight: 500,
                cursor: 'pointer',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                position: 'relative',
                whiteSpace: 'nowrap',
                transition: 'color 0.2s'
              }}
            >
              {tab}
              {activeTab === tab && (
                <div style={{
                  position: 'absolute',
                  bottom: -1,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: 'var(--accent-primary)',
                  boxShadow: '0 -2px 8px rgba(124, 110, 250, 0.4)'
                }} />
              )}
            </button>
          ))}
        </div>

        {activeTab === 'Analytics' && <AnalyticsDashboard />}
        
        {activeTab === 'Overview' && (
          <div>
            <div className="dashboard-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h1>🏠 {hostel?.name}</h1>
                  <p className="text-muted">{hostel?.collegeName} · Warden: {userDoc?.name}</p>
                </div>
                <button className="btn btn-outline" onClick={() => navigate('/warden/setup')}>
                  ✏️ Edit Hostel Structure
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="stats-grid">
              {[
                { icon: '🏢', label: 'Floors', value: stats.floors },
                { icon: '📦', label: 'Blocks / Wings', value: stats.blocks },
                { icon: '🚪', label: 'Rooms', value: stats.rooms },
                { icon: '🎓', label: 'Students', value: '—' },
              ].map((s) => (
                <div key={s.label} className="stat-card">
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value">{s.value}</div>
                </div>
              ))}
            </div>

            {/* Warden info */}
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
                <div className="info-row">
                  <span className="info-icon">🏷️</span>
                  <div>
                    <div className="info-label">Role</div>
                    <div className="info-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Warden <span className="badge badge-primary">Admin</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab !== 'Analytics' && activeTab !== 'Overview' && (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            <h3 style={{ marginBottom: '1rem' }}>{activeTab} Module</h3>
            <span className="badge badge-primary">Coming Soon</span>
          </div>
        )}
        
      </div>
    </div>
  );
}
