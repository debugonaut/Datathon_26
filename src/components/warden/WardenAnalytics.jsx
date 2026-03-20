import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, FunnelChart, Funnel, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { fetchAllComplaints, getVolumeByDay, getCategoryBreakdown,
  getStatusBreakdown, getAvgResolutionTime, getResolutionByCategory,
  getFloorHeatmap, getPeakHours, getPriorityBreakdown,
  getRecurringIssues, getEngagementRate, getFunnelData
} from '../../firebase/analytics';
import { countAllRooms } from '../../firebase/firestore';

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

export default function WardenAnalytics({ hostelId }) {
  const [complaints, setComplaints] = useState([]);
  const [totalRooms, setTotalRooms] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [timeRange, setTimeRange] = useState('30d');

  useEffect(() => {
    const load = async () => {
      try {
        const [c, roomCount] = await Promise.all([
          fetchAllComplaints(hostelId),
          countAllRooms(hostelId)
        ]);
        setComplaints(c);
        setTotalRooms(roomCount);
      } catch (err) {
        console.error('WardenAnalytics load error:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [hostelId]);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
      Loading analytics...
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
      <p>Could not load analytics. Please refresh and try again.</p>
    </div>
  );

  const isPlaceholder = complaints.length === 0;

  const displayComplaints = useMemo(() => {
    if (!isPlaceholder) return complaints;
    const categories = ['electrical', 'plumbing', 'cleaning', 'carpentary', 'internet', 'other'];
    const priorities = ['low', 'medium', 'high'];
    const statuses = ['todo', 'in_progress', 'resolved'];
    const dummies = [];
    const now = Date.now();
    for (let i = 0; i < 45; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const createdTime = new Date(now - daysAgo * 86400000 - Math.random() * 86400000);
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const resolvedTime = status === 'resolved' 
        ? new Date(createdTime.getTime() + (Math.random() * 48 + 2) * 3600000) 
        : null;
      dummies.push({
        id: `dummy_${i}`,
        category: categories[Math.floor(Math.random() * categories.length)],
        priority: priorities[Math.floor(Math.random() * priorities.length)],
        status: status,
        floorNumber: String(Math.floor(Math.random() * 4) + 1),
        roomId: `room_${Math.floor(Math.random() * 20)}`,
        createdAt: { toDate: () => createdTime },
        resolvedAt: resolvedTime ? { toDate: () => resolvedTime } : null,
      });
    }
    return dummies.sort((a,b) => a.createdAt.toDate() - b.createdAt.toDate());
  }, [isPlaceholder, complaints]);

  const activeTotalRooms = totalRooms || 20; // fallback for sample data mode

  const volumeData = useMemo(() => getVolumeByDay(displayComplaints), [displayComplaints]);
  const categoryData = useMemo(() => getCategoryBreakdown(displayComplaints), [displayComplaints]);
  const statusData = useMemo(() => getStatusBreakdown(displayComplaints), [displayComplaints]);
  const avgResolution = useMemo(() => getAvgResolutionTime(displayComplaints), [displayComplaints]);
  const resolutionByCategory = useMemo(() => getResolutionByCategory(displayComplaints), [displayComplaints]);
  const floorHeatmap = useMemo(() => getFloorHeatmap(displayComplaints), [displayComplaints]);
  const peakHours = useMemo(() => getPeakHours(displayComplaints), [displayComplaints]);
  const priorityData = useMemo(() => getPriorityBreakdown(displayComplaints), [displayComplaints]);
  const recurringIssues = useMemo(() => getRecurringIssues(displayComplaints), [displayComplaints]);
  const engagementRate = useMemo(() => getEngagementRate(displayComplaints, activeTotalRooms), [displayComplaints, activeTotalRooms]);
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

      {isPlaceholder && (
        <div style={{
          background: 'rgba(55, 138, 221, 0.1)', border: '1px solid rgba(55, 138, 221, 0.3)',
          borderRadius: '10px', padding: '12px 16px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: 'var(--text-primary)'
        }}>
          <span>ℹ️</span>
          <span><strong>Sample Data:</strong> No real complaints have been filed yet. Here is how your analytics will look.</span>
        </div>
      )}

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
          { label: 'Total Complaints', value: complaints.length, color: '#378ADD' },
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
