import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../firebase/auth';
import ThemeToggle from './ThemeToggle';

export default function Navbar({ title }) {
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => { await logoutUser(); navigate('/'); };
  const initials = userDoc?.name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || 'U';

  return (
    <div className="app-header">
      <span className="header-title">{title || 'Fix My Hostel'}</span>
      <div className="header-actions">
        <ThemeToggle />
        {user && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div className="sidebar-avatar">{initials}</div>
              <div style={{ lineHeight:1.3 }}>
                <div className="sidebar-user-name">{userDoc?.name}</div>
                <div className="sidebar-user-role">{userDoc?.role}</div>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
              <span className="material-icons-round" style={{ fontSize:16 }}>logout</span>
              Sign out
            </button>
          </>
        )}
        {!user && (
          <>
            <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Register</Link>
          </>
        )}
      </div>
    </div>
  );
}
