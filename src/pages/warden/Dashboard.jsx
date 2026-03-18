import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { getWardenHostel, getFloors, getBlocks, getRooms } from '../../firebase/firestore';

export default function WardenDashboard() {
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();
  const [hostel, setHostel] = useState(null);
  const [stats, setStats] = useState({ floors: 0, blocks: 0, rooms: 0 });
  const [loading, setLoading] = useState(true);

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
      <div className="dashboard">
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

        {/* Future modules */}
        <div className="stats-grid mt-3" style={{ maxWidth: 700 }}>
          {[
            { icon: '📋', title: 'Complaints', desc: 'View & assign student complaints' },
            { icon: '📢', title: 'Announcements', desc: 'Broadcast to students' },
            { icon: '👥', title: 'Students', desc: 'Manage student roster' },
          ].map((f) => (
            <div key={f.title} className="card card-sm" style={{ opacity: 0.6 }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{f.icon}</div>
              <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>{f.title}</div>
              <div className="text-muted text-sm">{f.desc}</div>
              <span className="badge badge-primary mt-1">Coming Soon</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
