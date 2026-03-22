import { useState, useEffect } from 'react';
import { fetchRoomHistory, generateRoomSummary } from '../../firebase/roomHistory';

export default function RoomHistoryModal({ room, onClose }) {
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!room) return;
    const load = async () => {
      setLoading(true);
      const h = await fetchRoomHistory(room.roomId || room.id);
      setHistory(h);
      if (h.length > 0) {
        const s = await generateRoomSummary(h);
        setSummary(s);
      }
      setLoading(false);
    };
    load();
  }, [room]);

  if (!room) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease-out'
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 500, background: 'var(--bg-card)', borderRadius: 24,
        border: '1px solid var(--border)', overflow: 'hidden', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Room {room.roomNumber} History</h2>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 0' }}>{room.buildingName || 'Hostel'} · Floor {room.floorNumber || '0'}</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--bg-input)', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-icons-round" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 12 }}>Fetching room records...</p>
            </div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🧹</div>
              <p style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 600 }}>No complaints on record.</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>This room has a clean history.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {summary?.aiSummary && (
                <div style={{ padding: 16, borderRadius: 16, background: 'var(--primary-soft)', border: '1px solid var(--primary-border)', position: 'relative' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 6, opacity: 0.8 }}>AI Insight</div>
                  <p style={{ fontSize: 13, color: 'var(--primary)', margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>"{summary.aiSummary}"</p>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Total Tickets', value: summary?.total, icon: 'receipt' },
                  { label: 'Avg Fix Time', value: summary?.avgResolutionHours ? `${summary.avgResolutionHours}h` : 'N/A', icon: 'schedule' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--bg-input)', padding: '12px 16px', borderRadius: 16, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Timeline</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {history.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', gap: 16, paddingBottom: i < history.length - 1 ? 24 : 0, position: 'relative' }}>
                      {i < history.length - 1 && (
                        <div style={{ position: 'absolute', left: 7, top: 12, width: 2, bottom: 0, background: 'var(--border)' }} />
                      )}
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: c.status === 'resolved' ? 'var(--green)' : c.priority === 'high' ? 'var(--red)' : 'var(--amber)', zIndex: 1, border: '4px solid var(--bg-card)', flexShrink: 0 }} />
                      <div style={{ flex: 1, marginTop: -2 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{c.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{c.category} · {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString('en-IN') : 'Recent'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.5, padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 10 }}>{c.descriptionTranslated || c.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <button onClick={onClose} style={{ width: '100%', padding: 12, borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer' }}>Close History</button>
        </div>
      </div>
    </div>
  );
}
