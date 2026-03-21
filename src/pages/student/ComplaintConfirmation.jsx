import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';

export default function ComplaintConfirmation() {
  const location = useLocation();
  const navigate = useNavigate();
  const complaintId = location.state?.complaintId;

  if (!complaintId) {
    return <Navigate to="/student/dashboard" replace />;
  }

  return (
    <div className="page pb-8">
      <Navbar />
      <div className="auth-center animation-fade-in" style={{ paddingTop: '4rem' }}>
        <div className="auth-card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          
          <div style={{ width: 64, height: 64, background: 'rgba(34, 211, 160, 0.15)', color: 'var(--green)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 1rem' }}>
            ✓
          </div>
          
          <h1 className="auth-title mb-2">Complaint Submitted</h1>
          <p className="auth-subtitle mb-4">
            Your issue has been reported successfully. The warden has been notified.
          </p>

          <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', marginBottom: '2rem' }}>
            <div className="text-xs text-muted mb-1">Ticket ID</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '1px' }}>
              {complaintId.toUpperCase()}
            </div>
          </div>

          <button 
            className="btn btn-primary btn-full mb-3"
            onClick={() => navigate('/student/dashboard', { replace: true })}
          >
            Return to Dashboard
          </button>

        </div>
      </div>
    </div>
  );
}
