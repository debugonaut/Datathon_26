import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAnnouncements, createAnnouncement } from '../../firebase/firestore';

export default function WardenAnnouncements({ hostelId }) {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAnnouncements();
  }, [hostelId]);

  const loadAnnouncements = async () => {
    try {
      const data = await getAnnouncements(hostelId);
      setAnnouncements(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    try {
      await createAnnouncement(hostelId, user.uid, message);
      setMessage('');
      await loadAnnouncements(); // Refresh feed
    } catch (err) {
      console.error('Failed to broadcast', err);
    }
    setSubmitting(false);
  };

  if (loading) return <div className="text-center p-4">Loading announcements...</div>;

  return (
    <div className="animation-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
      
      {/* Broadcast Form */}
      <div className="card">
        <h2 className="font-bold mb-2">Broadcast Announcement</h2>
        <p className="text-muted text-sm mb-3">Send a message to all students in this hostel. It will appear on their dashboards instantly.</p>
        
        <form onSubmit={handleBroadcast}>
          <div className="form-group">
            <textarea 
              className="form-input" 
              rows="5"
              placeholder="Write your announcement here..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              style={{ resize: 'vertical' }}
              disabled={submitting}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={!message.trim() || submitting}>
            {submitting ? 'Broadcasting...' : '📢 Broadcast to Students'}
          </button>
        </form>
      </div>

      {/* History */}
      <div className="card">
        <h3 className="font-bold mb-3">Past Announcements</h3>
        
        {announcements.length === 0 ? (
          <p className="text-muted text-sm border p-3 rounded text-center">No announcements have been sent yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {announcements.map(a => (
              <div key={a.id} className="p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{a.message}</p>
                <div className="flex align-items-center mt-2" style={{ justifyContent: 'space-between' }}>
                  <span className="text-muted text-sm">{a.createdAt?.toDate().toLocaleString() || 'Just now'}</span>
                  <span className="badge badge-primary">{a.readBy.length} Reads</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
