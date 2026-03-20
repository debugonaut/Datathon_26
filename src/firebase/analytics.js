import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './config';

// Fetch all complaints for a hostel (sort client-side to avoid composite index requirement)
export const fetchAllComplaints = async (hostelId) => {
  const q = query(
    collection(db, 'complaints'),
    where('hostelId', '==', hostelId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
};

// Complaints per day for last 30 days
export const getVolumeByDay = (complaints) => {
  const map = {};
  const now = Date.now();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    map[key] = 0;
  }
  complaints.forEach(c => {
    const d = c.createdAt?.toDate?.();
    if (!d) return;
    const key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    if (key in map) map[key]++;
  });
  return Object.entries(map).map(([date, count]) => ({ date, count }));
};

// Category breakdown
export const getCategoryBreakdown = (complaints) => {
  const map = {};
  complaints.forEach(c => {
    map[c.category] = (map[c.category] || 0) + 1;
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
};

// Status breakdown
export const getStatusBreakdown = (complaints) => {
  const map = { todo: 0, in_progress: 0, resolved: 0 };
  complaints.forEach(c => { map[c.status] = (map[c.status] || 0) + 1; });
  return [
    { name: 'To Do', value: map.todo, fill: '#ef4444' },
    { name: 'In Progress', value: map.in_progress, fill: '#f59e0b' },
    { name: 'Resolved', value: map.resolved, fill: '#10b981' },
  ];
};

// Average resolution time in hours
export const getAvgResolutionTime = (complaints) => {
  const resolved = complaints.filter(c => c.resolvedAt && c.createdAt);
  if (!resolved.length) return null;
  const totalHours = resolved.reduce((sum, c) => {
    const diff = c.resolvedAt.toDate() - c.createdAt.toDate();
    return sum + diff / 3600000;
  }, 0);
  return Math.round(totalHours / resolved.length);
};

// Resolution time by category
export const getResolutionByCategory = (complaints) => {
  const map = {};
  complaints.filter(c => c.resolvedAt && c.createdAt).forEach(c => {
    const hrs = (c.resolvedAt.toDate() - c.createdAt.toDate()) / 3600000;
    if (!map[c.category]) map[c.category] = { total: 0, count: 0 };
    map[c.category].total += hrs;
    map[c.category].count++;
  });
  return Object.entries(map).map(([category, d]) => ({
    category,
    avgHours: Math.round(d.total / d.count)
  }));
};

// Floor heatmap — complaints per floor per week (last 6 weeks)
export const getFloorHeatmap = (complaints) => {
  const weeks = [];
  const now = Date.now();
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now - (i + 1) * 7 * 86400000);
    const end = new Date(now - i * 7 * 86400000);
    weeks.push({
      label: `W-${i === 0 ? 'now' : i}`,
      start, end
    });
  }
  const floorSet = new Set(complaints.map(c => `Floor ${c.floorNumber}`));
  const floors = [...floorSet].sort();
  return floors.map(floor => {
    const row = { floor };
    weeks.forEach(w => {
      row[w.label] = complaints.filter(c => {
        const d = c.createdAt?.toDate?.();
        return d && `Floor ${c.floorNumber}` === floor && d >= w.start && d < w.end;
      }).length;
    });
    return row;
  });
};

// Peak complaint hours (0-23)
export const getPeakHours = (complaints) => {
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, count: 0 }));
  complaints.forEach(c => {
    const d = c.createdAt?.toDate?.();
    if (d) hours[d.getHours()].count++;
  });
  return hours;
};

// Priority breakdown
export const getPriorityBreakdown = (complaints) => {
  const map = { low: 0, medium: 0, high: 0 };
  complaints.forEach(c => { map[c.priority] = (map[c.priority] || 0) + 1; });
  return [
    { name: 'Low', value: map.low, fill: '#10b981' },
    { name: 'Medium', value: map.medium, fill: '#f59e0b' },
    { name: 'High', value: map.high, fill: '#ef4444' },
  ];
};

// Recurring issue detection — same category, same floor, 3+ complaints in 7 days
export const getRecurringIssues = (complaints) => {
  const now = Date.now();
  const recent = complaints.filter(c => {
    const d = c.createdAt?.toDate?.();
    return d && now - d.getTime() < 7 * 86400000;
  });
  const map = {};
  recent.forEach(c => {
    const key = `${c.floorNumber}-${c.category}`;
    map[key] = (map[key] || []);
    map[key].push(c);
  });
  return Object.entries(map)
    .filter(([, arr]) => arr.length >= 3)
    .map(([key, arr]) => ({
      floor: `Floor ${arr[0].floorNumber}`,
      category: arr[0].category,
      count: arr.length
    }));
};

// Student engagement — % of rooms with at least 1 complaint
export const getEngagementRate = (complaints, totalRooms) => {
  if (!totalRooms) return 0;
  const activeRooms = new Set(complaints.map(c => c.roomId)).size;
  return Math.round((activeRooms / totalRooms) * 100);
};

// Complaint funnel
export const getFunnelData = (complaints) => {
  const total = complaints.length;
  const inProgress = complaints.filter(c => c.status === 'in_progress' || c.status === 'resolved').length;
  const resolved = complaints.filter(c => c.status === 'resolved').length;
  return [
    { stage: 'Filed', count: total, fill: '#378ADD' },
    { stage: 'In Progress', count: inProgress, fill: '#f59e0b' },
    { stage: 'Resolved', count: resolved, fill: '#10b981' },
  ];
};
