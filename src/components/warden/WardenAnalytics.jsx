import { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

const CARD = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '1.25rem',
  marginBottom: '0'
};

const LABEL = {
  fontSize: '0.78rem',
  color: 'var(--text-muted)',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const VALUE = {
  fontSize: '2rem',
  fontWeight: '700',
  color: 'var(--text-primary)',
  lineHeight: 1.1
};

const CHART_COLORS = ['#378ADD', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const TOOLTIP_STYLE = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
  fontSize: '0.8rem'
};

// ── Generate static dummy data ──────────────────────────────────────────────
function generateDummyComplaints() {
  const categories = ['Electrical', 'Plumbing', 'Cleaning', 'Carpentry', 'Internet', 'Other'];
  const priorities = ['low', 'medium', 'high'];
  const statuses = ['todo', 'in_progress', 'resolved'];
  const dummies = [];
  const now = Date.now();
  for (let i = 0; i < 45; i++) {
    const daysAgo = Math.floor((i * 29) / 44); // deterministic spread
    const createdTime = new Date(now - daysAgo * 86400000 - (i * 3600000) % 86400000);
    const status = statuses[i % 3];
    const resolvedTime = status === 'resolved'
      ? new Date(createdTime.getTime() + ((i % 5) + 2) * 3600000)
      : null;
    dummies.push({
      id: `dummy_${i}`,
      category: categories[i % categories.length],
      priority: priorities[i % priorities.length],
      status,
      floorNumber: String((i % 4) + 1),
      roomId: `room_${i % 20}`,
      createdAt: { toDate: () => createdTime },
      resolvedAt: resolvedTime ? { toDate: () => resolvedTime } : null,
    });
  }
  return dummies.sort((a, b) => a.createdAt.toDate() - b.createdAt.toDate());
}

// ── Analytics helper functions (inline, no Firestore) ───────────────────────
function getVolumeByDay(complaints) {
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
}

function getCategoryBreakdown(complaints) {
  const map = {};
  complaints.forEach(c => { map[c.category] = (map[c.category] || 0) + 1; });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

function getStatusBreakdown(complaints) {
  const map = { todo: 0, in_progress: 0, resolved: 0 };
  complaints.forEach(c => { map[c.status] = (map[c.status] || 0) + 1; });
  return [
    { name: 'To Do', value: map.todo, fill: '#ef4444' },
    { name: 'In Progress', value: map.in_progress, fill: '#f59e0b' },
    { name: 'Resolved', value: map.resolved, fill: '#10b981' },
  ];
}

function getAvgResolutionTime(complaints) {
  const resolved = complaints.filter(c => c.resolvedAt && c.createdAt);
  if (!resolved.length) return null;
  const totalHours = resolved.reduce((sum, c) => {
    return sum + (c.resolvedAt.toDate() - c.createdAt.toDate()) / 3600000;
  }, 0);
  return Math.round(totalHours / resolved.length);
}

function getResolutionByCategory(complaints) {
  const map = {};
  complaints.filter(c => c.resolvedAt && c.createdAt).forEach(c => {
    const hrs = (c.resolvedAt.toDate() - c.createdAt.toDate()) / 3600000;
    if (!map[c.category]) map[c.category] = { total: 0, count: 0 };
    map[c.category].total += hrs;
    map[c.category].count++;
  });
  return Object.entries(map).map(([category, d]) => ({
    category, avgHours: Math.round(d.total / d.count)
  }));
}

function getFloorHeatmap(complaints) {
  const weeks = [];
  const now = Date.now();
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now - (i + 1) * 7 * 86400000);
    const end = new Date(now - i * 7 * 86400000);
    weeks.push({ label: `W-${i === 0 ? 'now' : i}`, start, end });
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
}

function getPeakHours(complaints) {
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, count: 0 }));
  complaints.forEach(c => {
    const d = c.createdAt?.toDate?.();
    if (d) hours[d.getHours()].count++;
  });
  return hours;
}

