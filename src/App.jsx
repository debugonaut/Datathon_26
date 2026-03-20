import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import RoleSetupPage from './pages/RoleSetupPage';
import JoinHostel from './pages/student/JoinHostel';
import StudentDashboard from './pages/student/Dashboard';
import NewComplaint from './pages/student/NewComplaint';
import ComplaintConfirmation from './pages/student/ComplaintConfirmation';
import SetupHostel from './pages/warden/SetupHostel';
import WardenDashboard from './pages/warden/Dashboard';

import { useParams } from 'react-router-dom';

const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, userDoc, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRole && userDoc?.role !== allowedRole) return <Navigate to="/" replace />;
  return children;
};

const RoomQRRedirect = () => {
  const { roomId } = useParams();
  const { user, userDoc, loading } = useAuth();
  
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  
  if (!user) {
    sessionStorage.setItem('qrRedirect', roomId.slice(-6));
    return <Navigate to="/login" replace />;
  }

  if (userDoc?.role === 'warden') return <Navigate to="/warden/dashboard" replace />;

  if (!userDoc?.roomId) {
    return <Navigate to={`/student/join?code=${roomId.slice(-6)}`} replace />;
  }

  if (userDoc.roomId === roomId) {
    return <Navigate to={`/complaint/new?roomId=${roomId}`} replace />;
  }

  return <Navigate to="/student/dashboard" replace />;
};

const RoleRedirect = () => {
  const { user, userDoc, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <LandingPage />;
  // Google user with no role yet
  if (!userDoc?.role) return <Navigate to="/setup-role" replace />;
  if (userDoc.role === 'warden') {
    return <Navigate to={userDoc.hostelId ? '/warden/dashboard' : '/warden/setup'} replace />;
  }
  return userDoc.hostelId ? <Navigate to="/student/dashboard" replace /> : <LandingPage />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<RoleRedirect />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/setup-role" element={<RoleSetupPage />} />
    <Route path="/student/join" element={
      <ProtectedRoute allowedRole="student"><JoinHostel /></ProtectedRoute>
    } />
    <Route path="/student/dashboard" element={
      <ProtectedRoute allowedRole="student"><StudentDashboard /></ProtectedRoute>
    } />
    <Route path="/complaint/new" element={
      <ProtectedRoute allowedRole="student"><NewComplaint /></ProtectedRoute>
    } />
    <Route path="/complaint/confirmation" element={
      <ProtectedRoute allowedRole="student"><ComplaintConfirmation /></ProtectedRoute>
    } />
    <Route path="/warden/setup" element={
      <ProtectedRoute allowedRole="warden"><SetupHostel /></ProtectedRoute>
    } />
    <Route path="/warden/dashboard" element={
      <ProtectedRoute allowedRole="warden"><WardenDashboard /></ProtectedRoute>
    } />
    <Route path="/room/:hostelId/:roomId" element={<RoomQRRedirect />} />
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
