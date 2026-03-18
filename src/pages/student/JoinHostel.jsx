import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { searchHostels, getFloors, getBlocks, getRooms, joinHostel } from '../../firebase/firestore';

export default function JoinHostel() {
  const { user, userDoc, setUserDoc } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [hostels, setHostels] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const [selectedHostel, setSelectedHostel] = useState(null);
  const [floors, setFloors] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [selectedFloor, setSelectedFloor] = useState('');
  const [selectedBlock, setSelectedBlock] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');

  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  // Check if hostel was pre-selected from landing page
  useEffect(() => {
    const preselected = sessionStorage.getItem('selectedHostelId');
    if (preselected) {
      // Load hostel name for display
      searchHostels('').then((all) => {
        const found = all.find((h) => h.id === preselected);
        if (found) {
          pickHostel(found);
          sessionStorage.removeItem('selectedHostelId');
        }
      });
    }
  }, []); // eslint-disable-line

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoadingSearch(true);
    setSearched(false);
    setSelectedHostel(null);
    const res = await searchHostels(query.trim());
    setHostels(res);
    setSearched(true);
    setLoadingSearch(false);
  };

  const pickHostel = async (hostel) => {
    setSelectedHostel(hostel);
    setSelectedFloor(''); setSelectedBlock(''); setSelectedRoom('');
    const fl = await getFloors(hostel.id);
    setFloors(fl); setBlocks([]); setRooms([]);
  };

  const handleFloorChange = async (floorId) => {
    setSelectedFloor(floorId);
    setSelectedBlock(''); setSelectedRoom('');
    if (!floorId) { setBlocks([]); setRooms([]); return; }
    const bl = await getBlocks(selectedHostel.id, floorId);
    setBlocks(bl); setRooms([]);
  };

  const handleBlockChange = async (blockId) => {
    setSelectedBlock(blockId);
    setSelectedRoom('');
    if (!blockId) { setRooms([]); return; }
    const rm = await getRooms(selectedHostel.id, selectedFloor, blockId);
    setRooms(rm);
  };

  const handleJoin = async () => {
    if (!selectedHostel || !selectedFloor || !selectedBlock || !selectedRoom) {
      setError('Please select a hostel, floor, block, and room.');
      return;
    }
    setJoining(true);
    try {
      const roomObj = rooms.find((r) => r.id === selectedRoom);
      await joinHostel(user.uid, selectedHostel.id, selectedFloor, selectedBlock, roomObj?.roomNumber || selectedRoom);
      setUserDoc({ ...userDoc, hostelId: selectedHostel.id, floorId: selectedFloor, blockId: selectedBlock, roomNumber: roomObj?.roomNumber });
      navigate('/student/dashboard', { replace: true });
    } catch {
      setError('Failed to join hostel. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const step = selectedHostel ? (selectedFloor ? (selectedBlock ? (selectedRoom ? 4 : 3) : 2) : 1) : 0;

  return (
    <div className="page">
      <Navbar />
      <div className="join-page">
        <div className="card join-card">
          <h2>🏠 Find & Join Your Hostel</h2>
          <p className="subtitle">Select your hostel, floor, block, and room number.</p>

          {/* Step indicator */}
          <div className="steps">
            {['Find Hostel', 'Select Floor', 'Select Block', 'Select Room'].map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {i > 0 && <span className="step-sep">›</span>}
                <span className={`step-item ${step === i ? 'active' : step > i ? 'done' : ''}`}>
                  <span className="step-num">{step > i ? '✓' : i + 1}</span>
                  {s}
                </span>
              </div>
            ))}
          </div>

          {error && <div className="form-error">{error}</div>}

          {/* Step 0: Search hostel */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              className="form-input"
              type="text"
              placeholder="Search hostel name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ margin: 0 }}
            />
            <button className="btn btn-primary" type="submit" disabled={loadingSearch}>
              {loadingSearch ? '…' : 'Search'}
            </button>
          </form>

          {searched && hostels.length === 0 && (
            <p className="text-muted text-sm mb-2">No hostels found.</p>
          )}
          {hostels.map((h) => (
            <div
              key={h.id}
              className={`hostel-result-card mb-1 ${selectedHostel?.id === h.id ? 'card-hover' : ''}`}
              style={{ border: selectedHostel?.id === h.id ? '2px solid var(--primary)' : '' }}
              onClick={() => pickHostel(h)}
            >
              <h3>🏠 {h.name}</h3>
              <p>{h.collegeName}</p>
            </div>
          ))}

          {/* Step 1–3 dropdowns */}
          {selectedHostel && (
            <>
              <div className="form-group mt-2">
                <label className="form-label">Floor</label>
                <select
                  className="form-input form-select"
                  value={selectedFloor}
                  onChange={(e) => handleFloorChange(e.target.value)}
                >
                  <option value="">— Select a floor —</option>
                  {floors.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {selectedFloor && (
                <div className="form-group">
                  <label className="form-label">Block</label>
                  <select
                    className="form-input form-select"
                    value={selectedBlock}
                    onChange={(e) => handleBlockChange(e.target.value)}
                  >
                    <option value="">— Select a block —</option>
                    {blocks.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedBlock && (
                <div className="form-group">
                  <label className="form-label">Room Number</label>
                  <select
                    className="form-input form-select"
                    value={selectedRoom}
                    onChange={(e) => setSelectedRoom(e.target.value)}
                  >
                    <option value="">— Select your room —</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>Room {r.roomNumber}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                className="btn btn-primary btn-full mt-3"
                onClick={handleJoin}
                disabled={joining || !selectedRoom}
              >
                {joining ? 'Joining…' : '✅ Confirm & Join Hostel →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
