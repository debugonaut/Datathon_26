import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { logoutUser } from '../../firebase/auth';

export default function StudentDashboard() {
  const { userDoc } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutUser();
    navigate('/', { replace: true });
  };

  return (
    <div className="page">
      <Navbar />
      <div className="dashboard">
        <div className="dashboard-header">
          <h1>👋 Hello, {userDoc?.name?.split(' ')[0]}!</h1>
          <p className="text-muted">Welcome to your hostel portal.</p>
        </div>

        {/* Room info cards */}
        <div className="stats-grid" style={{ maxWidth: 700 }}>
          <div className="stat-card">
            <div className="stat-icon">🏠</div>
            <div className="stat-label">Hostel</div>
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>
              {userDoc?.hostelId ? 'Enrolled' : '—'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏢</div>
            <div className="stat-label">Room Number</div>
            <div className="stat-value">{userDoc?.roomNumber || '—'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📧</div>
            <div className="stat-label">Email</div>
            <div className="stat-value" style={{ fontSize: '0.9rem', wordBreak: 'break-all' }}>
              {userDoc?.email}
            </div>
          </div>
        </div>

        {/* Info block */}
        <div className="card mt-3" style={{ maxWidth: 700 }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>📋 Your Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="info-row">
              <span className="info-icon">👤</span>
              <div>
                <div className="info-label">Full Name</div>
                <div className="info-value">{userDoc?.name}</div>
              </div>
            </div>
            <div className="info-row">
              <span className="info-icon">🏷️</span>
              <div>
                <div className="info-label">Role</div>
                <div className="info-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Student <span className="badge badge-success">Verified</span>
                </div>
              </div>
            </div>
            <div className="info-row">
              <span className="info-icon">🚪</span>
              <div>
                <div className="info-label">Assigned Room</div>
                <div className="info-value">Room {userDoc?.roomNumber || 'Not assigned yet'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Placeholder feature cards */}
        <div className="stats-grid mt-3" style={{ maxWidth: 700 }}>
          {[
            { icon: '📋', title: 'Complaints', desc: 'File & track hostel complaints', soon: true },
            { icon: '📢', title: 'Announcements', desc: 'Stay updated from your warden', soon: true },
            { icon: '🍽️', title: 'Mess Menu', desc: 'View today\'s mess schedule', soon: true },
          ].map((f) => (
            <div key={f.title} className="card card-sm" style={{ opacity: 0.6 }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{f.icon}</div>
              <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>{f.title}</div>
              <div className="text-muted text-sm">{f.desc}</div>
              {f.soon && <span className="badge badge-primary mt-1">Coming Soon</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