function getPriorityBreakdown(complaints) {
  const map = { low: 0, medium: 0, high: 0 };
  complaints.forEach(c => { map[c.priority] = (map[c.priority] || 0) + 1; });
  return [
    { name: 'Low', value: map.low, fill: '#10b981' },
    { name: 'Medium', value: map.medium, fill: '#f59e0b' },
    { name: 'High', value: map.high, fill: '#ef4444' },
  ];
}

function getRecurringIssues(complaints) {
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
    .map(([, arr]) => ({
      floor: `Floor ${arr[0].floorNumber}`,
      category: arr[0].category,
      count: arr.length
    }));
}

function getEngagementRate(complaints, totalRooms) {
  if (!totalRooms) return 0;
  const activeRooms = new Set(complaints.map(c => c.roomId)).size;
  return Math.round((activeRooms / totalRooms) * 100);
}

function getFunnelData(complaints) {
  const total = complaints.length;
  const inProgress = complaints.filter(c => c.status === 'in_progress' || c.status === 'resolved').length;
  const resolved = complaints.filter(c => c.status === 'resolved').length;
  return [
    { stage: 'Filed', count: total, fill: '#378ADD' },
    { stage: 'In Progress', count: inProgress, fill: '#f59e0b' },
    { stage: 'Resolved', count: resolved, fill: '#10b981' },
  ];
}

