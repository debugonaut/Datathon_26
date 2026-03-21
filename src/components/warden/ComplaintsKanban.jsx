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
  const seconds = Math.floor((new Date() - date.toDate()) / 1000);
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

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="card p-2 mb-2" style={{ cursor: 'grab', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      
      {/* Withdrawn Badge */}
      {complaint.withdrawnAt && (
        <div style={{ marginBottom: '8px' }}>
          <span style={{
            fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',
            border: '1px solid var(--border)'
          }}>
            Withdrawn by student: "{complaint.withdrawnReason}"
          </span>
        </div>
      )}

      {/* Reopened Banner */}
      {complaint.reopenedAt && complaint.status !== 'resolved' && (
        <div style={{ marginBottom: '8px', padding: '4px 10px',
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: '6px', fontSize: '0.72rem', color: '#f59e0b' }}>
          ↩ Re-opened: "{complaint.reopenReason}"
        </div>
      )}

      <div className="flex align-items-center justify-content-between mb-2">
        <div style={{ fontWeight: 'bold' }}>Room {complaint.roomNumber}</div>
        <div className="text-xs text-muted">{timeAgo(complaint.createdAt)}</div>
      </div>
      
      <div className="mb-2" style={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.2 }}>{complaint.title}</div>
      
      {/* Translation toggle (if available) */}
      {complaint.descriptionOriginal && complaint.descriptionTranslated && complaint.descriptionOriginal !== complaint.descriptionTranslated && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
          <span
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
            onPointerDown={(e) => { e.stopPropagation(); setShowingOriginal(p => !p); }}
          >
            {showingOriginal ? 'Show English' : `Originally in ${complaint.detectedLanguage || 'Original Language'}`}
          </span>
        </div>
      )}
      <div className="text-sm mb-2 text-muted" style={{ lineHeight: 1.4, wordBreak: 'break-word' }}>
        {showingOriginal ? complaint.descriptionOriginal : (complaint.descriptionTranslated || complaint.description)}
      </div>

      <div className="flex gap-1 flex-wrap mb-2">
        <span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>{complaint.category}</span>
        <span className="badge" style={{ 
          background: complaint.priority === 'low' ? 'rgba(16,185,129,0.2)' : complaint.priority === 'medium' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
          color: complaint.priority === 'low' ? '#10b981' : complaint.priority === 'medium' ? '#f59e0b' : '#ef4444'
        }}>
          {complaint.priority.toUpperCase()}
        </span>
      </div>

      <div className="flex align-items-center justify-content-between text-xs text-muted mb-2">
        <div>👤 {complaint.studentName}</div>
        {complaint.mediaUrls?.length > 0 && <div>📎 {complaint.mediaUrls.length} File(s)</div>}
      </div>

      {/* SLA Timer */}
      {sla && (
        <div style={{ marginTop: '8px', marginBottom: '8px' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '0.7rem', marginBottom: '3px',
            color: sla.breached ? '#ef4444' : sla.critical ? '#f59e0b' : 'var(--text-muted)'
          }}>
            <span>{sla.breached ? '⚠ SLA Breached' : 'SLA'}</span>
            <span>{sla.label}</span>
          </div>
          <div style={{ height: '4px', borderRadius: '2px',
            background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${sla.percent}%`, borderRadius: '2px',
              background: sla.breached ? '#ef4444' : sla.critical ? '#f59e0b' : '#10b981',
              transition: 'width 1s linear'
            }} />
          </div>
        </div>
      )}

      {/* Warden Actions */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
        
        {/* Acknowledge Button */}
        {!complaint.acknowledgedAt && complaint.status === 'todo' && !complaint.withdrawnAt && (
          <button
            onPointerDown={async (e) => {
              e.stopPropagation();
              await updateDoc(doc(db, 'complaints', complaint.id), {
                acknowledgedAt: Timestamp.now(),
                status: 'in_progress'
              });
            }}
            style={{
              marginBottom: '8px', width: '100%', padding: '5px',
              background: 'rgba(55,138,221,0.12)', border: '1px solid rgba(55,138,221,0.3)',
              borderRadius: '6px', color: '#378ADD', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600
            }}
          >
            ✓ Acknowledge
          </button>
        )}
        {complaint.acknowledgedAt && complaint.status === 'todo' && (
          <div style={{ fontSize: '0.72rem', color: '#10b981', marginBottom: '8px' }}>
            ✓ Acknowledged
          </div>
        )}

        {/* Estimated Resolution */}
        {complaint.status === 'in_progress' && !complaint.withdrawnAt && (
          <div style={{ marginBottom: '8px' }} onPointerDown={(e) => e.stopPropagation()}>
            <input
              type="datetime-local"
              defaultValue={complaint.estimatedResolutionAt
                ? new Date(complaint.estimatedResolutionAt.toDate() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : ''}
              onChange={async (e) => {
                if (!e.target.value) return;
                await updateDoc(doc(db, 'complaints', complaint.id), {
                  estimatedResolutionAt: Timestamp.fromDate(new Date(e.target.value))
                });
              }}
              style={{
                width: '100%', padding: '4px 8px', borderRadius: '6px',
                background: 'var(--surface)', border: '1px solid var(--border)',
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
                  background: 'var(--surface)', border: '1px solid var(--border)',
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
      items: complaints.filter(c => c.status === col.id).sort((a, b) => b.createdAt - a.createdAt) // Newest first
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
      
      {/* Breached SLA Banner */}
      {breachedComplaints.length > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '10px', padding: '12px 16px',
          marginBottom: '12px', fontSize: '0.85rem'
        }}>
          <span style={{ color: '#ef4444', fontWeight: 600 }}>
            ⚠ {breachedComplaints.length} complaint{breachedComplaints.length > 1 ? 's have' : ' has'} breached SLA
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
            <div key={col.id} className="card flex-1" style={{ minWidth: 320, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)' }}>
              <h3 className="font-bold mb-3">{col.title} ({col.items.length})</h3>
              <SortableContext items={col.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div 
                  id={col.id} 
                  style={{ flex: 1, overflowY: 'auto', minHeight: '100px' }}
                >
                  {col.items.map(c => (
                    <SortableComplaintCard key={c.id} complaint={c} />
                  ))}
                  {col.items.length === 0 && (
                    <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
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
