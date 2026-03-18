import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { getBlocks, getBuildings, getFloors, getRooms, joinHostel } from '../../firebase/firestore';
import { db } from '../../firebase/config';
import { doc, getDoc } from 'firebase/firestore';

export default function JoinHostel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const selectedHostelId = params.get('hostelId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Hierarchy Data
  const [blocks, setBlocks] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [floors, setFloors] = useState([]);
  const [rooms, setRooms] = useState([]);

  // Selections
  const [blockId, setBlockId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [roomId, setRoomId] = useState('');

  // Initial Load
  useEffect(() => {
    if (!selectedHostelId) {
      navigate('/');
      return;
    }
    const loadBlocks = async () => {
      try {
        const b = await getBlocks(selectedHostelId);
        setBlocks(b);
      } catch (e) {
        setError('Failed to load hostel blocks.');
      }
      setLoading(false);
    };
    loadBlocks();
  }, [selectedHostelId, navigate]);

  // Load Buildings when Block changes
  useEffect(() => {
    setBuildingId(''); setFloorId(''); setRoomId('');
    setBuildings([]); setFloors([]); setRooms([]);
    if (!blockId) return;

    getBuildings(selectedHostelId, blockId).then(setBuildings).catch(console.error);
  }, [blockId, selectedHostelId]);

  // Load Floors when Building changes
  useEffect(() => {
    setFloorId(''); setRoomId('');
    setFloors([]); setRooms([]);
    if (!buildingId) return;

    getFloors(selectedHostelId, blockId, buildingId).then(setFloors).catch(console.error);
  }, [buildingId, blockId, selectedHostelId]);

  // Load Rooms when Floor changes
  useEffect(() => {
    setRoomId('');
    setRooms([]);
    if (!floorId) return;

    getRooms(selectedHostelId, blockId, buildingId, floorId).then(setRooms).catch(console.error);
  }, [floorId, buildingId, blockId, selectedHostelId]);

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // 1. Double-assignment prevention check (Read latest from server)
      const roomRef = doc(db, 'hostels', selectedHostelId, 'blocks', blockId, 'buildings', buildingId, 'floors', floorId, 'rooms', roomId);
      const roomSnap = await getDoc(roomRef);
      
      if (!roomSnap.exists()) throw new Error("Room does not exist.");
      if (roomSnap.data().studentUid) throw new Error("This room is already taken by another student.");

      const selectedRoom = rooms.find(r => r.id === roomId);

      // 2. Commit transaction via firestore helper
      await joinHostel(
        user.uid,
        selectedHostelId,
        blockId,
        buildingId,
        floorId,
        roomId,
        selectedRoom.roomNumber
      );

      // Redirect to dashboard
      navigate('/student/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="page">
      <Navbar />
      <div className="loading-screen"><div className="spinner" /></div>
    </div>
  );

  return (
    <div className="page">
      <Navbar />
      <div className="join-page">
        <div className="join-card card animation-fade-in">
          <h2>Select Your Room</h2>
          <p className="subtitle">Let's map your profile to your exact room.</p>
          
          {error && <div className="form-error">{error}</div>}

          <form onSubmit={handleJoin}>
            <div className="form-group">
              <label className="form-label">Block / Wing</label>
              <select className="form-input form-select" value={blockId} onChange={e => setBlockId(e.target.value)} required>
                <option value="" disabled>Select a block</option>
                {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Building</label>
              <select className="form-input form-select" value={buildingId} onChange={e => setBuildingId(e.target.value)} required disabled={!blockId || buildings.length === 0}>
                <option value="" disabled>Select a building</option>
                {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Floor</label>
              <select className="form-input form-select" value={floorId} onChange={e => setFloorId(e.target.value)} required disabled={!buildingId || floors.length === 0}>
                <option value="" disabled>Select a floor</option>
                {floors.map(f => <option key={f.id} value={f.id}>Floor {f.floorNumber}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Room</label>
              <select className="form-input form-select" value={roomId} onChange={e => setRoomId(e.target.value)} required disabled={!floorId || rooms.length === 0}>
                <option value="" disabled>Select a room</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id} disabled={!!r.studentUid}>
                    Room {r.roomNumber} {r.studentUid ? '(Occupied)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn btn-primary btn-full mt-2" disabled={!roomId || submitting}>
              {submitting ? 'Confirming...' : 'Confirm & Join Room'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
