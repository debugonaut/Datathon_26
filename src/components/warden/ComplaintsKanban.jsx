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

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="card p-2 mb-2" style={{ cursor: 'grab', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      <div className="flex align-items-center justify-content-between mb-2">
        <div style={{ fontWeight: 'bold' }}>Room {complaint.roomNumber}</div>
        <div className="text-xs text-muted">{timeAgo(complaint.createdAt)}</div>
      </div>
      
      <div className="mb-2" style={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.2 }}>{complaint.title}</div>
      
      <div className="flex gap-1 flex-wrap mb-2">
        <span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>{complaint.category}</span>
        <span className="badge" style={{ 
          background: complaint.priority === 'low' ? 'rgba(16,185,129,0.2)' : complaint.priority === 'medium' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
          color: complaint.priority === 'low' ? '#10b981' : complaint.priority === 'medium' ? '#f59e0b' : '#ef4444'
        }}>
          {complaint.priority.toUpperCase()}
        </span>
      </div>

      <div className="flex align-items-center justify-content-between text-xs text-muted">
        <div>👤 {complaint.studentName}</div>
        {complaint.mediaUrls?.length > 0 && <div>📎 {complaint.mediaUrls.length} File(s)</div>}
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
    // Over can be a column ID or another sortable item ID
    let newStatus = over.id;
    if (!COLUMNS.find(c => c.id === newStatus)) {
      // It was dropped over another item, find that item's status
      const overItem = complaints.find(c => c.id === over.id);
      if (overItem) newStatus = overItem.status;
    }

    if (newStatus && COLUMNS.find(c => c.id === newStatus) && activeComplaint.status !== newStatus) {
      await updateComplaintStatus(activeComplaint, newStatus);
    }
  };

  const activeComplaint = complaints.find(c => c.id === activeId);

  return (
    <DndContext 
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={{ display: 'flex', gap: '1rem', height: '100%', overflowX: 'auto', paddingBottom: '1rem' }}>
        {columnsData.map(col => (
          <div key={col.id} className="card flex-1" style={{ minWidth: 300, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)' }}>
            <h3 className="font-bold mb-3">{col.title} ({col.items.length})</h3>
            <SortableContext items={col.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div 
                // We map an ID to the column itself so it can act as a dropzone if it is empty
                id={col.id} 
                style={{ flex: 1, overflowY: 'auto' }}
              >
                {col.items.map(c => (
                  <SortableComplaintCard key={c.id} complaint={c} />
                ))}
                {/* Invisible dropzone filler for empty columns */}
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
  );
}
