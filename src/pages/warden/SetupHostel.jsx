import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import {
  createHostel,
  getWardenHostel,
  addFloor, getFloors,
  addBlock, getBlocks,
  addRoom, getRooms,
} from '../../firebase/firestore';

export default function SetupHostel() {
  const { user, userDoc, setUserDoc } = useAuth();
  const navigate = useNavigate();

  const [hostelName, setHostelName] = useState('');
  const [collegeName, setCollegeName] = useState('MIT Academy of Engineering (MITAOE)');
  const [hostelId, setHostelId] = useState(null);
  const [creatingHostel, setCreatingHostel] = useState(false);

  const [floors, setFloors] = useState([]);
  const [newFloorName, setNewFloorName] = useState('');
  const [addingFloor, setAddingFloor] = useState(false);

  // Blocks & Rooms per floor
  const [expanded, setExpanded] = useState({}); // floorId -> bool
  const [blocksMap, setBlocksMap] = useState({}); // floorId -> blocks[]
  const [newBlockName, setNewBlockName] = useState({}); // floorId -> string
  const [addingBlock, setAddingBlock] = useState({}); // floorId -> bool

  const [expandedBlock, setExpandedBlock] = useState({}); // blockId -> bool
  const [roomsMap, setRoomsMap] = useState({}); // blockId -> rooms[]
  const [newRoomNum, setNewRoomNum] = useState({}); // blockId -> string
  const [addingRoom, setAddingRoom] = useState({}); // blockId -> bool

  const [error, setError] = useState('');

  // Check if warden already has a hostel
  useEffect(() => {
    if (!user) return;
    getWardenHostel(user.uid).then((h) => {
      if (h) {
        setHostelId(h.id);
        setHostelName(h.name);
        setCollegeName(h.collegeName);
        refreshFloors(h.id);
      }
    });
  }, [user]); // eslint-disable-line

  const refreshFloors = async (hid) => {
    const fl = await getFloors(hid || hostelId);
    setFloors(fl);
  };

  // ─── Hostel Creation ─────────────────────────────────────────────────────────
  const handleCreateHostel = async (e) => {
    e.preventDefault();
    if (!hostelName.trim()) { setError('Enter a hostel name.'); return; }
    setCreatingHostel(true); setError('');
    try {
      const id = await createHostel(user.uid, hostelName.trim(), collegeName.trim());
      setHostelId(id);
      setUserDoc({ ...userDoc, hostelId: id });
    } catch {
      setError('Failed to create hostel.');
    } finally {
      setCreatingHostel(false);
    }
  };

  // ─── Floor ────────────────────────────────────────────────────────────────────
  const handleAddFloor = async () => {
    if (!newFloorName.trim()) return;
    setAddingFloor(true);
    await addFloor(hostelId, newFloorName.trim());
    setNewFloorName('');
    await refreshFloors(hostelId);
    setAddingFloor(false);
  };

  // ─── Block ───────────────────────────────────────────────────────────────────
  const toggleFloor = async (floorId) => {
    setExpanded((p) => ({ ...p, [floorId]: !p[floorId] }));
    if (!blocksMap[floorId]) {
      const bl = await getBlocks(hostelId, floorId);
      setBlocksMap((p) => ({ ...p, [floorId]: bl }));
    }
  };

  const handleAddBlock = async (floorId) => {
    const name = newBlockName[floorId]?.trim();
    if (!name) return;
    setAddingBlock((p) => ({ ...p, [floorId]: true }));
    await addBlock(hostelId, floorId, name);
    setNewBlockName((p) => ({ ...p, [floorId]: '' }));
    const bl = await getBlocks(hostelId, floorId);
    setBlocksMap((p) => ({ ...p, [floorId]: bl }));
    setAddingBlock((p) => ({ ...p, [floorId]: false }));
  };

  // ─── Room ────────────────────────────────────────────────────────────────────
  const toggleBlock = async (hostalId, floorId, blockId) => {
    setExpandedBlock((p) => ({ ...p, [blockId]: !p[blockId] }));
    if (!roomsMap[blockId]) {
      const rm = await getRooms(hostalId, floorId, blockId);
      setRoomsMap((p) => ({ ...p, [blockId]: rm }));
    }
  };

  const handleAddRoom = async (floorId, blockId) => {
    const num = newRoomNum[blockId]?.trim();
    if (!num) return;
    setAddingRoom((p) => ({ ...p, [blockId]: true }));
    await addRoom(hostelId, floorId, blockId, num);
    setNewRoomNum((p) => ({ ...p, [blockId]: '' }));
    const rm = await getRooms(hostelId, floorId, blockId);
    setRoomsMap((p) => ({ ...p, [blockId]: rm }));
    setAddingRoom((p) => ({ ...p, [blockId]: false }));
  };

  return (
    <div className="page">
      <Navbar />
      <div className="setup-page">
        <div className="setup-header">
          <h1>🏗️ {hostelId ? 'Manage Your Hostel' : 'Set Up Your Hostel'}</h1>
          <p className="text-muted">
            {hostelId
              ? 'Add floors, blocks and rooms below.'
              : 'Start by giving your hostel a name, then map it out floor by floor.'}
          </p>
        </div>

        {error && <div className="form-error">{error}</div>}

        {/* ── Step 1: Create hostel ───────────────────────────────────────────── */}
        {!hostelId ? (
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem', fontWeight: 700 }}>📋 Hostel Details</h3>
            <form onSubmit={handleCreateHostel}>
              <div className="form-group">
                <label className="form-label">Hostel Name</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Boys Hostel A / MH-1"
                  value={hostelName}
                  onChange={(e) => setHostelName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">College Name</label>
                <input
                  className="form-input"
                  type="text"
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={creatingHostel}>
                {creatingHostel ? 'Creating…' : '🚀 Create Hostel'}
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Hostel name badge */}
            <div className="card card-sm mb-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span className="text-muted text-sm">Hostel</span>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>🏠 {hostelName}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span className="badge badge-success">Live</span>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/warden/dashboard')}>
                  Go to Dashboard →
                </button>
              </div>
            </div>

            {/* ── Add Floor ──────────────────────────────────────────────────────── */}
            <div className="card mb-2">
              <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>🏢 Add Floor</h3>
              <div className="add-row">
                <input
                  className="form-input"
                  type="text"
                  placeholder="Floor name (e.g. Ground Floor, Floor 1)"
                  value={newFloorName}
                  onChange={(e) => setNewFloorName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFloor()}
                />
                <button className="btn btn-primary" onClick={handleAddFloor} disabled={addingFloor}>
                  {addingFloor ? '…' : '+ Add'}
                </button>
              </div>
            </div>

            {/* ── Floors list ────────────────────────────────────────────────────── */}
            {floors.length === 0 ? (
              <p className="text-muted text-sm">No floors added yet. Add a floor to get started.</p>
            ) : (
              floors.map((floor) => (
                <div key={floor.id} className="floor-block">
                  <div className="floor-header" onClick={() => toggleFloor(floor.id)}>
                    <h3>🏢 {floor.name}</h3>
                    <span className="text-muted text-sm">{expanded[floor.id] ? '▲ collapse' : '▼ expand'}</span>
                  </div>

                  {expanded[floor.id] && (
                    <div className="floor-body">
                      {/* Add block */}
                      <div className="add-row mt-2">
                        <input
                          className="form-input"
                          type="text"
                          placeholder="Block name (e.g. Wing A, Block B)"
                          value={newBlockName[floor.id] || ''}
                          onChange={(e) => setNewBlockName((p) => ({ ...p, [floor.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddBlock(floor.id)}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAddBlock(floor.id)}
                          disabled={addingBlock[floor.id]}
                        >
                          {addingBlock[floor.id] ? '…' : '+ Block'}
                        </button>
                      </div>

                      {/* Blocks */}
                      <div className="blocks-list">
                        {(blocksMap[floor.id] || []).map((block) => (
                          <div key={block.id} className="block-item">
                            <div className="block-header" onClick={() => toggleBlock(hostelId, floor.id, block.id)}>
                              <span>📦 {block.name}</span>
                              <span className="text-muted text-sm">
                                {expandedBlock[block.id] ? '▲' : '▼'}
                              </span>
                            </div>

                            {expandedBlock[block.id] && (
                              <div className="block-body">
                                <div className="add-row mt-1">
                                  <input
                                    className="form-input"
                                    type="text"
                                    placeholder="Room number (e.g. 101, A-12)"
                                    value={newRoomNum[block.id] || ''}
                                    onChange={(e) => setNewRoomNum((p) => ({ ...p, [block.id]: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddRoom(floor.id, block.id)}
                                  />
                                  <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleAddRoom(floor.id, block.id)}
                                    disabled={addingRoom[block.id]}
                                  >
                                    {addingRoom[block.id] ? '…' : '+ Room'}
                                  </button>
                                </div>
                                <div className="rooms-list">
                                  {(roomsMap[block.id] || []).map((r) => (
                                    <span key={r.id} className="room-chip">🚪 {r.roomNumber}</span>
                                  ))}
                                  {(roomsMap[block.id] || []).length === 0 && (
                                    <span className="text-muted text-sm">No rooms yet.</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {(blocksMap[floor.id] || []).length === 0 && (
                          <p className="text-muted text-sm mt-1">No blocks yet — add one above.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
