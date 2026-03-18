import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import QRCode from 'qrcode';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar';

export default function SetupHostel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Basic
  const [hostelName, setHostelName] = useState('');
  const [collegeName] = useState('MITAOE');

  // Step 2 & 3: Blocks and Buildings (with floors count)
  const [blocks, setBlocks] = useState([]);

  // Temp form states
  const [newBlockName, setNewBlockName] = useState('');
  const [newBldName, setNewBldName] = useState('');
  const [newBldFloors, setNewBldFloors] = useState(1);
  const [activeBlockId, setActiveBlockId] = useState(null);

  // Step 4: Rooms
  // To manage rooms, we map over blocks -> buildings -> floors
  // generate range string: '101-120'

  const handleCreateBlock = () => {
    if (!newBlockName.trim()) return;
    setBlocks([...blocks, { id: crypto.randomUUID(), name: newBlockName, buildings: [] }]);
    setNewBlockName('');
  };

  const handleCreateBuilding = (blockId) => {
    if (!newBldName.trim() || newBldFloors < 1) return;
    setBlocks(blocks.map(b => {
      if (b.id !== blockId) return b;
      
      const floors = Array.from({ length: newBldFloors }, (_, i) => ({
        id: crypto.randomUUID(),
        floorNumber: i + 1,
        roomRange: '',
        rooms: []
      }));

      return {
        ...b,
        buildings: [...b.buildings, {
          id: crypto.randomUUID(),
          name: newBldName,
          totalFloors: newBldFloors,
          floors
        }]
      };
    }));
    setNewBldName('');
    setNewBldFloors(1);
    setActiveBlockId(null);
  };

  const updateFloorRoomRange = (blockId, bldId, floorId, rangeStr) => {
    setBlocks(blocks.map(b => {
      if (b.id !== blockId) return b;
      return {
        ...b,
        buildings: b.buildings.map(bld => {
          if (bld.id !== bldId) return bld;
          return {
            ...bld,
            floors: bld.floors.map(fl => {
              if (fl.id !== floorId) return fl;
              return { ...fl, roomRange: rangeStr };
            })
          };
        })
      };
    }));
  };

  // Generate rooms array from range string (e.g., "101-105") or CSV ("101, 102, 103")
  const parseRoomRange = (rangeStr) => {
    if (!rangeStr.trim()) return [];
    if (rangeStr.includes('-')) {
      const [start, end] = rangeStr.split('-').map(n => parseInt(n.trim(), 10));
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        return Array.from({ length: end - start + 1 }, (_, i) => (start + i).toString());
      }
    }
    return rangeStr.split(',').map(s => s.trim()).filter(Boolean);
  };

  const handleFinalSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      // Create Hostel Document
      const hostelRef = doc(collection(db, 'hostels'));
      const hostelId = hostelRef.id;

      // Update Warden's user doc
      const userRef = doc(db, 'users', user.uid);
      
      // Batch setup
      let batch = writeBatch(db);
      let operationCount = 0;

      const commitBatchIfNeeded = async () => {
        if (operationCount >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
        }
      };

      batch.set(hostelRef, {
        wardenId: user.uid,
        name: hostelName,
        collegeName,
        createdAt: serverTimestamp()
      });
      batch.update(userRef, { hostelId });
      operationCount += 2;

      // Traverse Tree and prepare writes
      for (const block of blocks) {
        const blockRef = doc(collection(db, 'hostels', hostelId, 'blocks'));
        batch.set(blockRef, { name: block.name });
        operationCount++;
        await commitBatchIfNeeded();

        for (const bld of block.buildings) {
          const bldRef = doc(collection(db, 'hostels', hostelId, 'blocks', blockRef.id, 'buildings'));
          batch.set(bldRef, { name: bld.name, totalFloors: bld.totalFloors });
          operationCount++;
          await commitBatchIfNeeded();

          for (const fl of bld.floors) {
            const floorRef = doc(collection(db, 'hostels', hostelId, 'blocks', blockRef.id, 'buildings', bldRef.id, 'floors'));
            batch.set(floorRef, { floorNumber: fl.floorNumber });
            operationCount++;
            await commitBatchIfNeeded();

            const rooms = parseRoomRange(fl.roomRange);
            for (const roomNum of rooms) {
              const roomRef = doc(collection(db, 'hostels', hostelId, 'blocks', blockRef.id, 'buildings', bldRef.id, 'floors', floorRef.id, 'rooms'));
              
              // Generate QR Code containing the room joining URL
              const joinUrl = `https://datathon-26.vercel.app/room/${hostelId}/${roomRef.id}`;
              const qrCodeUrl = await QRCode.toDataURL(joinUrl, { width: 400, margin: 2 });

              batch.set(roomRef, {
                roomNumber: roomNum,
                score: 0,
                studentUid: null,
                qrCodeUrl
              });
              operationCount++;
              await commitBatchIfNeeded();
            }
          }
        }
      }

      // Final commit
      if (operationCount > 0) {
        await batch.commit();
      }

      navigate('/warden/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      setError('Failed to setup hostel. ' + err.message);
      setLoading(false);
    }
  };


  // Render tree view for live sidebar
  const renderTreeView = () => (
    <div className="card" style={{ height: 'fit-content' }}>
      <h3 className="font-bold mb-2">Live Hierarchy</h3>
      {blocks.length === 0 && <p className="text-muted text-sm">No blocks added yet.</p>}
      
      <div style={{ marginLeft: '0.5rem', borderLeft: '2px solid var(--border)', paddingLeft: '1rem' }}>
        {blocks.map(b => (
          <div key={b.id} className="mb-2">
            <div className="font-bold text-sm" style={{ color: 'var(--primary)' }}>❖ {b.name}</div>
            <div style={{ marginLeft: '1rem', borderLeft: '1px solid var(--border)', paddingLeft: '1rem', marginTop: '0.5rem' }}>
              {b.buildings.length === 0 && <span className="text-muted text-sm">No buildings.</span>}
              {b.buildings.map(bld => (
                <div key={bld.id} className="mb-2">
                  <div className="font-bold text-sm" style={{ color: 'var(--accent)' }}>⌂ {bld.name} ({bld.totalFloors} floors)</div>
                  <div style={{ marginLeft: '1rem', marginTop: '0.2rem' }}>
                    {bld.floors.map(fl => {
                      const roomCount = parseRoomRange(fl.roomRange).length;
                      return (
                        <div key={fl.id} className="text-sm text-muted">
                          ↳ Fl {fl.floorNumber}: {roomCount} rooms
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="page">
      <Navbar />
      <div className="container" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        <div className="setup-header text-center mb-3">
          <h1>Map Your Hostel</h1>
          <p>Create the hierarchy so students can correctly join their rooms.</p>
        </div>

        {error && <div className="form-error text-center">{error}</div>}

        <div className="steps justify-content-center">
          {[1, 2, 3].map(n => (
            <div key={n} className={`step-item ${step > n ? 'done' : step === n ? 'active' : ''}`}>
              <div className="step-num">{step > n ? '✓' : n}</div>
              {n === 1 && 'Basic Info'}
              {n === 2 && 'Blocks & Buildings'}
              {n === 3 && 'Rooms & Finalize'}
              {n < 3 && <span className="step-sep">⋯</span>}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem', alignItems: 'start' }}>
          
          {/* Main Wizard Area */}
          <div className="card">
            
            {/* STEP 1 */}
            {step === 1 && (
              <div className="animation-fade-in">
                <h2 className="font-bold mb-2">Hostel Information</h2>
                <div className="form-group">
                  <label className="form-label">Hostel Name</label>
                  <input className="form-input" value={hostelName} onChange={e => setHostelName(e.target.value)} placeholder="e.g. Boys Hostel A" />
                </div>
                <div className="form-group">
                  <label className="form-label">College</label>
                  <input className="form-input" value={collegeName} disabled />
                </div>
                <button className="btn btn-primary" disabled={!hostelName.trim()} onClick={() => setStep(2)}>Build Infrastructure →</button>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="animation-fade-in">
                <h2 className="font-bold mb-1">Blocks & Buildings</h2>
                <p className="text-muted text-sm mb-2">Create blocks (e.g. "North Block"), and add buildings inside them.</p>

                <div className="add-row mb-3">
                  <input className="form-input" value={newBlockName} onChange={e => setNewBlockName(e.target.value)} placeholder="New Block Name" onKeyDown={e => e.key === 'Enter' && handleCreateBlock()}/>
                  <button className="btn btn-outline" onClick={handleCreateBlock}>Add Block</button>
                </div>

                <div className="blocks-list">
                  {blocks.map(b => (
                    <div key={b.id} className="block-item mb-2" style={{ background: 'var(--surface)' }}>
                      <div className="block-header" style={{ cursor: 'default' }}>
                        <span style={{ color: 'var(--primary)' }}>❖ {b.name}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => setActiveBlockId(activeBlockId === b.id ? null : b.id)}>
                          {activeBlockId === b.id ? 'Cancel' : '+ Add Building'}
                        </button>
                      </div>
                      
                      {activeBlockId === b.id && (
                        <div className="block-body" style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderTop: 'none' }}>
                          <div className="flex gap-1">
                            <input className="form-input" placeholder="Building Name" value={newBldName} onChange={e => setNewBldName(e.target.value)} style={{ flex: 2 }} />
                            <input type="number" min="1" className="form-input" placeholder="Floors" value={newBldFloors} onChange={e => setNewBldFloors(parseInt(e.target.value) || 1)} style={{ flex: 1 }} />
                            <button className="btn btn-primary" onClick={() => handleCreateBuilding(b.id)}>Add</button>
                          </div>
                        </div>
                      )}

                      <div style={{ padding: '0 1rem 1rem' }}>
                        {b.buildings.map(bld => (
                          <div key={bld.id} className="info-row mt-1" style={{ padding: '0.5rem 1rem' }}>
                            <div>
                              <div className="font-bold text-sm">⌂ {bld.name}</div>
                              <div className="text-muted text-sm">{bld.totalFloors} Floors</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-1 mt-3">
                  <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
                  <button className="btn btn-primary" disabled={blocks.length === 0 || blocks[0].buildings.length === 0} onClick={() => setStep(3)}>Configure Rooms →</button>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div className="animation-fade-in">
                <h2 className="font-bold mb-1">Add Rooms & Finalize</h2>
                <p className="text-muted text-sm mb-3">For each floor, specify the rooms (e.g. range "101-120" or comma-separated "101, 102").</p>

                <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {blocks.map(b => (
                    <div key={b.id} className="mb-3">
                      <h4 className="font-bold mb-1" style={{ color: 'var(--primary)' }}>❖ {b.name}</h4>
                      {b.buildings.map(bld => (
                        <div key={bld.id} style={{ marginLeft: '1rem', borderLeft: '2px solid var(--border)', paddingLeft: '1rem' }} className="mb-2">
                          <h5 className="font-bold text-sm mb-1" style={{ color: 'var(--accent)' }}>⌂ {bld.name}</h5>
                          {bld.floors.map(fl => (
                            <div key={fl.id} className="flex gap-1 mb-1 align-items-center">
                              <span className="text-sm font-bold w-full" style={{ maxWidth: '80px' }}>Floor {fl.floorNumber}:</span>
                              <input 
                                className="form-input" 
                                placeholder="101-120 or 101, 102" 
                                value={fl.roomRange}
                                onChange={(e) => updateFloorRoomRange(b.id, bld.id, fl.id, e.target.value)}
                              />
                              <span className="badge badge-primary">{parseRoomRange(fl.roomRange).length}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="divider">Ready to Generate Database & QR Codes</div>
                
                <div className="flex gap-1 mt-3">
                  <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
                  <button className="btn btn-primary flex-1" onClick={handleFinalSubmit} disabled={loading}>
                    {loading ? 'Generating... (This may take a minute)' : '✅ Finalize & Generate QR Codes'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="d-none d-md-block">
            {renderTreeView()}
          </div>

        </div>
      </div>
    </div>
  );
}
