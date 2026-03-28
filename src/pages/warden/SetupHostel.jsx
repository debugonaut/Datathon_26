import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import QRCode from 'qrcode';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar';

const NumberInput = ({ label, value, onChange, min = 1, max = 999 }) => (
  <div style={{ flex: 1 }}>
    {label && <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 8 }}>{label}</label>}
    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: 4 }}>
      <button 
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--primary-soft)', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <input 
        type="number" 
        value={value} 
        onChange={e => onChange(parseInt(e.target.value) || min)}
        style={{ flex: 1, background: 'transparent', border: 'none', textAlign: 'center', fontSize: 13, color: 'var(--text)', fontWeight: 700, outline: 'none', width: 40 }}
      />
      <button 
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--primary-soft)', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
  </div>
);

export default function SetupHostel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Basic Info
  const [hostelName, setHostelName] = useState('Boys Hostel A');
  const [collegeName, setCollegeName] = useState('MIT Academy of Engineering (MITAOE)');

  // Setup Mode
  const [setupMode, setSetupMode] = useState(''); // 'quick' | 'advanced' | ''

  // Step 2 & 3: Hierarchy
  const [blocks, setBlocks] = useState([]);

  // Advanced Mode Form States
  const [newBlockName, setNewBlockName] = useState('');
  const [newBldName, setNewBldName] = useState('');
  const [newBldFloors, setNewBldFloors] = useState(1);
  const [activeBlockId, setActiveBlockId] = useState(null);

  // Quick Mode Form States
  const [qsFloors, setQsFloors] = useState(5);
  const [qsRoomsPerFloor, setQsRoomsPerFloor] = useState(4);
  const [qsStartingRoom, setQsStartingRoom] = useState(101);
  const [maxOccupants, setMaxOccupants] = useState(2);

  const handleQuickSetupGenerate = () => {
    if (qsFloors < 1 || !qsRoomsPerFloor || !qsStartingRoom) return;

    const blockId = crypto.randomUUID();
    const bldId = crypto.randomUUID();

    const floors = Array.from({ length: qsFloors }, (_, i) => {
      const floorNum = i + 1;
      const startRoom = floorNum * 100 + (qsStartingRoom % 100 || 1);
      const endRoom = startRoom + qsRoomsPerFloor - 1;
      const rangeStr = `${startRoom}-${endRoom}`;

      return {
        id: crypto.randomUUID(),
        floorNumber: floorNum,
        roomRange: rangeStr,
        rooms: []
      };
    });

    setBlocks([{
      id: blockId,
      name: 'Main Block',
      buildings: [{
        id: bldId,
        name: 'Main Building',
        totalFloors: qsFloors,
        floors
      }]
    }]);

    setStep(3); // Jump straight to finalize
  };

  const handleCreateBlock = (e) => {
    if (e) e.preventDefault();
    if (!newBlockName.trim()) return;
    const newBlock = { id: crypto.randomUUID(), name: newBlockName, buildings: [] };
    setBlocks(prev => [...prev, newBlock]);
    setNewBlockName('');
    setActiveBlockId(newBlock.id);
  };

  const handleCreateBuilding = (e, blockId) => {
    if (e) e.preventDefault();
    if (!newBldName.trim() || newBldFloors < 1) return;
    
    setBlocks(prev => prev.map(b => {
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

      const hostelRef = doc(collection(db, 'hostels'));
      const hostelId = hostelRef.id;
      const userRef = doc(db, 'users', user.uid);
      
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
              
              const shortCode = roomRef.id.slice(-6).toUpperCase();
              const qrCodeUrl = await QRCode.toDataURL(shortCode, { width: 400, margin: 2 });

              batch.set(roomRef, {
                roomNumber: roomNum,
                score: 0,
                studentUid: null,
                qrCodeUrl,
                maxOccupants: maxOccupants,
                currentOccupants: 0,
                occupants: []
              });
              operationCount++;
              await commitBatchIfNeeded();
            }
          }
        }
      }

      if (operationCount > 0) await batch.commit();

      navigate('/warden/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      setError('Failed to setup hostel. ' + err.message);
      setLoading(false);
    }
  };

  const renderTreeView = () => (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24, height: 'fit-content', position: 'sticky', top: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg>
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Live Hierarchy</h3>
      </div>
      
      {blocks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', border: '1px dashed var(--border)', borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5"><path d="M12 2v20M2 12h20M12 2l4 4M12 2l-4 4M12 22l4-4M12 22l-4-4M2 12l4 4M2 12l4-4M22 12l-4 4M22 12l-4-4"/></svg>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>No blocks added yet.</p>
        </div>
      )}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {blocks.map(b => (
          <div key={b.id} style={{ borderLeft: '2px solid var(--primary-border)', paddingLeft: 16, paddingBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{b.name}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {b.buildings.map(bld => (
                <div key={bld.id} style={{ background: 'var(--bg-surface)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 21h18M3 7v1l-2 2v2l2 2v1l-2 2v2l2 2V7zm18 0v1l2 2v2l-2 2v1l2 2v2l-2 2V7zM7 7v14M12 7v14M17 7v14"/></svg>
                    {bld.name}
                    <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-3)' }}>({bld.totalFloors} floors)</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                    {bld.floors.map(fl => {
                      const roomCount = parseRoomRange(fl.roomRange).length;
                      return (
                        <div key={fl.id} style={{ 
                          fontSize: 10, 
                          padding: '2px 6px', 
                          borderRadius: 4, 
                          background: roomCount > 0 ? 'var(--green-soft)' : 'var(--bg-input)', 
                          color: roomCount > 0 ? 'var(--green)' : 'var(--text)', 
                          border: '1px solid var(--border)',
                          fontWeight: 500
                        }}>
                          Fl {fl.floorNumber}: {roomCount}
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

  const stepLabels = ['Identity', 'Architecture', 'Rooms'];

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: 64 }}>
      <Navbar />
      
      {/* Background Decor */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.15, pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '48px 20px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-0.04em', marginBottom: 8 }}>Map Your Hostel</h1>
          <p style={{ fontSize: 15, color: 'var(--text-2)', maxWidth: 500, margin: '0 auto' }}>Design your hostel's structural hierarchy to allow students to join their specific rooms.</p>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'flex-start', maxWidth: 600, margin: '0 auto 48px' }}>
          {stepLabels.map((label, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'flex-start', flex: n < 3 ? 1 : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 64 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700,
                    transition: 'all 0.3s',
                    background: done ? 'var(--primary)' : active ? 'transparent' : 'transparent',
                    border: done ? '2px solid var(--primary)' : active ? '2px solid var(--primary)' : '2px solid var(--border-strong)',
                    color: done ? '#fff' : active ? 'var(--primary)' : 'var(--text-3)',
                    boxShadow: active ? '0 0 20px rgba(108,99,255,0.2)' : 'none',
                  }}>
                    {done ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg> : n}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: active ? 'var(--primary)' : 'var(--text-3)' }}>{label}</span>
                </div>
                {n < 3 && <div style={{ flex: 1, height: 2, background: done ? 'var(--primary)' : 'var(--border)', marginTop: 18, marginX: 8, borderRadius: 1 }} />}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 32, alignItems: 'start' }}>
          
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 24, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }}>
            <div style={{ height: 4, background: 'var(--primary)' }} />
            <div style={{ padding: 32 }}>

              {error && (
                <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--red-soft)', border: '1px solid var(--red-border)', color: 'var(--red)', fontSize: 13, fontWeight: 500, marginBottom: 24 }}>
                  {error}
                </div>
              )}

              {/* STEP 1 */}
              {step === 1 && (
                <div className="animation-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Hostel Information</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>This is how your hostel will appear to students on the join page.</p>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: 8 }}>Hostel Name</label>
                    <input 
                      style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-input)', border: '1px solid var(--border-strong)', borderRadius: 10, fontSize: 14, color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }}
                      value={hostelName} onChange={e => setHostelName(e.target.value)} placeholder="e.g. Boys Hostel A" 
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 8 }}>College (Verified)</label>
                    <input 
                      style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, color: 'var(--text-3)', cursor: 'not-allowed' }}
                      value={collegeName} disabled 
                    />
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <button 
                      style={{ padding: '12px 32px', borderRadius: 12, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 16px rgba(108,99,255,0.2)' }}
                      disabled={!hostelName.trim()} onClick={() => setStep(2)}
                    >
                      Continue to Structure
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="animation-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Choose Setup Mode</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Select how you'd like to build your hostel hierarchy.</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div 
                      onClick={() => { setSetupMode('quick'); setBlocks([]); }}
                      style={{ 
                        padding: 24, borderRadius: 16, border: '2px solid', 
                        borderColor: setupMode === 'quick' ? 'var(--primary)' : 'var(--border)',
                        background: setupMode === 'quick' ? 'var(--primary-soft)' : 'transparent',
                        cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center'
                      }}
                    >
                      <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 L3 14 L12 14 L11 22 L21 10 L12 10 L13 2Z"/></svg>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Quick Setup</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>Perfect for standard buildings with uniform room numbering.</div>
                    </div>
                    
                    <div 
                      onClick={() => { setSetupMode('advanced'); setBlocks([]); }}
                      style={{ 
                        padding: 24, borderRadius: 16, border: '2px solid', 
                        borderColor: setupMode === 'advanced' ? 'var(--primary)' : 'var(--border)',
                        background: setupMode === 'advanced' ? 'var(--primary-soft)' : 'transparent',
                        cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center'
                      }}
                    >
                      <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 7v14M21 7v14M2 3h20M7 7v14M12 7v14M17 7v14"/></svg>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Advanced Setup</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>For complex complexes with multiple wings and custom blocks.</div>
                    </div>
                  </div>

                  {setupMode === 'quick' && (
                    <div className="animation-fade-in" style={{ background: 'var(--bg-surface)', padding: 24, borderRadius: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 20 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <NumberInput label="Total Floors" value={qsFloors} onChange={setQsFloors} />
                        <NumberInput label="Rooms / Floor" value={qsRoomsPerFloor} onChange={setQsRoomsPerFloor} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <NumberInput label="Starting Room #" value={qsStartingRoom} onChange={setQsStartingRoom} min={1} max={9999} />
                        <NumberInput label="Max Occupants" value={maxOccupants} onChange={setMaxOccupants} min={1} max={10} />
                      </div>
                      <button 
                        style={{ width: '100%', padding: 12, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                        onClick={handleQuickSetupGenerate}
                      >
                        Auto-Generate Hierarchy
                      </button>
                    </div>
                  )}

                  {setupMode === 'advanced' && (
                    <div className="animation-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      <div style={{ background: 'var(--bg-surface)', padding: 20, borderRadius: 16, border: '1px solid var(--border)' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 12 }}>Create Blocks</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input 
                            style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13 }}
                            value={newBlockName} onChange={e => setNewBlockName(e.target.value)} placeholder="e.g. A Block" 
                          />
                          <button style={{ padding: '0 16px', borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }} onClick={handleCreateBlock}>Add</button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {blocks.map(b => (
                          <div key={b.id} style={{ border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                            <div 
                              onClick={() => setActiveBlockId(activeBlockId === b.id ? null : b.id)}
                              style={{ padding: '14px 20px', background: 'var(--bg-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{b.name}</span>
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>{activeBlockId === b.id ? 'Close' : '+ Add Building'}</span>
                            </div>
                            
                            {activeBlockId === b.id && (
                              <div style={{ padding: 20, borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'grid', gridTemplateColumns: '1.5fr 1fr 40px', gap: 12 }}>
                                <input style={{ height: 38, padding: 10, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13 }} placeholder="Building Name" value={newBldName} onChange={e => setNewBldName(e.target.value)} />
                                <NumberInput value={newBldFloors} onChange={setNewBldFloors} />
                                <button style={{ height: 38, width: 38, borderRadius: 10, background: 'var(--primary)', border: 'none', color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer' }} onClick={(e) => handleCreateBuilding(e, b.id)}>+</button>
                              </div>
                            )}

                            <div style={{ padding: '0 20px 14px' }}>
                              {b.buildings.map(bld => (
                                <div key={bld.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                                  <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 21h18M3 7v14M21 7v14M2 3h20M7 7v14M12 7v14M17 7v14"/></svg>
                                    {bld.name}
                                  </div>
                                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{bld.totalFloors} floors</span>
                                </div>
                              ))}
                              {b.buildings.length === 0 && !activeBlockId && <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No buildings added</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {blocks.length > 0 && (
                        <button 
                          style={{ padding: 13, borderRadius: 12, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                          onClick={() => setStep(3)}
                        >
                          Confirm Hierachy →
                        </button>
                      )}
                    </div>
                  )}

                  <button style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setStep(1)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                    Back to Identity
                  </button>
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="animation-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Populate Rooms</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Define the room numbers for each floor using ranges or lists.</p>
                  </div>

                  <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 8, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {blocks.map(b => (
                      <div key={b.id} style={{ background: 'var(--bg-surface)', padding: 20, borderRadius: 16, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                          {b.name}
                        </div>
                        {b.buildings.map(bld => (
                          <div key={bld.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 21h18M3 7v14M21 7v14M2 3h20M7 7v14M12 7v14M17 7v14"/></svg>
                              {bld.name}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {bld.floors.map(fl => (
                                <div key={fl.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 40px', gap: 12, alignItems: 'center' }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>Floor {fl.floorNumber}</span>
                                  <input 
                                    style={{ padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text)' }}
                                    placeholder="101-110" 
                                    value={fl.roomRange}
                                    onChange={(e) => updateFloorRoomRange(b.id, bld.id, fl.id, e.target.value)}
                                  />
                                  <div style={{ textAlign: 'right', fontSize: 11, fontWeights: 700, color: 'var(--primary)' }}>{parseRoomRange(fl.roomRange).length}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 8, padding: 20, borderRadius: 16, background: 'var(--primary-soft)', border: '1px solid var(--primary-border)' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>Ready to Finalize?</div>
                    <p style={{ fontSize: 12, color: 'var(--primary)', opacity: 0.8, margin: 0 }}>We will generate the database structure and unique QR codes for all rooms.</p>
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button style={{ padding: '12px 24px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer' }} onClick={() => setStep(2)}>Back</button>
                    <button 
                      style={{ flex: 1, padding: 12, borderRadius: 12, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, boxShadow: '0 8px 16px rgba(108,99,255,0.2)', cursor: loading ? 'not-allowed' : 'pointer' }}
                      onClick={handleFinalSubmit} disabled={loading}
                    >
                      {loading ? 'Processing...' : 'Generate & Finalize'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          <div>
            {renderTreeView()}
          </div>

        </div>
      </div>
    </div>
  );
}
