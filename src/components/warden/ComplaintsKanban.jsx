import { useState, useMemo } from 'react';
import { 
  DndContext, 
  closestCorners, 
  DragOverlay, 
  defaultDropAnimationSideEffects 
} from '@dnd-kit/core';
import { 
  SortableContext, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { updateComplaintStatus } from '../../firebase/firestore';
import { getSLAStatus } from '../../utils/sla';
import { clusterComplaints } from '../../utils/clusterComplaints';
import { doc, updateDoc, Timestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

const COLUMNS = [
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'resolved', title: 'Resolved' }
];

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

const SortableComplaintCard = ({ complaint }) => {
  const { userDoc } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: complaint.id, data: { ...complaint } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const sla = getSLAStatus(complaint);
  const [showNotes, setShowNotes] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [showingOriginal, setShowingOriginal] = useState(false);

  const handleAcknowledge = async (e) => {
    e.stopPropagation();
    setIsProcessing(true);
    try {
      await updateComplaintStatus(complaint, 'in_progress');
    } catch (err) {
      console.error('Acknowledgment failed:', err);
      alert('Failed to acknowledge complaint: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={{
        ...style,
        cursor: 'grab', 
        background: 'var(--bg-surface)', 
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '12px 14px',
        marginBottom: '8px',
        opacity: complaint.status === 'resolved' ? 0.55 : (isDragging ? 0.4 : 1),
        transition: 'border-color 0.2s ease'
      }} 
      {...attributes} 
      {...listeners}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      
      {/* Withdrawn Badge */}
      {complaint.withdrawnAt && (
        <div style={{ marginBottom: 8 }}>
          <span style={{
            fontSize: 12, padding: '2px 7px', borderRadius: 'var(--radius-chip)',
            background: 'rgba(255,255,255,0.04)', color: 'var(--text-ghost)',
            border: '1px solid var(--border)', fontFamily: 'var(--font-body)'
          }}>
            Withdrawn: "{complaint.withdrawnReason}"
          </span>
        </div>
      )}

      {/* Reopened Banner */}
      {complaint.reopenedAt && complaint.status !== 'resolved' && (
        <div style={{ marginBottom: 8, padding: '4px 10px',
          background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)',
          borderRadius: 'var(--radius-chip)', fontSize: 12, color: 'var(--amber)' }}>
          Re-opened: "{complaint.reopenReason}"
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontFamily: 'var(--font-heading)', fontSize: 13 }}>Room {complaint.roomNumber}</div>
        <div style={{ fontSize: 12, color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>{timeAgo(complaint.createdAt)}</div>
      </div>
      
      <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3, marginBottom: 8, color: 'var(--text-primary)', position: 'relative', paddingRight: 12 }}>
        {complaint.title}
        <span style={{ position: 'absolute', top: 2, right: 0, width: 6, height: 6, borderRadius: '50%', background: complaint.priority === 'high' ? 'var(--red)' : complaint.priority === 'medium' ? 'var(--amber)' : 'var(--green)' }} />
      </div>
      
      {/* Translation toggle */}
      {complaint.descriptionOriginal && complaint.descriptionTranslated && complaint.descriptionOriginal !== complaint.descriptionTranslated && (
        <div style={{ fontSize: 12, color: 'var(--text-ghost)', marginBottom: 4 }}>
          <span
            style={{ cursor: 'pointer', color: 'var(--violet)' }}
            onPointerDown={(e) => { e.stopPropagation(); setShowingOriginal(p => !p); }}
          >
            {showingOriginal ? 'Show English' : `Show ${complaint.detectedLanguage || 'Original'}`}
          </span>
        </div>
      )}
      <div style={{ fontSize: 13, marginBottom: 8, color: 'var(--text-secondary)', lineHeight: 1.4, wordBreak: 'break-word' }}>
        {showingOriginal ? complaint.descriptionOriginal : (complaint.descriptionTranslated || complaint.description)}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 12, padding: '2px 7px', borderRadius: 'var(--radius-chip)', background: 'rgba(124,110,250,0.08)', color: 'var(--violet)', border: '1px solid rgba(124,110,250,0.2)', fontFamily: 'var(--font-body)' }}>{complaint.category}</span>
        <span className={`priority-chip priority-${complaint.priority || 'low'}`}>
          {complaint.priority?.toUpperCase() || 'UNKNOWN'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text-ghost)', marginBottom: 8 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        {complaint.studentName}
      </div>

      {complaint.mediaUrls?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }} onPointerDown={(e) => e.stopPropagation()}>
          {complaint.mediaUrls.map((url, idx) => {
            const type = complaint.mediaTypes?.[idx] || 'document';
            return (
              <a 
                key={idx} href={url} target="_blank" rel="noreferrer" 
                style={{ 
                  display: 'inline-flex', alignItems: 'center', padding: '3px 8px', 
                  background: 'rgba(124,110,250,0.08)', borderRadius: 'var(--radius-chip)',
                  fontSize: 12, color: 'var(--violet)', textDecoration: 'none',
                  border: '1px solid rgba(124,110,250,0.2)', fontWeight: 500,
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {type === 'image' ? 'IMG' : type === 'video' ? 'VID' : type === 'audio' ? 'AUD' : 'FILE'}
              </a>
            );
          })}
        </div>
      )}

      {/* Urgency Timer */}
      {sla && (
        <div style={{ marginTop: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative', width: 36, height: 36 }}>
            {/* Background Circle */}
            <svg fill="transparent" width="36" height="36" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
              {/* Progress Circle */}
              <circle
                cx="18" cy="18" r="14"
                stroke={sla.breached ? '#ef4444' : sla.critical ? '#f59e0b' : '#378ADD'} 
                strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 14}`}
                strokeDashoffset={`${(2 * Math.PI * 14) * (1 - Math.min(100, Math.max(0, sla.percent)) / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.5s ease', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
              />
            </svg>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 'bold', color: sla.breached ? '#ef4444' : sla.critical ? '#f59e0b' : 'var(--text-primary)'}}>
              {sla.breached ? '!!' : `${Math.round(sla.percent)}%`}
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Urgency Timer</span>
            <span style={{ 
              fontSize: '0.8rem', fontWeight: 600, 
              color: sla.breached ? '#ef4444' : sla.critical ? '#f59e0b' : 'var(--text-primary)' 
            }}>
              {sla.label}
            </span>
          </div>
        </div>
      )}

      {/* Warden Actions */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
        
        {/* Acknowledge Button */}
        {!complaint.acknowledgedAt && complaint.status === 'todo' && !complaint.withdrawnAt && (
          <button
            onPointerDown={handleAcknowledge}
            disabled={isProcessing}
            style={{
              marginBottom: '8px', width: '100%', padding: '5px',
              background: isProcessing ? 'rgba(255,255,255,0.05)' : 'rgba(55,138,221,0.12)', 
              border: isProcessing ? '1px solid var(--border)' : '1px solid rgba(55,138,221,0.3)',
              borderRadius: '6px', color: isProcessing ? 'var(--text-muted)' : '#378ADD', 
              fontSize: '0.78rem', cursor: isProcessing ? 'not-allowed' : 'pointer', fontWeight: 600
            }}
          >
            {isProcessing ? '⏳ Cleaning up media...' : '✓ Acknowledge'}
          </button>
        )}
        {complaint.acknowledgedAt && complaint.status === 'todo' && (
          <div style={{ fontSize: '0.72rem', color: '#10b981', marginBottom: '8px' }}>
            ✓ Acknowledged
          </div>
        )}

        {/* Resolve Button */}
        {complaint.status === 'in_progress' && !complaint.withdrawnAt && (
          <button
            onPointerDown={async (e) => {
              e.stopPropagation();
              await updateComplaintStatus(complaint, 'resolved');
            }}
            style={{
              marginBottom: '8px', width: '100%', padding: '5px',
              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: '6px', color: '#10b981', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600
            }}
          >
            ✓ Mark as Resolved
          </button>
        )}

        {/* Estimated Resolution */}
        {complaint.status === 'in_progress' && !complaint.withdrawnAt && (
          <div style={{ marginBottom: '8px' }} onPointerDown={(e) => e.stopPropagation()}>
            <input
              type="datetime-local"
              defaultValue={complaint.estimatedResolutionAt
                ? new Date((typeof complaint.estimatedResolutionAt.toDate === 'function' ? complaint.estimatedResolutionAt.toDate() : new Date(complaint.estimatedResolutionAt)) - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : ''}
              onChange={async (e) => {
                if (!e.target.value) return;
                await updateDoc(doc(db, 'complaints', complaint.id), {
                  estimatedResolutionAt: Timestamp.fromDate(new Date(e.target.value))
                });
              }}
              style={{
                width: '100%', padding: '4px 8px', borderRadius: '6px',
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: '0.75rem'
              }}
            />
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Set expected fix date (optional)
            </div>
          </div>
        )}

        {/* Internal Notes */}
        <button
          onPointerDown={(e) => { e.stopPropagation(); setShowNotes(p => !p); }}
          style={{ padding: '3px 10px', background: 'transparent',
            border: '1px solid var(--border)', borderRadius: '6px',
            color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer' }}
        >
          🔒 Notes {complaint.internalNotes?.length > 0 ? `(${complaint.internalNotes.length})` : ''}
        </button>

        {showNotes && (
          <div style={{ marginTop: '8px', padding: '10px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '8px', border: '1px solid var(--border)' }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {(complaint.internalNotes || []).map((note, i) => (
              <div key={i} style={{
                fontSize: '0.78rem', padding: '6px 0',
                borderBottom: i < (complaint.internalNotes || []).length - 1
                  ? '1px solid var(--border)' : 'none'
              }}>
                <div style={{ color: 'var(--text-primary)' }}>{note.text}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginTop: '2px' }}>
                  {note.wardenName} • {note.createdAt?.toDate?.().toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </div>
            ))}
            <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="Add internal note..."
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && newNote.trim()) {
                    await updateDoc(doc(db, 'complaints', complaint.id), {
                      internalNotes: arrayUnion({
                        text: newNote.trim(),
                        createdAt: Timestamp.now(),
                        wardenName: userDoc?.name || 'Warden'
                      })
                    });
                    setNewNote('');
                  }
                }}
                style={{ flex: 1, padding: '5px 10px', borderRadius: '6px',
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: '0.78rem' }}
              />
              <button
                onClick={async () => {
                  if (!newNote.trim()) return;
                  await updateDoc(doc(db, 'complaints', complaint.id), {
                    internalNotes: arrayUnion({
                      text: newNote.trim(), createdAt: Timestamp.now(),
                      wardenName: userDoc?.name || 'Warden'
                    })
                  });
                  setNewNote('');
                }}
                style={{ padding: '5px 10px', borderRadius: '6px',
                  background: 'rgba(55,138,221,0.15)', border: '1px solid rgba(55,138,221,0.3)',
                  color: '#378ADD', cursor: 'pointer', fontSize: '0.78rem' }}
              >Add</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default function ComplaintsKanban({ complaints }) {
  const [activeId, setActiveId] = useState(null);

  const columnsData = useMemo(() => {
    return COLUMNS.map(col => ({
      ...col,
      items: complaints
        .filter(c => c.status === col.id)
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
          const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
          return bTime - aTime;
        })
    }));
  }, [complaints]);

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeComplaint = active.data.current;
    
    // Find which column it was dropped into.
    let newStatus = over.id;
    if (!COLUMNS.find(c => c.id === newStatus)) {
      const overItem = complaints.find(c => c.id === over.id);
      if (overItem) newStatus = overItem.status;
    }

    if (newStatus && COLUMNS.find(c => c.id === newStatus) && activeComplaint.status !== newStatus) {
      if (newStatus === 'resolved' && !activeComplaint.resolvedAt) {
        await updateDoc(doc(db, 'complaints', activeComplaint.id), {
          status: newStatus,
          resolvedAt: Timestamp.now()
        });
      } else {
        await updateComplaintStatus(activeComplaint, newStatus);
      }
    }
  };

  const activeComplaint = complaints.find(c => c.id === activeId);

  // Clusters & SLA Breaches
  const breachedComplaints = complaints.filter(c => getSLAStatus(c)?.breached);
  const clusters = clusterComplaints(complaints);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* Breached Urgency Timer Banner */}
      {breachedComplaints.length > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '10px', padding: '12px 16px',
          marginBottom: '12px', fontSize: '0.85rem'
        }}>
          <span style={{ color: '#ef4444', fontWeight: 600 }}>
            ⚠ {breachedComplaints.length} complaint{breachedComplaints.length > 1 ? 's have' : ' has'} breached the Urgency Timer
          </span>
          <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
            — {breachedComplaints.map(c => `Room ${c.roomNumber}`).join(', ')}
          </span>
        </div>
      )}

      {/* Cluster Banners */}
      {clusters.map(cluster => (
        <div key={cluster.key} style={{
          background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)',
          borderRadius: '10px', padding: '12px 16px',
          marginBottom: '12px', fontSize: '0.85rem'
        }}>
          <div style={{ fontWeight: 600, color: '#8b5cf6', marginBottom: '4px' }}>
            🔗 Cluster Detected — {cluster.building}, Floor {cluster.floor}
          </div>
          <div style={{ color: 'var(--text-primary)' }}>
            {cluster.count} {cluster.category} complaints from rooms{' '}
            {cluster.affectedRooms.join(', ')} in the last 7 days — possible systemic issue.
          </div>
        </div>
      ))}

      <DndContext 
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: 'flex', gap: '1rem', flex: 1, overflowX: 'auto', paddingBottom: '1rem', minHeight: 0 }}>
          {columnsData.map(col => (
            <div key={col.id} style={{
              flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column',
              background: 'var(--bg-raised)', borderRadius: 'var(--radius)', padding: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-ghost)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>{col.title}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-surface)', borderRadius: 4, padding: '1px 6px' }}>{col.items.length}</span>
              </div>
              <SortableContext items={col.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div 
                  id={col.id} 
                  style={{ flex: 1, overflowY: 'auto', minHeight: '100px' }}
                >
                  {col.items.map(c => (
                    <SortableComplaintCard key={c.id} complaint={c} />
                  ))}
                  {col.items.length === 0 && (
                    <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-ghost)', fontSize: 13 }}>
                      Drop here
                    </div>
                  )}
                </div>
              </SortableContext>
            </div>
          ))}
        </div>

        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
          {activeId ? <SortableComplaintCard complaint={activeComplaint} /> : null}
        </DragOverlay>

      </DndContext>
    </div>
  );
}
