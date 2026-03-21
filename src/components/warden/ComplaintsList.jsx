import { useState } from 'react';
import { updateComplaintStatus } from '../../firebase/firestore';

function timeAgo(date) {
  if (!date) return '';
  const d = typeof date.toDate === 'function' ? date.toDate() : new Date(date);
  const seconds = Math.floor((new Date() - d) / 1000);
  let interval = seconds / 31536000;
  if(interval > 1) return Math.floor(interval) + "y";
  interval = seconds / 2592000;
  if(interval > 1) return Math.floor(interval) + "mo";
  interval = seconds / 86400;
  if(interval > 1) return Math.floor(interval) + "d";
  interval = seconds / 3600;
  if(interval > 1) return Math.floor(interval) + "h";
  interval = seconds / 60;
  if(interval > 1) return Math.floor(interval) + "m";
  return Math.floor(seconds) + "s";
}

export default function ComplaintsList({ complaints }) {
  const [selected, setSelected] = useState(null);
  const [showingOriginal, setShowingOriginal] = useState({});

  const toggleOriginal = (id) => {
    setShowingOriginal(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Default Sort by newest
  const sorted = [...complaints].sort((a,b) => {
    const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
    const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
    return bTime - aTime;
  });

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative', overflow: 'hidden' }}>
      
      {/* Table Side */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: selected ? '24px' : '0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '0.75rem' }}>Room</th>
              <th style={{ padding: '0.75rem' }}>Category</th>
              <th style={{ padding: '0.75rem' }}>Priority</th>
              <th style={{ padding: '0.75rem' }}>Title</th>
              <th style={{ padding: '0.75rem' }}>Student</th>
              <th style={{ padding: '0.75rem' }}>Submitted</th>
              <th style={{ padding: '0.75rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(c => (
              <tr 
                key={c.id} 
                onClick={() => setSelected(c)}
                style={{ 
                  borderBottom: '1px solid var(--border)', 
                  cursor: 'pointer',
                  background: selected?.id === c.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                  transition: 'background 0.2s'
                }}
              >
                <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{c.roomNumber}</td>
                <td style={{ padding: '0.75rem' }}><span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>{c.category}</span></td>
                <td style={{ padding: '0.75rem' }}>
                  <span style={{ 
                    color: c.priority === 'low' ? '#10b981' : c.priority === 'medium' ? '#f59e0b' : '#ef4444',
                    textTransform: 'capitalize', fontWeight: 600
                  }}>
                    {c.priority}
                  </span>
                </td>
                <td style={{ padding: '0.75rem' }}>{c.title}</td>
                <td style={{ padding: '0.75rem' }}>{c.studentName}</td>
                <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{timeAgo(c.createdAt)} ago</td>
                <td style={{ padding: '0.75rem' }}>
                  <span className="badge" style={{ 
                    background: c.status === 'resolved' ? 'rgba(16,185,129,0.2)' : c.status === 'in_progress' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.1)',
                    color: c.status === 'resolved' ? '#10b981' : c.status === 'in_progress' ? '#3b82f6' : 'var(--text-muted)',
                    textTransform: 'capitalize'
                  }}>
                    {c.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No complaints found matching these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Side Drawer */}
      {selected && (
        <div className="card animation-fade-in" style={{ 
          width: '380px', height: '100%', overflowY: 'auto', 
          borderLeft: '1px solid var(--border)', background: 'var(--bg-raised)',
          display: 'flex', flexDirection: 'column'
        }}>
          <div className="flex justify-content-between align-items-center mb-3">
            <h3 className="m-0">Ticket Details</h3>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
          </div>

          <div className="mb-3">
            <div className="text-xs text-muted mb-1">Title</div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{selected.title}</div>
          </div>

          <div className="mb-3">
            <div className="text-xs text-muted mb-1">Status Action</div>
            <select 
              className="input" 
              value={selected.status}
              onChange={(e) => {
                updateComplaintStatus(selected, e.target.value);
                setSelected({ ...selected, status: e.target.value });
              }}
            >
              <option value="todo">To Do (Open)</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved (Restores Score)</option>
            </select>
          </div>

          <div className="stats-grid mb-3">
            <div className="stat-card" style={{ padding: '0.5rem' }}>
              <div className="stat-label">Room</div>
              <div className="stat-value text-sm">{selected.roomNumber} ({selected.buildingName})</div>
            </div>
            <div className="stat-card" style={{ padding: '0.5rem' }}>
              <div className="stat-label">Submitted By</div>
              <div className="stat-value text-sm">{selected.studentName}</div>
            </div>
          </div>

          <div className="mb-3">
            <div className="text-xs text-muted mb-1">Description</div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', fontSize: '0.95rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {showingOriginal[selected.id]
                ? (selected.descriptionOriginal || selected.description || <span className="text-secondary">No description provided.</span>)
                : (selected.descriptionTranslated || selected.description || <span className="text-secondary">No description provided.</span>)
              }
            </div>
            {selected.descriptionOriginal && selected.descriptionTranslated && selected.descriptionOriginal !== selected.descriptionTranslated && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                <span
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => toggleOriginal(selected.id)}
                >
                  {showingOriginal[selected.id]
                    ? 'Show English'
                    : `Originally in ${selected.detectedLanguage || 'other language'}`}
                </span>
              </div>
            )}
          </div>

          {selected.mediaUrls?.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-muted mb-1">Attached Media</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {selected.mediaUrls.map((url, idx) => {
                  const type = selected.mediaTypes[idx];
                  if (type === 'image') return <a href={url} target="_blank" rel="noreferrer" key={idx}><img src={url} alt="attachment" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }} /></a>;
                  if (type === 'video') return <video key={idx} src={url} controls style={{ width: '100%', maxHeight: 200, borderRadius: 4, background: '#000' }} />;
                  if (type === 'audio') return <audio key={idx} src={url} controls style={{ width: '100%', marginTop: '0.5rem' }} />;
                  return <a key={idx} href={url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">View File</a>;
                })}
              </div>
            </div>
          )}
          
        </div>
      )}

    </div>
  );
}
