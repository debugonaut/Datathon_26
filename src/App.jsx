import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SetupRole from './pages/SetupRole';
import ProfileSetup from './pages/student/ProfileSetup';
import RoomRegister from './pages/student/RoomRegister';
import StudentDashboard from './pages/student/Dashboard';
import NewComplaint from './pages/student/NewComplaint';
import ComplaintConfirmation from './pages/student/ComplaintConfirmation';
import SetupHostel from './pages/warden/SetupHostel';
import WardenDashboard from './pages/warden/Dashboard';
import RoomLanding from './pages/RoomLanding';
import JoinHostel from './pages/student/JoinHostel';
import DemoLanding from './pages/DemoLanding';

// ── Generic auth guard ────────────────────────────────────────────────────────
const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, userDoc, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /><p className="text-secondary mt-2">Verifying your access...</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRole && userDoc?.role !== allowedRole) return <Navigate to="/" replace />;
  return children;
};

// ── Student-specific guard enforcing profile + registration steps ─────────────
const StudentGuard = ({ children, requireProfile, requireRegistered }) => {
  const { user, userDoc, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /><p className="text-secondary mt-2">Verifying your access...</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (userDoc?.role !== 'student') return <Navigate to="/" replace />;

  const profileComplete = userDoc?.isProfileComplete === true;
  const registered = userDoc?.isRegistered === true;

  // If profile page is requested but profile is already complete → skip forward
  if (requireProfile === false && profileComplete) {
    if (!registered) return <Navigate to="/student/room-register" replace />;
    return <Navigate to="/student/dashboard" replace />;
  }

  // If profile is not complete → force profile setup
  if (!profileComplete) {
    if (requireProfile) return children; // they're on the profile page, allow
    return <Navigate to="/student/profile-setup" replace />;
  }

  // Profile complete. If not registered → force room registration
  if (!registered) {
    if (requireRegistered === false) return children; // they're on the room-register page, allow
    return <Navigate to="/student/room-register" replace />;
  }

  // Fully onboarded student trying to go back to setup/register pages → redirect to dashboard
  if (requireProfile || requireRegistered === false) {
    return <Navigate to="/student/dashboard" replace />;
  }

  return children;
};

// ── Root redirect ─────────────────────────────────────────────────────────────
const RoleRedirect = () => {
  const { user, userDoc, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /><p className="text-secondary mt-2">Verifying your access...</p></div>;
  if (!user) return <LandingPage />;
  if (!userDoc?.role) return <Navigate to="/setup-role" replace />;
  if (userDoc.role === 'warden') {
    return <Navigate to={userDoc.hostelId ? '/warden/dashboard' : '/warden/setup'} replace />;
  }
  // Student routing
  if (!userDoc.isProfileComplete) return <Navigate to="/student/profile-setup" replace />;
  if (!userDoc.isRegistered) return <Navigate to="/student/room-register" replace />;
  return <Navigate to="/student/dashboard" replace />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<RoleRedirect />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/setup-role" element={<SetupRole />} />
    
    {/* Student Routes with progressive guards */}
    <Route path="/student/profile-setup" element={
      <StudentGuard requireProfile>{<ProfileSetup />}</StudentGuard>
    } />
    <Route path="/student/room-register" element={
      <StudentGuard requireRegistered={false}><RoomRegister /></StudentGuard>
    } />
    <Route path="/student/join" element={
      <StudentGuard requireRegistered={false}><JoinHostel /></StudentGuard>
    } />
    <Route path="/student/dashboard" element={
      <StudentGuard><StudentDashboard /></StudentGuard>
    } />
    <Route path="/complaint/new" element={
      <StudentGuard><NewComplaint /></StudentGuard>
    } />
    <Route path="/complaint/confirmation" element={
      <StudentGuard><ComplaintConfirmation /></StudentGuard>
    } />

    {/* Warden Routes */}
    <Route path="/warden/setup" element={
      <ProtectedRoute allowedRole="warden"><SetupHostel /></ProtectedRoute>
    } />
    <Route path="/warden/dashboard" element={
      <ProtectedRoute allowedRole="warden"><WardenDashboard /></ProtectedRoute>
    } />

    {/* Smart QR Route */}
    <Route path="/room/:roomId" element={<RoomLanding />} />
    <Route path="/room/:hostelId/:roomId" element={<RoomLanding />} />

    <Route path="/demo" element={<DemoLanding />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
