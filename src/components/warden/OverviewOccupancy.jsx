import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getAllRooms, ejectStudentTransaction } from '../../firebase/firestore';
import { fetchRoomHistory, generateRoomSummary } from '../../firebase/roomHistory';

export default function OverviewOccupancy({ hostelId }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ejecting, setEjecting] = useState(null); // uid being ejected
  const [expandedRoom, setExpandedRoom] = useState(null);
  const [occupantDetails, setOccupantDetails] = useState({}); // uid -> { name, PRN, email }

  const [historyDrawerRoom, setHistoryDrawerRoom] = useState(null);
  const [fullRoomHistory, setFullRoomHistory] = useState([]);
  const [roomSummary, setRoomSummary] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistoryDrawer = async (e, room) => {
    e.stopPropagation();
    setHistoryDrawerRoom(room);
    setHistoryLoading(true);
    const history = await fetchRoomHistory(room.id);
    setFullRoomHistory(history);
    if (history.length > 0) {
      const summary = await generateRoomSummary(history);
      setRoomSummary(summary);
    }
    setHistoryLoading(false);
  };

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
          <div className="text-secondary text-sm mb-1">Overall Hostel Occupancy</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totalFilled} / {totalBeds} beds</div>
        </div>
        <div style={{ width: 200 }}>
          <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 5,
              width: `${overallPercent}%`,
              background: overallPercent > 90 ? '#F06565' : overallPercent > 70 ? '#F5A623' : '#22D3A0',
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
                border: current >= max ? '1px solid rgba(240,101,101,0.3)' : '1px solid var(--border)',
                transition: 'border-color 0.2s'
              }}
              onClick={() => toggleExpand(room)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div>
                  <div className="font-bold">Room {room.roomNumber}</div>
                  <div className="text-secondary text-xs">{room.buildingName} · Fl {room.floorNumber}</div>
                </div>
                <div className="badge" style={{
                  background: current >= max ? 'rgba(240,101,101,0.2)' : 'rgba(34,211,160,0.2)',
                  color: current >= max ? '#F06565' : '#22D3A0'
                }}>
                  {current}/{max}
                </div>
              </div>

              {/* Occupancy bar */}
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${percent}%`,
                  background: current >= max ? '#F06565' : percent > 75 ? '#F5A623' : '#22D3A0',
                  transition: 'width 0.3s'
                }} />
              </div>

              {/* Expanded occupant list */}
              {isExpanded && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  {occupants.length === 0 ? (
                    <p className="text-secondary text-sm">No students registered yet.</p>
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
                              style={{ background: '#F06565', color: 'white', border: 'none', padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}
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

                  <button
                    onClick={(e) => openHistoryDrawer(e, room)}
                    style={{
                      width: '100%', marginTop: '12px', padding: '8px',
                      background: 'rgba(79,163,247,0.1)', border: '1px solid rgba(79,163,247,0.3)',
                      borderRadius: '6px', color: '#4FA3F7', fontSize: '0.8rem',
                      cursor: 'pointer', fontWeight: 600
                    }}
                  >
                    View Full Room History
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {historyDrawerRoom && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)',
          display: 'flex', justifyContent: 'flex-end'
        }} onClick={() => setHistoryDrawerRoom(null)}>
          <div style={{
            width: '400px', maxWidth: '100%', background: 'var(--bg-base)',
            height: '100%', padding: '1.5rem', overflowY: 'auto',
            transform: 'translateX(0)', transition: 'transform 0.3s',
            boxShadow: '-4px 0 15px rgba(0,0,0,0.3)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Room {historyDrawerRoom.roomNumber} History</h2>
              <button onClick={() => setHistoryDrawerRoom(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading history...</div>
            ) : (
              <>
                {fullRoomHistory.length === 0 ? (
                  <div style={{ color: '#22D3A0', textAlign: 'center', padding: '2rem' }}>
                    ✓ No complaints on record. This room has a clean history.
                  </div>
                ) : (
                  <>
                    {roomSummary?.aiSummary && (
                      <div style={{
                        fontSize: '0.85rem', color: 'var(--text-muted)',
                        fontStyle: 'italic', marginBottom: '1rem',
                        padding: '12px', borderRadius: '8px',
                        background: 'rgba(79,163,247,0.08)',
                        border: '1px solid rgba(79,163,247,0.2)'
                      }}>
                        "{roomSummary.aiSummary}"
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                      {[
                        { label: 'Total complaints', value: roomSummary?.total },
                        { label: 'Resolved', value: roomSummary?.resolved },
                        { label: 'Top issue', value: roomSummary?.topCategory },
                        { label: 'Avg fix time', value: roomSummary?.avgResolutionHours ? `${roomSummary.avgResolutionHours}h` : 'N/A' },
                      ].map(({ label, value }) => (
                        <div key={label} style={{
                          background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 12px',
                          flex: '1', minWidth: '80px'
                        }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
                          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                      Full Complaint Timeline
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {fullRoomHistory.map((c, i) => (
                        <div key={c.id} style={{ display: 'flex', gap: '12px', paddingBottom: i < fullRoomHistory.length - 1 ? '16px' : '0', position: 'relative' }}>
                          {i < fullRoomHistory.length - 1 && (
                            <div style={{ position: 'absolute', left: '7px', top: '18px', width: '2px', bottom: 0, background: 'var(--border)' }} />
                          )}
                          <div style={{
                            width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
                            background: c.status === 'resolved' ? '#22D3A0' : c.priority === 'high' ? '#F06565' : '#F5A623'
                          }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{c.title}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              {c.category} • {c.priority} priority<br/>
                              Filed by: {c.studentName || c.studentUid} on {c.createdAt?.toDate?.().toLocaleDateString('en-IN')}<br/>
                              {c.status === 'resolved' && c.resolvedAt && (
                                <span style={{ color: '#22D3A0' }}>Fixed in {Math.round((c.resolvedAt.toDate() - c.createdAt.toDate()) / 3600000)}h</span>
                              )}
                            </div>
                            <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                              {c.descriptionTranslated || c.description}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