// ── Component ───────────────────────────────────────────────────────────────
export default function WardenAnalytics({ hostelId }) {
  const displayComplaints = useMemo(() => generateDummyComplaints(), []);
  const activeTotalRooms = 20;

  const volumeData = useMemo(() => getVolumeByDay(displayComplaints), [displayComplaints]);
  const categoryData = useMemo(() => getCategoryBreakdown(displayComplaints), [displayComplaints]);
  const statusData = useMemo(() => getStatusBreakdown(displayComplaints), [displayComplaints]);
  const avgResolution = useMemo(() => getAvgResolutionTime(displayComplaints), [displayComplaints]);
  const resolutionByCategory = useMemo(() => getResolutionByCategory(displayComplaints), [displayComplaints]);
  const floorHeatmap = useMemo(() => getFloorHeatmap(displayComplaints), [displayComplaints]);
  const peakHours = useMemo(() => getPeakHours(displayComplaints), [displayComplaints]);
  const priorityData = useMemo(() => getPriorityBreakdown(displayComplaints), [displayComplaints]);
  const recurringIssues = useMemo(() => getRecurringIssues(displayComplaints), [displayComplaints]);
  const engagementRate = useMemo(() => getEngagementRate(displayComplaints, activeTotalRooms), [displayComplaints]);
  const funnelData = useMemo(() => getFunnelData(displayComplaints), [displayComplaints]);
  const openComplaints = displayComplaints.filter(c => c.status !== 'resolved').length;
  const resolvedComplaints = displayComplaints.filter(c => c.status === 'resolved').length;
  const resolutionRate = displayComplaints.length
    ? Math.round((resolvedComplaints / displayComplaints.length) * 100) : 0;

  const weekKeys = floorHeatmap.length > 0
    ? Object.keys(floorHeatmap[0]).filter(k => k !== 'floor') : [];

  const getHeatColor = (val) => {
    if (val === 0) return 'rgba(255,255,255,0.04)';
    if (val === 1) return 'rgba(245,158,11,0.3)';
    if (val === 2) return 'rgba(245,158,11,0.6)';
    return 'rgba(239,68,68,0.8)';
  };

  return (
    <div style={{ padding: '0.5rem 0' }}>

      <div style={{
        background: 'rgba(55, 138, 221, 0.1)', border: '1px solid rgba(55, 138, 221, 0.3)',
        borderRadius: '10px', padding: '12px 16px', marginBottom: '16px',
        display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: 'var(--text-primary)'
      }}>
        <span>ℹ️</span>
        <span><strong>Sample Data:</strong> No real complaints have been filed yet. Here is how your analytics will look.</span>
      </div>

      {/* ── Recurring Issue Banners ── */}
      {recurringIssues.map((issue, i) => (
        <div key={i} style={{
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: '10px', padding: '12px 16px', marginBottom: '12px',
          display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem'
        }}>
          <span style={{ fontSize: '1.1rem' }}>⚠️</span>
          <span style={{ color: '#ef4444', fontWeight: '600' }}>Recurring Issue Detected:</span>
          <span style={{ color: 'var(--text-primary)' }}>
            {issue.floor} has had {issue.count} {issue.category} complaints this week — possible systemic problem.
          </span>
        </div>
      ))}

      {/* ── Row 1: KPI Metric Cards ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px', marginBottom: '16px'
      }}>
        {[
          { label: 'Total Complaints', value: displayComplaints.length, color: '#378ADD' },
          { label: 'Open', value: openComplaints, color: '#ef4444' },
          { label: 'Resolved', value: resolvedComplaints, color: '#10b981' },
          { label: 'Resolution Rate', value: `${resolutionRate}%`, color: '#10b981' },
          { label: 'Avg Resolution', value: avgResolution ? `${avgResolution}h` : 'N/A', color: '#f59e0b' },
          { label: 'Room Engagement', value: `${engagementRate}%`, color: '#8b5cf6' },
        ].map(({ label, value, color }) => (
          <div key={label} style={CARD}>
            <div style={LABEL}>{label}</div>
            <div style={{ ...VALUE, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Row 2: Area Chart (Volume Over Time) + Donut (Category) ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '2fr 1fr',
        gap: '12px', marginBottom: '16px'
      }}>
        <div style={CARD}>
          <div style={{ ...LABEL, marginBottom: '16px' }}>Complaint Volume — Last 30 Days</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={volumeData}>
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#378ADD" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#378ADD" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                interval={4} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="count" stroke="#378ADD"
                fill="url(#volGrad)" strokeWidth={2} name="Complaints" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={CARD}>
          <div style={{ ...LABEL, marginBottom: '16px' }}>By Category</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50}
                outerRadius={80} paddingAngle={3} dataKey="value">
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="circle" iconSize={8}
                wrapperStyle={{ fontSize: '0.72rem' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 3: Bar Chart (Resolution by Category) + Pie (Priority) ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '12px', marginBottom: '16px'
      }}>
        <div style={CARD}>
          <div style={{ ...LABEL, marginBottom: '16px' }}>Avg Resolution Time by Category (hours)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={resolutionByCategory} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis type="category" dataKey="category"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={70} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="avgHours" name="Avg Hours" radius={[0, 4, 4, 0]}>
                {resolutionByCategory.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={CARD}>
          <div style={{ ...LABEL, marginBottom: '16px' }}>Priority Distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={priorityData} cx="50%" cy="50%"
                outerRadius={80} paddingAngle={3} dataKey="value">
                {priorityData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="circle" iconSize={8}
                wrapperStyle={{ fontSize: '0.72rem' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 4: Radar Chart (Category vs Status) + Funnel ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '12px', marginBottom: '16px'
      }}>
        <div style={CARD}>
          <div style={{ ...LABEL, marginBottom: '16px' }}>Status Overview (Radar)</div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={(() => {
              const categories = [...new Set(displayComplaints.map(c => c.category))];
              return categories.map(cat => ({
                category: cat,
                open: displayComplaints.filter(c => c.category === cat && c.status === 'todo').length,
                inProgress: displayComplaints.filter(c => c.category === cat && c.status === 'in_progress').length,
                resolved: displayComplaints.filter(c => c.category === cat && c.status === 'resolved').length,
              }));
            })()}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="category"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <PolarRadiusAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
              <Radar name="Open" dataKey="open" stroke="#ef4444"
                fill="#ef4444" fillOpacity={0.2} />
              <Radar name="In Progress" dataKey="inProgress" stroke="#f59e0b"
                fill="#f59e0b" fillOpacity={0.2} />
              <Radar name="Resolved" dataKey="resolved" stroke="#10b981"
                fill="#10b981" fillOpacity={0.2} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: '0.72rem' }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div style={CARD}>
          <div style={{ ...LABEL, marginBottom: '16px' }}>Complaint Resolution Funnel</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis type="category" dataKey="stage"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={80} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" name="Count" radius={[0, 6, 6, 0]}>
                {funnelData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 5: Peak Hours Bar Chart (full width) ── */}
      <div style={{ ...CARD, marginBottom: '16px' }}>
        <div style={{ ...LABEL, marginBottom: '16px' }}>Peak Complaint Hours (24hr)</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={peakHours}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} interval={1} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="count" name="Complaints" radius={[3, 3, 0, 0]}>
              {peakHours.map((entry, i) => (
                <Cell key={i}
                  fill={entry.count === Math.max(...peakHours.map(h => h.count))
                    ? '#ef4444' : '#378ADD'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Row 6: Floor Heatmap (full width, custom rendered) ── */}
      <div style={{ ...CARD, marginBottom: '16px' }}>
        <div style={{ ...LABEL, marginBottom: '16px' }}>Floor Complaint Heatmap — Last 6 Weeks</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 12px', color: 'var(--text-muted)',
                  textAlign: 'left', fontWeight: 500 }}>Floor</th>
                {weekKeys.map(w => (
                  <th key={w} style={{ padding: '6px 12px', color: 'var(--text-muted)',
                    textAlign: 'center', fontWeight: 500 }}>{w}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {floorHeatmap.map((row, i) => (
                <tr key={i}>
                  <td style={{ padding: '6px 12px', color: 'var(--text-primary)',
                    fontWeight: 500 }}>{row.floor}</td>
                  {weekKeys.map(w => (
                    <td key={w} style={{ padding: '4px 8px', textAlign: 'center' }}>
                      <div style={{
                        background: getHeatColor(row[w]),
                        borderRadius: '6px', padding: '6px 10px',
                        color: row[w] > 0 ? 'white' : 'var(--text-muted)',
                        fontWeight: row[w] > 2 ? 700 : 400,
                        minWidth: '32px', display: 'inline-block'
                      }}>
                        {row[w] || '–'}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '12px',
          fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span>Legend:</span>
          {[
            { color: 'rgba(255,255,255,0.04)', label: '0' },
            { color: 'rgba(245,158,11,0.3)', label: '1' },
            { color: 'rgba(245,158,11,0.6)', label: '2' },
            { color: 'rgba(239,68,68,0.8)', label: '3+' },
          ].map(({ color, label }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: '14px', height: '14px',
                background: color, borderRadius: '3px', border: '1px solid var(--border)' }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Row 7: Line Chart (Cumulative Resolved vs Filed) ── */}
      <div style={{ ...CARD, marginBottom: '16px' }}>
        <div style={{ ...LABEL, marginBottom: '16px' }}>Cumulative Filed vs Resolved Over Time</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={(() => {
            let filed = 0, resolved = 0;
            return getVolumeByDay(displayComplaints).map(day => {
              filed += day.count;
              resolved += displayComplaints.filter(c => {
                const d = c.resolvedAt?.toDate?.();
                return d && d.toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short'
                }) === day.date;
              }).length;
              return { date: day.date, filed, resolved };
            });
          })()}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={4} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: '0.78rem' }} />
            <Line type="monotone" dataKey="filed" stroke="#ef4444"
              strokeWidth={2} dot={false} name="Total Filed" />
            <Line type="monotone" dataKey="resolved" stroke="#10b981"
              strokeWidth={2} dot={false} name="Total Resolved" />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
