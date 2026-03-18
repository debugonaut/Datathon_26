import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../firebase/auth';

export default function Navbar() {
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutUser();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <span className="logo-dot" />
        MITAOE Hostel
      </Link>
      <div className="navbar-actions">
        {user ? (
          <>
            <span className="text-muted text-sm">{userDoc?.name || 'User'}</span>
            <span className={`badge badge-${userDoc?.role === 'warden' ? 'primary' : 'success'}`}>
              {userDoc?.role}
            </span>
            <button className="btn btn-outline btn-sm" onClick={handleLogout}>
              Sign Out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
