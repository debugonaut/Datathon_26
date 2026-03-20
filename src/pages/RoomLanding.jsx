import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { resolveRoomByCode, getRoomOccupancyCount, joinRoomWithCodeData } from '../firebase/firestore';

export default function RoomLanding() {
  const { roomId } = useParams();
  const { user, userDoc, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [roomData, setRoomData] = useState(null);
  const [occupancy, setOccupancy] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      sessionStorage.setItem('pendingRoomId', roomId);
      navigate('/login', { replace: true });
      return;
    }

    if (userDoc?.role === 'warden') {
      navigate('/warden/dashboard', { replace: true });
      return;
    }

    // We have a student user. Let's fetch the room data to know what exactly we are dealing with.
    const fetchRoom = async () => {
      try {
        const data = await resolveRoomByCode(roomId);
        if (!data) {
          setError('This room code is invalid or does not exist.');
          setLoading(false);
          return;
        }

        // Complaint Flow Check (if user already has a room)
        if (userDoc?.roomId) {
          // Compare the resolved long ID with their own long ID
          if (userDoc.roomId === data.roomId) {
            navigate(`/complaint/new?roomId=${data.roomId}`, { replace: true });
          } else {
            setError(`This isn't your room. You can only file complaints for Room ${userDoc.roomNumber}.`);
          }
          setLoading(false);
          return;
        }

        // Registration Flow
        setRoomData(data);
        const count = await getRoomOccupancyCount(data.roomId);
        setOccupancy(count);
        setLoading(false);

      } catch (err) {
        console.error(err);
        setError('Failed to resolve room details.');
        setLoading(false);
      }
    };

    fetchRoom();
  }, [roomId, user, userDoc, authLoading, navigate]);

  const handleJoinConfirm = async () => {
    if (!roomData || joining) return;
    setJoining(true);
    setError('');

    try {
      await joinRoomWithCodeData(user.uid, roomData);
      navigate('/student/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to join room.');
      setJoining(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="page" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div className="spinner mb-2" style={{ margin: '0 auto' }}></div>
          <h3 className="m-0 text-muted">Loading your room...</h3>
        </div>
      </div>
    );
  }

  // If there's an error (e.g. invalid code or cross-room complaint attempted)
  if (error) {
    return (
      <div className="page pb-8">
        <Navbar />
        <div className="center-page animation-fade-in" style={{ paddingTop: '4rem' }}>
          <div className="auth-card" style={{ maxWidth: 450, textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚪🚫</div>
            <h2 className="mb-2">Access Denied</h2>
            <p className="text-muted mb-4">{error}</p>
            <button className="btn btn-primary btn-full" onClick={() => navigate('/student/dashboard')}>
              Go to my dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Registration Flow (Confirm Card)
  const maxOcc = roomData?.data?.maxOccupants || 2;
  const isFull = occupancy >= maxOcc;

  return (
    <div className="page pb-8">
      <Navbar />
      <div className="center-page animation-fade-in" style={{ paddingTop: '4rem' }}>
        <div className="auth-card" style={{ maxWidth: 400 }}>
          
          <div style={{ 
            width: 64, height: 64, margin: '0 auto 1.5rem', borderRadius: '50%',
            background: isFull ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)', 
            color: isFull ? '#ef4444' : '#10b981',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem'
          }}>
            {isFull ? '✕' : '✓'}
          </div>

          <h2 className="text-center mb-1">Room Found</h2>
          <p className="text-center text-muted mb-3">You are about to join this room setup.</p>

          <div className="stats-grid mb-3">
            <div className="stat-card" style={{ padding: '0.75rem' }}>
              <div className="stat-label">Hostel</div>
              <div className="stat-value text-sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                 Allocated
              </div>
            </div>
            <div className="stat-card" style={{ padding: '0.75rem' }}>
              <div className="stat-label">Building Name</div>
              <div className="stat-value text-sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                 Allocated
              </div>
            </div>
            <div className="stat-card" style={{ padding: '0.75rem' }}>
              <div className="stat-label">Floor</div>
              <div className="stat-value text-sm">{roomData.data.floorNumber || 'Unknown'}</div>
            </div>
            <div className="stat-card" style={{ padding: '0.75rem', border: '1px solid var(--primary)' }}>
              <div className="stat-label" style={{ color: 'var(--primary)' }}>Room</div>
              <div className="stat-value text-sm">🚪 {roomData.roomNumber}</div>
            </div>
          </div>

          <div style={{ 
            background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', 
            textAlign: 'center', marginBottom: '1.5rem', border: '1px solid var(--border)' 
          }}>
            <div className="text-xs text-muted mb-1">Occupancy</div>
            <div style={{ fontWeight: 'bold' }}>
              {occupancy} of {maxOcc} beds filled
            </div>
            {isFull && <div className="text-xs mt-1" style={{ color: '#ef4444' }}>This room is full. Contact your warden.</div>}
          </div>

          <button 
            className="btn btn-primary btn-full"
            onClick={handleJoinConfirm}
            disabled={isFull || joining}
            style={{ padding: '1rem' }}
          >
            {joining ? 'Joining...' : isFull ? 'Room Full' : 'Join this room'}
          </button>

          <p className="text-center text-xs text-muted mt-3">
            Making a mistake will require warden supervision to reverse.
          </p>

        </div>
      </div>
    </div>
  );
}
