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
    try {
      const history = await fetchRoomHistory(room.id);
      setFullRoomHistory(history);
      if (history.length > 0) {
        const summary = await generateRoomSummary(history);
        setRoomSummary(summary);
      }
    } catch (err) {
      console.error('Failed to load room history:', err);
    } finally {
      setHistoryLoading(false);
    }
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
              transition: 'width 0.4s',
              willChange: 'width'
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
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button 
                    onClick={(e) => openHistoryDrawer(e, room)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-ghost)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
                    title="View history"
                    className="hover-primary"
                  >
                    <span className="material-icons-round" style={{ fontSize: 18 }}>history</span>
                  </button>
                  <div className="badge" style={{
                    background: current >= max ? 'rgba(240,101,101,0.2)' : 'rgba(34,211,160,0.2)',
                    color: current >= max ? '#F06565' : '#22D3A0'
                  }}>
                    {current}/{max}
                  </div>
                </div>
              </div>

              {/* Occupancy bar */}
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${percent}%`,
                  background: current >= max ? '#F06565' : percent > 75 ? '#F5A623' : '#22D3A0',
                  transition: 'width 0.3s',
                  willChange: 'width'
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
                                PRN: {detail ? (detail.PRN || 'N/A') : 'Loading...'}
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
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)',
          display: 'flex', justifyContent: 'flex-end', backdropFilter: 'blur(4px)'
        }} onClick={() => setHistoryDrawerRoom(null)}>
          <div style={{
            width: '450px', maxWidth: '100%', background: '#0f172a',
            height: '100%', padding: '2rem', overflowY: 'auto',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', position: 'relative',
            borderLeft: '1px solid rgba(255,255,255,0.05)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#F1F5F9' }}>Room {historyDrawerRoom.roomNumber}</h2>
                <div style={{ fontSize: '13px', color: '#475569', marginTop: 4 }}>Complaint History & Resolution</div>
              </div>
              <button 
                onClick={() => setHistoryDrawerRoom(null)} 
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#F1F5F9', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <span className="material-icons-round" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                Loading history...
              </div>
            ) : (
              <div className="animation-fade-in">
                {fullRoomHistory.length === 0 ? (
                  <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.1)', borderRadius: 16, padding: '2rem', textAlign: 'center', color: '#10B981' }}>
                    <span className="material-icons-round" style={{ fontSize: 40, marginBottom: 12 }}>verified</span>
                    <div style={{ fontWeight: 600 }}>Clean Record</div>
                    <div style={{ fontSize: '12px', marginTop: 4, opacity: 0.8 }}>No complaints on record for this room.</div>
                  </div>
                ) : (
                  <>
                    {roomSummary?.aiSummary && (
                      <div style={{
                        fontSize: '13px', color: '#E2E8F0',
                        fontStyle: 'italic', marginBottom: '1.5rem',
                        padding: '16px', borderRadius: '12px',
                        background: 'rgba(108,99,255,0.05)',
                        border: '1px solid rgba(108,99,255,0.15)',
                        lineHeight: 1.6
                      }}>
                        "{roomSummary.aiSummary}"
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '2rem' }}>
                      {[
                        { label: 'Total Tickets', value: roomSummary?.total, color: '#F1F5F9' },
                        { label: 'Resolved', value: roomSummary?.resolved, color: '#10B981' },
                        { label: 'Top Category', value: roomSummary?.topCategory, color: '#6C63FF' },
                        { label: 'Avg Fix Time', value: roomSummary?.avgResolutionHours ? `${roomSummary.avgResolutionHours}h` : 'N/A', color: '#F59E0B' },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{
                          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                          borderRadius: '12px', padding: '12px'
                        }}>
                          <div style={{ fontSize: '10px', color: '#475569', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                      Timeline
                      <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {fullRoomHistory.map((c, i) => (
                        <div key={c.id} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                          {i < fullRoomHistory.length - 1 && (
                            <div style={{ position: 'absolute', left: '7px', top: '24px', width: '2px', bottom: '-20px', background: 'rgba(255,255,255,0.05)' }} />
                          )}
                          <div style={{
                            width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, marginTop: '4px',
                            background: c.status === 'resolved' ? '#10B981' : c.priority === 'high' ? '#EF4444' : '#F59E0B',
                            boxShadow: `0 0 10px ${c.status === 'resolved' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                            zIndex: 1
                          }} />
                          <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 12, border: '1px solid rgba(255,255,255,0.03)' }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#F1F5F9' }}>{c.title}</div>
                            <div style={{ fontSize: '12px', color: '#475569', marginTop: 4 }}>
                              {c.category} • {c.priority} priority • {c.createdAt?.toDate?.().toLocaleDateString('en-IN')}
                            </div>
                            <div style={{ marginTop: 8, fontSize: '13px', color: '#E2E8F0', lineHeight: 1.5 }}>
                              {c.descriptionTranslated || c.description}
                            </div>
                            {c.status === 'resolved' && c.resolvedAt && (
                              <div style={{ marginTop: 8, fontSize: '11px', color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span className="material-icons-round" style={{ fontSize: 14 }}>task_alt</span>
                                Resolved in {Math.round((c.resolvedAt.toDate() - c.createdAt.toDate()) / 3600000)}h
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
