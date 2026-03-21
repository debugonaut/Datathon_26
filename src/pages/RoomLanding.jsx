import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { resolveRoomByCode } from '../firebase/firestore';

export default function RoomLanding() {
  const { roomId } = useParams();
  const { user, userDoc, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    // ── Not logged in → save to localStorage and redirect to login ──
    if (!user) {
      localStorage.setItem('pendingRoomId', roomId);
      navigate('/login', { replace: true });
      return;
    }

    // ── Warden scanning a QR → just go to dashboard ──
    if (userDoc?.role === 'warden') {
      navigate('/warden/dashboard', { replace: true });
      return;
    }

    // ── Student: Profile incomplete → save pending and redirect ──
    if (!userDoc?.isProfileComplete) {
      localStorage.setItem('pendingRoomId', roomId);
      navigate('/student/profile-setup', { replace: true });
      return;
    }

    // ── Student: Profile complete but not registered → pre-fill room register ──
    if (!userDoc?.isRegistered) {
      navigate(`/student/room-register?prefill=${roomId}`, { replace: true });
      return;
    }

    // ── Student: Fully registered. Check if scanning own room vs another ──
    const resolveAndRoute = async () => {
      try {
        const data = await resolveRoomByCode(roomId);
        if (!data) {
          setError('This room code is invalid or does not exist.');
          setLoading(false);
          return;
        }

        if (userDoc.roomId === data.roomId) {
          // Own room → complaint flow
          navigate(`/complaint/new?roomId=${data.roomId}`, { replace: true });
        } else {
          // Not their room
          setError(`This isn't your room. You can only file complaints for Room ${userDoc.roomNumber}.`);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to resolve room details.');
        setLoading(false);
      }
    };

    resolveAndRoute();
  }, [roomId, user, userDoc, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="page" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div className="spinner mb-2" style={{ margin: '0 auto' }}></div>
          <h3 className="m-0 text-muted">Verifying your access...</h3>
        </div>
      </div>
    );
  }

  // Error state (invalid code or cross-room complaint)
  if (error) {
    return (
      <div className="page pb-8">
        <Navbar />
        <div className="auth-center animation-fade-in" style={{ paddingTop: '4rem' }}>
          <div className="auth-card" style={{ maxWidth: 450, textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚫</div>
            <h2 className="mb-2">Access Denied</h2>
            <p className="text-secondary mb-4">{error}</p>
            <button className="btn btn-primary btn-full" onClick={() => navigate('/student/dashboard')}>
              Go to my dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
