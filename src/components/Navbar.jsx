import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../firebase/auth';

export default function Navbar() {
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => { await logoutUser(); navigate('/'); };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <span className="navbar-brand-dot" />
        <span className="navbar-brand-name">Fix My Hostel</span>
      </Link>
      <div className="navbar-actions">
        {user ? (
          <>
            <span className="navbar-user">{userDoc?.name}</span>
            <span className="navbar-role">{userDoc?.role}</span>
            <button className="btn btn-outline btn-sm" onClick={handleLogout}>Sign out</button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
