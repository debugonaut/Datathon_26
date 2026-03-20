import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './config';

// Fetch all complaints filed by this student (sort client-side to avoid composite index)
export const fetchMyComplaints = async (studentUid) => {
  const q = query(
    collection(db, 'complaints'),
    where('studentUid', '==', studentUid)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
};

// Fetch anonymized hostel-wide avg resolution time for comparison
// Only returns a single number — no individual data exposed
export const fetchHostelAvgResolution = async (hostelId) => {
  const q = query(
    collection(db, 'complaints'),
    where('hostelId', '==', hostelId),
    where('status', '==', 'resolved')
  );
  const snap = await getDocs(q);
  const docs = snap.docs.map(d => d.data());
  if (!docs.length) return null;
  const total = docs.reduce((sum, c) => {
    if (!c.resolvedAt || !c.createdAt) return sum;
    return sum + (c.resolvedAt.toDate() - c.createdAt.toDate());
  }, 0);
  return Math.round(total / docs.length / 3600000); // hours
};

// Room score history — last 30 days
// Reconstructed from complaint createdAt and resolvedAt timestamps
export const getRoomScoreHistory = (complaints, currentScore) => {
  const now = Date.now();
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const dayEnd = new Date(now - i * 86400000);
    const dayLabel = dayEnd.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short'
    });
    // Score at end of this day = current score adjusted for complaints
    // opened/closed after this day
    const pointsLostAfter = complaints
      .filter(c => {
        const created = c.createdAt?.toDate?.();
        return created && created > dayEnd && c.status !== 'resolved';
      })
      .reduce((sum, c) => {
        const pts = c.priority === 'high' ? 30 : c.priority === 'medium' ? 15 : 5;
        return sum + pts;
      }, 0);
    days.push({
      date: dayLabel,
      score: Math.min(100, Math.max(0, currentScore + pointsLostAfter))
    });
  }
  return days;
};

// My avg resolution time in hours
export const getMyAvgResolution = (complaints) => {
  const resolved = complaints.filter(c => c.resolvedAt && c.createdAt);
  if (!resolved.length) return null;
  const total = resolved.reduce((sum, c) => {
    return sum + (c.resolvedAt.toDate() - c.createdAt.toDate());
  }, 0);
  return Math.round(total / resolved.length / 3600000);
};

// Complaints by category for this student
export const getMyCategoryBreakdown = (complaints) => {
  const map = {};
  complaints.forEach(c => {
    map[c.category] = (map[c.category] || 0) + 1;
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
};

// Time since complaint was last updated in human readable form
export const timeAgo = (timestamp) => {
  if (!timestamp || typeof timestamp.toDate !== 'function') return 'Unknown';
  const diff = Date.now() - timestamp.toDate().getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
};

// Check if complaint is overdue
export const isOverdue = (complaint) => {
  if (complaint.status === 'resolved') return false;
  const dateObj = complaint.createdAt?.toDate?.();
  if (!dateObj) return false;
  const hrs = (Date.now() - dateObj.getTime()) / 3600000;
  if (complaint.priority === 'high' && hrs > 48) return true;
  if (complaint.priority === 'medium' && hrs > 96) return true;
  if (complaint.priority === 'low' && hrs > 168) return true;
  return false;
};
