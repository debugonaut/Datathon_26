import { useState, useMemo } from 'react';
import { updateComplaintStatus } from '../../firebase/firestore';
import { getSLAStatus } from '../../utils/sla';
import { clusterComplaints } from '../../utils/clusterComplaints';
import { doc, updateDoc, Timestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

const statusConfig = {
  todo:        { color: '#EF4444', bg: 'rgba(239,68,68,0.07)',   label: 'To Do',       badge: '#ef4444' },
  in_progress: { color: '#6C63FF', bg: 'rgba(108,99,255,0.07)',  label: 'In Progress', badge: '#6C63FF' },
  resolved:    { color: '#10B981', bg: 'rgba(16,185,129,0.06)',  label: 'Resolved',    badge: '#10b981' },
};

const priorityConfig = {
  high:   { color: '#EF4444', label: 'High',   timerHours: 24 },
  medium: { color: '#F59E0B', label: 'Medium', timerHours: 72 },
  low:    { color: '#10B981', label: 'Low',    timerHours: 168 },
};

const categoryIcons = {
  Electrical: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>,
  Plumbing:   <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  Furniture:  <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 1 4 0"/></>,
  Cleaning:   <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></>,
  Internet:   <><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></>,
  Other:      <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
};

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

function ComplaintCardShell({ complaint }) {
  const { userDoc } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [showingOriginal, setShowingOriginal] = useState(false);

  const handleAcknowledge = async (e) => {
    e.stopPropagation();
    setIsProcessing(true);
    try { await updateComplaintStatus(complaint, 'in_progress'); }
    catch (err) { console.error('Acknowledgment failed:', err); alert('Failed to acknowledge: ' + err.message); }
    finally { setIsProcessing(false); }
  };

  const sla = getSLAStatus(complaint);
  const sc = statusConfig[complaint.status] || statusConfig.todo;
  const pc = priorityConfig[complaint.priority] || priorityConfig.low;
  const isResolved = complaint.status === 'resolved';
  const catIcon = categoryIcons[complaint.category] || categoryIcons.Other;

  return (
    <div key={complaint.id} style={{
      background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:16,
      overflow:'hidden', marginBottom:12,
      opacity: isResolved ? 0.55 : 1,
      transition:'transform 0.18s, box-shadow 0.18s',
    }}
      onMouseOver={e => { if (!isResolved) { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 28px rgba(0,0,0,0.15)'; }}}
      onMouseOut={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; }}
    >
      <div style={{ position:'relative', padding:'14px 18px 26px', background: sc.badge, overflow:'hidden' }}>
        <svg style={{ position:'absolute', bottom:-1, left:0, right:0, width:'100%', height:28 }} viewBox="0 0 600 28" preserveAspectRatio="none">
          <path d="M0 28 L600 0 L600 28 Z" fill="var(--bg-card)"/>
        </svg>
        <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">{catIcon}</svg>
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.92)' }}>{complaint.category} · Room {complaint.roomNumber}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.62)', marginTop:1 }}>
                Floor {complaint.floorNumber || '—'}
                {complaint.acknowledgedAt ? ' · ✓ Acknowledged' : ''}
                {complaint.reopenedAt && complaint.status !== 'resolved' ? ' · Re-opened' : ''}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.62)', fontFamily:'var(--font-mono)' }}>{timeAgo(complaint.createdAt)}</span>
            <span style={{ fontSize:10.5, fontWeight:700, padding:'3px 9px', borderRadius:20, background:'rgba(255,255,255,0.2)', color:'#fff' }}>
              {pc.label} · {sc.label}{sla?.breached ? ' · BREACH' : ''}
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding:'6px 18px 14px', display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', letterSpacing:'-0.01em', lineHeight:1.3, paddingTop:4 }}>{complaint.title}</div>
        {complaint.withdrawnAt && (
          <div style={{ fontSize:12, padding:'6px 10px', borderRadius:8, background:'var(--bg-input)', color:'var(--text-2)', border:'1px solid var(--border)' }}>
            Withdrawn: "{complaint.withdrawnReason}"
          </div>
        )}
        {complaint.reopenedAt && complaint.status !== 'resolved' && (
          <div style={{ fontSize:12, padding:'6px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', color:'var(--amber)', border:'1px solid rgba(245,158,11,0.2)' }}>
            Re-opened: "{complaint.reopenReason}"
          </div>
        )}
        <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.65 }}>
          {showingOriginal ? complaint.descriptionOriginal : (complaint.descriptionTranslated || complaint.description)}
          {complaint.descriptionOriginal && complaint.descriptionTranslated && complaint.descriptionOriginal !== complaint.descriptionTranslated && (
            <button onClick={() => setShowingOriginal(p => !p)} style={{ marginLeft:8, background:'none', border:'none', color:'var(--primary)', fontSize:12, cursor:'pointer', fontFamily:'var(--font)' }}>
              {showingOriginal ? 'Show English' : `Show ${complaint.detectedLanguage || 'original'}`}
            </button>
          )}
        </div>
        {complaint.mediaUrls?.length > 0 && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {complaint.mediaUrls.map((url, idx) => {
              const type = complaint.mediaTypes?.[idx] || 'document';
              return (
                <a key={idx} href={url} target="_blank" rel="noreferrer" style={{ fontSize:11.5, padding:'3px 9px', borderRadius:6, background:'var(--primary-soft)', color:'var(--primary)', border:'1px solid var(--primary-border)', textDecoration:'none', fontFamily:'var(--font-mono)', fontWeight:500 }}>
                  {type === 'image' ? 'IMG' : type === 'video' ? 'VID' : type === 'audio' ? 'AUD' : 'FILE'}
                </a>
              );
            })}
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:7 }}>
          {[
            ['Student', complaint.studentName || '—'],
            ['Room', `${complaint.roomNumber || '—'} · Fl ${complaint.floorNumber || '—'}`],
            ['Media', complaint.mediaUrls?.length > 0 ? `${complaint.mediaUrls.length} file${complaint.mediaUrls.length > 1 ? 's' : ''}` : 'None'],
            ['Notes', complaint.internalNotes?.length > 0 ? `${complaint.internalNotes.length}` : '0'],
          ].map(([lbl, val]) => (
            <div key={lbl} style={{ background:'var(--bg-input)', borderRadius:10, padding:'7px 10px' }}>
              <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-3)', marginBottom:2 }}>{lbl}</div>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{val}</div>
            </div>
          ))}
        </div>
        {sla && !isResolved && (
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 13px', borderRadius:12, background: sla.breached ? 'rgba(239,68,68,0.07)' : sla.critical ? 'rgba(245,158,11,0.07)' : 'rgba(16,185,129,0.06)' }}>
            <div style={{ position:'relative', width:46, height:46, flexShrink:0 }}>
              <svg width="46" height="46" viewBox="0 0 46 46" style={{ transform:'rotate(-90deg)' }}>
                <circle cx="23" cy="23" r="18" fill="none" stroke={sla.breached ? 'rgba(239,68,68,0.18)' : sla.critical ? 'rgba(245,158,11,0.18)' : 'rgba(16,185,129,0.18)'} strokeWidth="5"/>
                <circle cx="23" cy="23" r="18" fill="none"
                  stroke={sla.breached ? '#ef4444' : sla.critical ? '#f59e0b' : '#10b981'}
                  strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={`${(sla.percent / 100) * 113} 113`}
                />
              </svg>
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, fontFamily:'var(--font-mono)', color: sla.breached ? '#b91c1c' : sla.critical ? '#92400e' : '#059669' }}>
                {sla.breached ? '!!' : `${Math.round(sla.percent)}%`}
              </div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10.5, color:'var(--text-2)' }}>
                {pc.timerHours}h urgency timer · {complaint.priority} priority
              </div>
              <div style={{ fontSize:13.5, fontWeight:700, fontFamily:'var(--font-mono)', color: sla.breached ? '#b91c1c' : sla.critical ? '#92400e' : '#059669' }}>
                {sla.breached ? 'Timer breached' : sla.label}
              </div>
            </div>
            {complaint.estimatedResolutionAt && (
              <div style={{ fontSize:11.5, color:'var(--amber)', display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ETA: {new Date(typeof complaint.estimatedResolutionAt?.toDate === 'function' ? complaint.estimatedResolutionAt.toDate() : complaint.estimatedResolutionAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
              </div>
            )}
            <div style={{ fontSize:12, fontWeight:700, padding:'6px 12px', borderRadius:20, flexShrink:0,
              background: sla.breached ? 'rgba(239,68,68,0.12)' : sla.critical ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.1)',
              color: sla.breached ? '#b91c1c' : sla.critical ? '#92400e' : '#059669'
            }}>
              {sla.breached ? 'Overdue' : sla.critical ? 'Urgent' : 'On track'}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding:'0 18px 14px', display:'flex', flexDirection:'column', gap:8 }}>
        {!complaint.acknowledgedAt && complaint.status === 'todo' && !complaint.withdrawnAt && (
          <button onPointerDown={handleAcknowledge} disabled={isProcessing} style={{
            width:'100%', padding:10, borderRadius:12, border:'none',
            background: isProcessing ? 'var(--bg-input)' : 'var(--primary)',
            color: isProcessing ? 'var(--text-3)' : '#fff',
            fontSize:13, fontWeight:700, cursor: isProcessing ? 'not-allowed' : 'pointer',
            fontFamily:'var(--font)', display:'flex', alignItems:'center', justifyContent:'center', gap:6
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
            {isProcessing ? 'Processing…' : 'Acknowledge'}
          </button>
        )}
        {complaint.status === 'in_progress' && !complaint.withdrawnAt && (
          <button onPointerDown={async (e) => { e.stopPropagation(); await updateComplaintStatus(complaint, 'resolved'); }} style={{
            width:'100%', padding:10, borderRadius:12,
            border:'1px solid rgba(16,185,129,0.3)', background:'rgba(16,185,129,0.09)',
            color:'#059669', fontSize:13, fontWeight:700, cursor:'pointer',
            fontFamily:'var(--font)', display:'flex', alignItems:'center', justifyContent:'center', gap:6
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
            Mark as resolved
          </button>
        )}
        {complaint.status === 'in_progress' && !complaint.withdrawnAt && (
          <div style={{ display:'flex', gap:7 }} onPointerDown={e => e.stopPropagation()}>
            <input type="datetime-local"
              defaultValue={complaint.estimatedResolutionAt
                ? new Date((typeof complaint.estimatedResolutionAt.toDate === 'function' ? complaint.estimatedResolutionAt.toDate() : new Date(complaint.estimatedResolutionAt)) - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16) : ''}
              onChange={async (e) => {
                if (!e.target.value) return;
                await updateDoc(doc(db, 'complaints', complaint.id), { estimatedResolutionAt: Timestamp.fromDate(new Date(e.target.value)) });
              }}
              style={{ flex:1, padding:'8px 10px', borderRadius:10, background:'var(--bg-input)', border:'1px solid var(--border-strong)', color:'var(--text-2)', fontSize:12, fontFamily:'var(--font)' }}
            />
            <button onPointerDown={e => { e.stopPropagation(); setShowNotes(p => !p); }} style={{
              padding:'8px 14px', borderRadius:10, border:'1px solid var(--border-strong)',
              background:'transparent', color:'var(--text-2)', fontSize:12.5, cursor:'pointer', fontFamily:'var(--font)',
              display:'flex', alignItems:'center', gap:5
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              Notes {complaint.internalNotes?.length > 0 ? `(${complaint.internalNotes.length})` : ''}
            </button>
          </div>
        )}
        {complaint.status !== 'in_progress' && (
          <div style={{ display:'flex', gap:7 }}>
            {isResolved && (
              <button style={{ padding:'8px 14px', borderRadius:10, border:'1px solid var(--border-strong)', background:'transparent', color:'var(--text-2)', fontSize:12.5, cursor:'pointer', fontFamily:'var(--font)' }}>
                Re-open
              </button>
            )}
            <button onPointerDown={e => { e.stopPropagation(); setShowNotes(p => !p); }} style={{
              padding:'8px 14px', borderRadius:10, border:'1px solid var(--border-strong)',
              background:'transparent', color:'var(--text-2)', fontSize:12.5, cursor:'pointer', fontFamily:'var(--font)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              Notes {complaint.internalNotes?.length > 0 ? `(${complaint.internalNotes.length})` : ''}
            </button>
          </div>
        )}
        {showNotes && (
          <div style={{ padding:12, background:'var(--bg-input)', borderRadius:10, border:'1px solid var(--border)' }} onPointerDown={e => e.stopPropagation()}>
            {(complaint.internalNotes || []).map((note, i) => (
              <div key={i} style={{ fontSize:12.5, padding:'6px 0', borderBottom: i < (complaint.internalNotes||[]).length-1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ color:'var(--text)' }}>{note.text}</div>
                <div style={{ color:'var(--text-3)', fontSize:11, marginTop:2 }}>
                  {note.wardenName} · {note.createdAt?.toDate?.().toLocaleDateString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                </div>
              </div>
            ))}
            <div style={{ marginTop:8, display:'flex', gap:6 }}>
              <input type="text" placeholder="Add internal note…" value={newNote} onChange={e => setNewNote(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && newNote.trim()) {
                    await updateDoc(doc(db, 'complaints', complaint.id), { internalNotes: arrayUnion({ text: newNote.trim(), createdAt: Timestamp.now(), wardenName: userDoc?.name || 'Warden' }) });
                    setNewNote('');
                  }
                }}
                style={{ flex:1, padding:'7px 10px', borderRadius:8, background:'var(--bg-card)', border:'1px solid var(--border-strong)', color:'var(--text)', fontSize:12.5, fontFamily:'var(--font)' }}
              />
              <button onClick={async () => {
                if (!newNote.trim()) return;
                await updateDoc(doc(db, 'complaints', complaint.id), { internalNotes: arrayUnion({ text: newNote.trim(), createdAt: Timestamp.now(), wardenName: userDoc?.name || 'Warden' }) });
                setNewNote('');
              }} style={{ padding:'7px 12px', borderRadius:8, background:'var(--primary-soft)', border:'1px solid var(--primary-border)', color:'var(--primary)', cursor:'pointer', fontSize:12.5 }}>
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ComplaintsKanban({ complaints }) {
  const { userDoc } = useAuth();
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('urgent');

  const filteredComplaints = useMemo(() => {
    let list = complaints.filter(c => {
      const matchStatus = filterStatus === 'all' || c.status === filterStatus;
      const matchCat = filterCategory === 'all' || c.category === filterCategory;
      return matchStatus && matchCat;
    });
    if (sortBy === 'urgent') {
      list = list.sort((a, b) => {
        const slaA = getSLAStatus(a); const slaB = getSLAStatus(b);
        if (slaA?.breached && !slaB?.breached) return -1;
        if (!slaA?.breached && slaB?.breached) return 1;
        const pOrder = { high: 0, medium: 1, low: 2 };
        if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
        return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
      });
    } else if (sortBy === 'newest') {
      list = list.sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    } else if (sortBy === 'oldest') {
      list = list.sort((a,b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
    }
    return list;
  }, [complaints, filterStatus, filterCategory, sortBy]);

  const groupedComplaints = useMemo(() => {
    const active = filteredComplaints.filter(c => c.status !== 'resolved');
    const resolved = filteredComplaints.filter(c => c.status === 'resolved');
    const groups = {};
    active.forEach(c => {
      const d = c.createdAt?.toDate?.();
      if (!d) return;
      const diff = Math.floor((Date.now() - d) / 86400000);
      const label = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      if (!groups[label]) groups[label] = [];
      groups[label].push(c);
    });
    if (resolved.length) groups['__resolved__'] = resolved;
    return groups;
  }, [filteredComplaints]);

  const stats = useMemo(() => ({
    todo: complaints.filter(c => c.status === 'todo').length,
    in_progress: complaints.filter(c => c.status === 'in_progress').length,
    resolved: complaints.filter(c => c.status === 'resolved').length,
    breached: complaints.filter(c => getSLAStatus(c)?.breached).length,
  }), [complaints]);

  const clusters = clusterComplaints(complaints);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
      {/* Stats KPI Strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:16 }}>
        {[
          { label:'To Do',          val: stats.todo,        color:'#EF4444' },
          { label:'In Progress',    val: stats.in_progress, color:'#6C63FF' },
          { label:'Resolved',       val: stats.resolved,    color:'#10B981' },
          { label:'Timer breaches', val: stats.breached,    color:'#F59E0B' },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, padding:'11px 14px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:s.color, borderRadius:'12px 12px 0 0' }} />
            <div style={{ fontSize:9.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', color:'var(--text-3)', marginBottom:5, marginTop:3 }}>{s.label}</div>
            <div style={{ fontSize:26, fontWeight:700, fontFamily:'var(--font-mono)', color:s.val > 0 && s.label === 'Timer breaches' ? s.color : 'var(--text)', lineHeight:1 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Breach Alert */}
      {stats.breached > 0 && (
        <div style={{ background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:10, padding:'10px 14px', marginBottom:10, display:'flex', alignItems:'center', gap:9, fontSize:12.5, color:'#b91c1c' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {stats.breached} complaint{stats.breached > 1 ? 's have' : ' has'} breached the urgency timer — {complaints.filter(c => getSLAStatus(c)?.breached).map(c => `Room ${c.roomNumber}`).join(', ')}
        </div>
      )}

      {/* Cluster Banners */}
      {clusters.map(cluster => (
        <div key={cluster.key} style={{ background:'rgba(108,99,255,0.06)', border:'1px solid rgba(108,99,255,0.2)', borderRadius:10, padding:'11px 14px', marginBottom:10 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--primary)', marginBottom:3, display:'flex', alignItems:'center', gap:7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            Cluster detected — {cluster.building}, Floor {cluster.floor}
          </div>
          <div style={{ fontSize:12.5, color:'var(--text-2)' }}>
            {cluster.count} {cluster.category} complaints from rooms {cluster.affectedRooms.join(', ')} in the last 7 days — possible systemic issue.
          </div>
        </div>
      ))}

      {/* Filters & Sorting */}
      <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:16, alignItems:'center' }}>
        {[['all','All'],['todo','To Do'],['in_progress','In Progress'],['resolved','Resolved']].map(([v,l]) => (
          <button key={v} onClick={() => setFilterStatus(v)} style={{
            fontSize:12, padding:'5px 14px', borderRadius:20, cursor:'pointer', transition:'all 0.15s', fontFamily:'var(--font)', border:'1px solid',
            background: filterStatus===v ? 'var(--primary)' : 'transparent',
            color: filterStatus===v ? '#fff' : 'var(--text-2)',
            borderColor: filterStatus===v ? 'var(--primary)' : 'var(--border-strong)',
          }}>{l}</button>
        ))}
        {['Plumbing','Electrical','Cleaning','Furniture','Other'].map(cat => (
          <button key={cat} onClick={() => setFilterCategory(filterCategory===cat?'all':cat)} style={{
            fontSize:12, padding:'5px 14px', borderRadius:20, cursor:'pointer', transition:'all 0.15s', fontFamily:'var(--font)', border:'1px solid',
            background: filterCategory===cat ? 'var(--primary)' : 'transparent',
            color: filterCategory===cat ? '#fff' : 'var(--text-2)',
            borderColor: filterCategory===cat ? 'var(--primary)' : 'var(--border-strong)',
          }}>{cat}</button>
        ))}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ marginLeft:'auto', fontSize:12, padding:'6px 10px', borderRadius:8, border:'1px solid var(--border-strong)', background:'var(--bg-card)', color:'var(--text-2)', fontFamily:'var(--font)', cursor:'pointer' }}>
          <option value="urgent">Sort: Most urgent</option>
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
        </select>
      </div>

      {/* Feed */}
      <div style={{ fontSize:13, color:'var(--text-2)', fontFamily:'var(--font-mono)', marginBottom:14 }}>
        {filteredComplaints.length} complaint{filteredComplaints.length !== 1 ? 's' : ''}
      </div>

      {Object.entries(groupedComplaints).map(([dateLabel, items]) => (
        <div key={dateLabel}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, marginTop: dateLabel === 'Today' ? 0 : 8 }}>
            <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', color:'var(--text-3)', whiteSpace:'nowrap' }}>
              {dateLabel === '__resolved__' ? 'Resolved' : dateLabel}
            </span>
            <div style={{ flex:1, height:0.5, background:'var(--border)' }} />
          </div>
          {items.map(complaint => (
            <ComplaintCardShell key={complaint.id} complaint={complaint} />
          ))}
        </div>
      ))}

      {filteredComplaints.length === 0 && (
        <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-3)', fontSize:13 }}>
          No complaints match your filter.
        </div>
      )}
    </div>
  );
}
