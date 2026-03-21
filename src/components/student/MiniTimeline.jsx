import { getSLAStatus } from '../../utils/sla';

function timeAgo(date) {
  if (!date || typeof date.toDate !== 'function') return '?';
  const d = Date.now() - date.toDate().getTime();
  const m = Math.floor(d/60000), h = Math.floor(d/3600000), dy = Math.floor(d/86400000);
  return m < 60 ? `${m}m ago` : h < 24 ? `${h}h ago` : `${dy}d ago`;
}

function chipStyle(val, type = 'status') {
  if (type === 'priority') {
    if (val === 'high')   return { background:'#fee2e2', color:'#b91c1c' };
    if (val === 'medium') return { background:'#fef3c7', color:'#92400e' };
    return { background:'#d1fae5', color:'#065f46' };
  }
  if (val === 'in_progress') return { background:'#fef3c7', color:'#92400e' };
  if (val === 'todo')        return { background:'#fee2e2', color:'#b91c1c' };
  return { background:'#d1fae5', color:'#065f46' };
}

export default function MiniTimeline({ complaints, onSeeAll }) {
  const items = complaints.slice(0, 4);
  const nodeColors = {
    in_progress: { bg:'#FEF3C7', border:'#F59E0B', icon:'#D97706', line:'#F59E0B' },
    todo:        { bg:'#FEE2E2', border:'#EF4444', icon:'#DC2626', line:'#EF4444' },
    resolved:    { bg:'#D1FAE5', border:'#10B981', icon:'#059669', line:'#10B981' },
  };

  const NodeIcon = ({ status, color }) => {
    if (status === 'resolved') return (
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
    );
    if (status === 'in_progress') return (
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M2 12h4M18 12h4"/></svg>
    );
    return (
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3"><circle cx="12" cy="12" r="8"/></svg>
    );
  };

  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px 10px', borderBottom:'1px solid var(--border)' }}>
        <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>Recent complaints</span>
        <button onClick={onSeeAll} style={{ fontSize:11.5, color:'var(--primary)', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:3, fontFamily:'var(--font)' }}>
          See all
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>

      {items.length === 0 && (
        <div style={{ padding:'24px 16px', textAlign:'center', fontSize:13, color:'var(--text-3)' }}>
          No complaints yet
        </div>
      )}

      {items.map((c, i) => {
        const nc = nodeColors[c.status] || nodeColors.todo;
        const sla = getSLAStatus(c);
        const isLast = i === items.length - 1;
        const timeStr = timeAgo(c.createdAt);

        return (
          <div key={c.id} style={{ display:'flex', gap:10, alignItems:'stretch', padding:'0 14px' }}>
            {/* Spine */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:24, flexShrink:0, paddingTop:12 }}>
              <div style={{ width:20, height:20, borderRadius:'50%', background:nc.bg, border:`1.5px solid ${nc.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <NodeIcon status={c.status} color={nc.icon} />
              </div>
              {!isLast && <div style={{ width:1.5, flex:1, minHeight:12, marginTop:4, background:nc.line, opacity:0.25, borderRadius:1 }} />}
            </div>

            {/* Body */}
            <div style={{ flex:1, padding:'10px 0 10px', borderBottom: isLast ? 'none' : '1px solid var(--border)', opacity: c.status==='resolved' ? 0.6 : 1 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:180 }}>{c.title}</div>
                <div style={{ fontSize:10.5, color:'var(--text-3)', flexShrink:0, fontFamily:'var(--font-mono)' }}>{timeStr}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                <span style={{ fontSize:10, fontWeight:500, padding:'1.5px 6px', borderRadius:3, ...chipStyle(c.status) }}>
                  {c.status === 'in_progress' ? 'In Progress' : c.status === 'todo' ? 'To Do' : 'Resolved'}
                </span>
                <span style={{ fontSize:10, fontWeight:500, padding:'1.5px 6px', borderRadius:3, ...chipStyle(c.priority, 'priority') }}>
                  {c.priority}
                </span>
                <span style={{ fontSize:10, padding:'1.5px 6px', borderRadius:3, background:'var(--bg-input)', color:'var(--text-2)' }}>
                  {c.category}
                </span>
                {sla?.breached && (
                  <span style={{ fontSize:10, fontWeight:600, padding:'1.5px 6px', borderRadius:3, background:'#fce7f3', color:'#9d174d', display:'flex', alignItems:'center', gap:3 }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Timer breach
                  </span>
                )}
                {sla && !sla.breached && (
                  <span style={{ fontSize:10, color:'var(--text-3)', fontFamily:'var(--font-mono)' }}>
                    {sla.label}
                  </span>
                )}
              </div>
              {/* SLA bar */}
              {sla && c.status !== 'resolved' && (
                <div style={{ height:2, borderRadius:1, marginTop:6, background:'var(--bg-input)', overflow:'hidden' }}>
                  <div style={{ width:`${sla.percent}%`, height:'100%', borderRadius:1, background: sla.percent >= 80 ? 'var(--red)' : sla.percent >= 50 ? 'var(--amber)' : 'var(--green)', transition:'width 0.4s' }} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
