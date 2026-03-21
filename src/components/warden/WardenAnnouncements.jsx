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

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '2rem 0' }}>
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80 }} />)}
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
      
      {/* Left — Feed */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span className="section-label" style={{ margin: 0 }}>Posted Announcements</span>
          <span style={{ background: 'var(--bg-raised)', borderRadius: 4, padding: '2px 8px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{announcements.length}</span>
        </div>
        
        {announcements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 4 }}>No announcements yet</div>
            <div style={{ color: 'var(--text-ghost)', fontSize: 12 }}>Post your first announcement</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '60vh', overflowY: 'auto' }}>
            {announcements.map(a => (
              <div key={a.id} className="data-card" style={{ borderTop: '2px solid var(--violet)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 7px', borderRadius: 'var(--radius-chip)', background: 'rgba(124,110,250,0.08)', color: 'var(--violet)', fontFamily: 'var(--font-body)' }}>General</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-ghost)' }}>{a.createdAt?.toDate().toLocaleString() || 'Just now'}</span>
                </div>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                }}>{a.message}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-ghost)', background: 'var(--bg-raised)', padding: '2px 8px', borderRadius: 4 }}>All students</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-ghost)' }}>{a.readBy?.length || 0} reads</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right — Compose */}
      <div className="data-card" style={{ borderTop: '2px solid var(--violet)', position: 'sticky', top: 20 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>New Announcement</div>
        
        <form onSubmit={handleBroadcast}>
          <textarea 
            rows="5"
            placeholder="Write your announcement here..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            disabled={submitting}
            style={{
              width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '11px 14px', fontSize: 13,
              fontFamily: 'var(--font-body)', color: 'var(--text-primary)', outline: 'none',
              resize: 'vertical', minHeight: 100, transition: 'border-color 0.2s ease'
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(124,110,250,0.4)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <button type="submit" disabled={!message.trim() || submitting}
            style={{
              width: '100%', marginTop: 12, background: 'var(--violet)', color: '#fff',
              border: 'none', borderRadius: 9, padding: 12, fontSize: 13,
              fontFamily: 'var(--font-heading)', fontWeight: 500, cursor: 'pointer',
              transition: 'opacity 0.2s ease',
              opacity: (!message.trim() || submitting) ? 0.5 : 1
            }}
          >
            {submitting ? 'Broadcasting...' : 'Post Now'}
          </button>
        </form>
      </div>

    </div>
  );
}
