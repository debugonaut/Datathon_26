import React from 'react';

const complaints = [
  { id: '101', category: 'Plumbing', priority: 'HIGH', time: '-12m ago', state: 'overdue', desc: 'Water leak in B-Block 1st Floor washroom', seen: true },
  { id: '102', category: 'Electrical', priority: 'MED', time: '-45m ago', state: 'in-progress', desc: 'Fan regulator broken in Room 312', seen: true },
  { id: '103', category: 'Internet', priority: 'LOW', time: '-2h ago', state: 'resolved', desc: 'WiFi deadzone in library corner', seen: false },
  { id: '104', category: 'Cleaning', priority: 'MED', time: '-4h ago', state: 'resolved', desc: 'Corridor C needs sweeping', seen: true },
  { id: '105', category: 'Plumbing', priority: 'HIGH', time: '-281m ago', state: 'overdue', desc: 'Pipe burst near mess area', seen: true },
];

export default function ComplaintTimeline() {
  const getStateColor = (state) => {
    if (state === 'resolved') return 'var(--accent-green)';
    if (state === 'in-progress') return 'var(--accent-amber)';
    return 'var(--accent-red)';
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      height: '100%',
      width: '100%',
      background: 'var(--bg)',
      padding: '20px 0'
    }}>
      <h3 style={{
        marginTop: 0,
        marginBottom: '4px',
        fontSize: '1.1rem',
        fontWeight: 600,
        fontFamily: 'var(--font-heading)'
      }}>Live Timeline</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
        Real-time feed of active hostel issues.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
        {complaints.map(c => (
          <div key={c.id} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            display: 'flex',
            gap: '12px',
            transition: 'all 0.2s ease',
            cursor: 'pointer'
          }} className="timeline-card">
            
            {/* Left Dot indicator */}
            <div style={{ marginTop: '6px' }}>
              <div style={{
                width: '8px', height: '8px',
                borderRadius: '50%',
                background: getStateColor(c.state),
                boxShadow: `0 0 8px ${getStateColor(c.state)}40`
              }} />
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              
              {/* Header Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Priority Badge */}
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '4px',  // Sharp chip per prompt
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    backgroundColor: c.priority === 'HIGH' ? 'rgba(240, 101, 101, 0.15)' : c.priority === 'MED' ? 'rgba(245, 166, 35, 0.15)' : 'rgba(79, 163, 247, 0.15)',
                    color: c.priority === 'HIGH' ? 'var(--accent-red)' : c.priority === 'MED' ? 'var(--accent-amber)' : 'var(--accent-blue)',
                    border: `1px solid ${c.priority === 'HIGH' ? 'rgba(240, 101, 101, 0.3)' : c.priority === 'MED' ? 'rgba(245, 166, 35, 0.3)' : 'rgba(79, 163, 247, 0.3)'}`
                  }}>
                    {c.priority}
                  </span>
                  
                  {/* Category Tag */}
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)'
                  }}>
                    {c.category}
                  </span>
                </div>
                
                {/* Time */}
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)'
                }}>
                  {c.time}
                </div>
              </div>

              {/* Body */}
              <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {c.desc}
              </div>

              {/* Meta actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {c.seen ? 'Warden has seen this' : 'Pending review'}
                </span>
                
                {c.state === 'resolved' && (
                  <span style={{
                    fontSize: '0.75rem',
                    color: 'var(--accent-primary)',
                    textDecoration: 'none',
                    borderBottom: '1px solid var(--accent-primary)',
                    paddingBottom: '1px',
                    cursor: 'pointer'
                  }}>
                    Issue not fixed? Re-open
                  </span>
                )}
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
