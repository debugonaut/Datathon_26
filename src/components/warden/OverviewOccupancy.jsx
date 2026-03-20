import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getAllRooms, ejectStudentTransaction } from '../../firebase/firestore';

export default function OverviewOccupancy({ hostelId }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ejecting, setEjecting] = useState(null); // uid being ejected
  const [expandedRoom, setExpandedRoom] = useState(null);
  const [occupantDetails, setOccupantDetails] = useState({}); // uid -> { name, PRN, email }

  useEffect(() => {
    loadRooms();
  }, [hostelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRooms = async () => {
    try {
      const data = await getAllRooms(hostelId);
      data.sort((a, b) => {
        if (a.buildingName !== b.buildingName) return a.buildingName.localeCompare(b.buildingName);
        if (a.floorNumber !== b.floorNumber) return a.floorNumber - b.floorNumber;
        return a.roomNumber - b.roomNumber;
      });
      setRooms(data);
    } catch (err) {
      console.error('Error loading rooms for occupancy', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (room) => {
    if (expandedRoom === room.id) {
      setExpandedRoom(null);
      return;
    }
    setExpandedRoom(room.id);

    // Fetch occupant user details
    const occupants = room.occupants || [];
    for (const occ of occupants) {
      if (occupantDetails[occ.uid]) continue;
      try {
        const userSnap = await getDoc(doc(db, 'users', occ.uid));
        if (userSnap.exists()) {
          const ud = userSnap.data();
          setOccupantDetails(prev => ({
            ...prev,
            [occ.uid]: { name: ud.name, PRN: ud.PRN, email: ud.email }
          }));
        }
      } catch (err) {
        console.error('Error fetching occupant', occ.uid, err);
      }
    }
  };

  const handleEject = async (occupantEntry, room) => {
    if (!window.confirm(`Are you sure you want to eject ${occupantEntry.name} from Room ${room.roomNumber}? This cannot be undone.`)) return;

    setEjecting(occupantEntry.uid);
    try {
      await ejectStudentTransaction(occupantEntry, {
        hostelId: room.hostelId || hostelId,
        blockId: room.blockId,
        buildingId: room.buildingId,
        floorId: room.floorId,
        roomId: room.id
      });
      // Refresh
      await loadRooms();
    } catch (err) {
      console.error('Eject failed:', err);
      alert('Failed to eject student: ' + err.message);
    } finally {
      setEjecting(null);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;

  const totalBeds = rooms.reduce((s, r) => s + (r.maxOccupants || 2), 0);
  const totalFilled = rooms.reduce((s, r) => s + (r.currentOccupants || 0), 0);
  const overallPercent = totalBeds > 0 ? Math.round((totalFilled / totalBeds) * 100) : 0;

  return (
    <div>
      {/* Overall Stats */}
      <div className="card mb-3" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <div style={{ flex: 1 }}>
          <div className="text-muted text-sm mb-1">Overall Hostel Occupancy</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totalFilled} / {totalBeds} beds</div>
        </div>
        <div style={{ width: 200 }}>
          <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 5,
              width: `${overallPercent}%`,
              background: overallPercent > 90 ? '#ef4444' : overallPercent > 70 ? '#f59e0b' : '#10b981',
              transition: 'width 0.4s'
            }} />
          </div>
          <div className="text-xs text-muted mt-1 text-right">{overallPercent}%</div>
        </div>
      </div>

      {/* Room Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {rooms.map(room => {
          const current = room.currentOccupants || 0;
          const max = room.maxOccupants || 2;
          const percent = max > 0 ? Math.round((current / max) * 100) : 0;
          const occupants = room.occupants || [];
          const isExpanded = expandedRoom === room.id;

          return (
            <div
              key={room.id}
              className="card"
              style={{
                cursor: 'pointer',
                border: current >= max ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border)',
                transition: 'border-color 0.2s'
              }}
              onClick={() => toggleExpand(room)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div>
                  <div className="font-bold">Room {room.roomNumber}</div>
                  <div className="text-muted text-xs">{room.buildingName} · Fl {room.floorNumber}</div>
                </div>
                <div className="badge" style={{
                  background: current >= max ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                  color: current >= max ? '#ef4444' : '#10b981'
                }}>
                  {current}/{max}
                </div>
              </div>

              {/* Occupancy bar */}
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${percent}%`,
                  background: current >= max ? '#ef4444' : percent > 75 ? '#f59e0b' : '#10b981',
                  transition: 'width 0.3s'
                }} />
              </div>

              {/* Expanded occupant list */}
              {isExpanded && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  {occupants.length === 0 ? (
                    <p className="text-muted text-sm">No students registered yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {occupants.map(occ => {
                        const detail = occupantDetails[occ.uid];
                        return (
                          <div key={occ.uid} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px'
                          }}>
                            <div>
                              <div className="text-sm font-bold">{detail?.name || occ.name}</div>
                              <div className="text-xs text-muted">
                                PRN: {detail?.PRN || 'Loading...'}
                              </div>
                            </div>
                            <button
                              className="btn btn-sm"
                              style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}
                              onClick={(e) => { e.stopPropagation(); handleEject(occ, room); }}
                              disabled={ejecting === occ.uid}
                            >
                              {ejecting === occ.uid ? '...' : 'Eject'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
