import React, { useState, useEffect, useMemo, Fragment } from 'react';
import {
  LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  fetchMyComplaints, fetchHostelAvgResolution,
  getRoomScoreHistory, getMyAvgResolution,
  getMyCategoryBreakdown, timeAgo, isOverdue
} from '../../firebase/studentAnalytics';
import { useAuth } from '../../context/AuthContext';

const CARD = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '1.25rem',
};

const LABEL = {
  fontSize: '0.78rem',
  color: 'var(--text-muted)',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const TOOLTIP_STYLE = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
  fontSize: '0.8rem'
};

const PRIORITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981'
};

const STATUS_COLORS = {
  todo: '#ef4444',
  in_progress: '#f59e0b',
  resolved: '#10b981'
};

const STATUS_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  resolved: 'Resolved'
};

const CHART_COLORS = ['#378ADD', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// Custom radial gauge label
const GaugeLabel = ({ cx, cy, score }) => (
  <>
    <text x={cx} y={cy - 8} textAnchor="middle"
      style={{ fontSize: '2rem', fontWeight: 700,
        fill: score >= 71 ? '#10b981' : score >= 41 ? '#f59e0b' : '#ef4444' }}>
      {score}
    </text>
    <text x={cx} y={cy + 16} textAnchor="middle"
      style={{ fontSize: '0.75rem', fill: 'var(--text-muted)' }}>
      Room Score
    </text>
  </>
);

export default function StudentAnalytics({ roomScore }) {
  const { user, userProfile } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [hostelAvg, setHostelAvg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [c, avg] = await Promise.all([
        fetchMyComplaints(user.uid),
        fetchHostelAvgResolution(userProfile.hostelId)
      ]);
      setComplaints(c);
      setHostelAvg(avg);
      setLoading(false);
    };
    load();
  }, [user.uid, userProfile.hostelId]);

  const myAvgResolution = useMemo(() => getMyAvgResolution(complaints), [complaints]);
  const categoryData = useMemo(() => getMyCategoryBreakdown(complaints), [complaints]);
  const scoreHistory = useMemo(() =>
    getRoomScoreHistory(complaints, roomScore ?? 100), [complaints, roomScore]);

  const openComplaints = complaints.filter(c => c.status !== 'resolved');
  const resolvedComplaints = complaints.filter(c => c.status === 'resolved');
  const overdueComplaints = complaints.filter(isOverdue);

  const score = roomScore ?? 100;
  const gaugeData = [
    { name: 'score', value: score,
      fill: score >= 71 ? '#10b981' : score >= 41 ? '#f59e0b' : '#ef4444' },
    { name: 'remaining', value: 100 - score, fill: 'rgba(255,255,255,0.06)' }
  ];

  const resolutionComparison = myAvgResolution && hostelAvg ? [
    { name: 'My Avg', hours: myAvgResolution, fill: '#378ADD' },
    { name: 'Hostel Avg', hours: hostelAvg, fill: '#8b5cf6' },
  ] : [];

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
      Loading your stats...
    </div>
  );

  return (
    <div style={{ padding: '0.5rem 0' }}>

      {/* ── Overdue Alerts ── */}
      {overdueComplaints.map(c => (
        <div key={c.id} style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '10px', padding: '10px 16px',
          marginBottom: '10px', fontSize: '0.85rem',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <span>⚠️</span>
          <span style={{ color: '#ef4444', fontWeight: 600 }}>Overdue:</span>
          <span style={{ color: 'var(--text-primary)' }}>
            "{c.title}" has been {STATUS_LABELS[c.status]} for too long.
            Filed {timeAgo(c.createdAt)}.
          </span>
        </div>
      ))}

      {/* ── Section 1: Room Health ── */}
      <div style={{ marginBottom: '8px', ...LABEL }}>My Room Health</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: '12px', marginBottom: '16px'
      }}>

        {/* Radial gauge */}
        <div style={{ ...CARD, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center' }}>
          <ResponsiveContainer width="100%" height={180}>
            <RadialBarChart
              cx="50%" cy="55%"
              innerRadius="65%" outerRadius="90%"
              startAngle={180} endAngle={0}
              data={gaugeData}
            >
              <RadialBar dataKey="value" cornerRadius={6} background={false}>
                {gaugeData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </RadialBar>
              <GaugeLabel
                cx="50%" cy="55%"
                score={score}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)',
            textAlign: 'center', marginTop: '-8px' }}>
            {score >= 71 ? 'Your room is in good shape'
              : score >= 41 ? 'Some issues need attention'
              : 'Critical issues need urgent fixing'}
          </div>
        </div>

        {/* Score trend area chart */}
        <div style={CARD}>
          <div style={LABEL}>Room Score — Last 30 Days</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={scoreHistory}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date"
                tick={{ fontSize: 9, fill: 'var(--text-muted)' }} interval={6} />
              <YAxis domain={[0, 100]}
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="score" stroke="#10b981"
                fill="url(#scoreGrad)" strokeWidth={2} name="Score" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Section 2: My Complaint Stats ── */}
      <div style={{ marginBottom: '8px', ...LABEL }}>My Complaints</div>

      {/* KPI row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '12px', marginBottom: '16px'
      }}>
        {[
          { label: 'Total Filed', value: complaints.length, color: '#378ADD' },
          { label: 'Open', value: openComplaints.length, color: '#ef4444' },
          { label: 'Resolved', value: resolvedComplaints.length, color: '#10b981' },
          { label: 'Overdue', value: overdueComplaints.length,
            color: overdueComplaints.length > 0 ? '#ef4444' : '#10b981' },
          { label: 'Avg Resolution',
            value: myAvgResolution ? `${myAvgResolution}h` : 'N/A',
            color: '#f59e0b' },
        ].map(({ label, value, color }) => (
          <div key={label} style={CARD}>
            <div style={LABEL}>{label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700,
              color, lineHeight: 1.1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Category breakdown + Resolution comparison */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '12px', marginBottom: '16px'
      }}>

        {/* Donut — my complaints by category */}
        <div style={CARD}>
          <div style={LABEL}>My Complaints by Category</div>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80}
                  paddingAngle={3} dataKey="value">
                  {categoryData.map((_, i) => (
                     <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconType="circle" iconSize={8}
                  wrapperStyle={{ fontSize: '0.72rem' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem',
              padding: '2rem 0', textAlign: 'center' }}>
              No complaints filed yet
            </div>
          )}
        </div>

        {/* Bar — my avg vs hostel avg resolution time */}
        <div style={CARD}>
          <div style={LABEL}>My Resolution Time vs Hostel Average</div>
          {resolutionComparison.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <RadialBarChart
                  cx="50%" cy="50%"
                  innerRadius="20%" outerRadius="90%"
                  data={resolutionComparison}
                  startAngle={90} endAngle={-270}
                >
                  <RadialBar dataKey="hours" cornerRadius={6} label={false}>
                    {resolutionComparison.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </RadialBar>
                  <Legend iconType="circle" iconSize={8}
                    wrapperStyle={{ fontSize: '0.72rem' }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE}
                    formatter={(v) => [`${v}h`, 'Avg Resolution']} />
                </RadialBarChart>
              </ResponsiveContainer>
              {myAvgResolution && hostelAvg && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)',
                  textAlign: 'center', marginTop: '4px' }}>
                  {myAvgResolution < hostelAvg
                    ? `Your complaints resolve ${Math.round(((hostelAvg - myAvgResolution) / hostelAvg) * 100)}% faster than average`
                    : myAvgResolution === hostelAvg
                    ? 'Your resolution time matches the hostel average'
                    : `Your complaints take ${Math.round(((myAvgResolution - hostelAvg) / hostelAvg) * 100)}% longer than average`}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem',
              padding: '2rem 0', textAlign: 'center' }}>
              No resolved complaints yet
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Complaint Status Timeline ── */}
      <div style={{ marginBottom: '8px', ...LABEL }}>My Complaint Timeline</div>
      <div style={{ ...CARD, marginBottom: '16px' }}>
        {complaints.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem',
            textAlign: 'center', padding: '2rem 0' }}>
            You haven't filed any complaints yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {complaints.map((c, i) => (
              <div key={c.id} style={{
                display: 'flex', gap: '16px', alignItems: 'flex-start',
                paddingBottom: i < complaints.length - 1 ? '20px' : '0',
                position: 'relative'
              }}>
                {/* Timeline line */}
                {i < complaints.length - 1 && (
                  <div style={{
                    position: 'absolute', left: '9px', top: '22px',
                    width: '2px', bottom: 0,
                    background: 'var(--border)'
                  }} />
                )}
                {/* Status dot */}
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                  marginTop: '2px',
                  background: STATUS_COLORS[c.status],
                  boxShadow: `0 0 8px ${STATUS_COLORS[c.status]}66`
                }} />
                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center',
                    gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem',
                      color: 'var(--text-primary)' }}>{c.title}</span>
                    {/* Priority badge */}
                    <span style={{
                      fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px',
                      background: `${PRIORITY_COLORS[c.priority]}22`,
                      color: PRIORITY_COLORS[c.priority], fontWeight: 600
                    }}>{c.priority}</span>
                    {/* Overdue badge */}
                    {isOverdue(c) && (
                      <span style={{
                        fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px',
                        background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 600
                      }}>OVERDUE</span>
                    )}
                  </div>
                  {/* Status pipeline */}
                  <div style={{ display: 'flex', alignItems: 'center',
                    gap: '6px', margin: '6px 0', fontSize: '0.78rem' }}>
                    {['todo', 'in_progress', 'resolved'].map((s, si) => {
                      const statuses = ['todo', 'in_progress', 'resolved'];
                      const currentIdx = statuses.indexOf(c.status);
                      const isPast = si <= currentIdx;
                      return (
                        <Fragment key={s}>
                          <span style={{
                            padding: '2px 10px', borderRadius: '10px',
                            fontSize: '0.72rem',
                            background: isPast
                              ? `${STATUS_COLORS[s]}22` : 'rgba(255,255,255,0.04)',
                            color: isPast
                              ? STATUS_COLORS[s] : 'var(--text-muted)',
                            fontWeight: isPast ? 600 : 400,
                            border: c.status === s
                              ? `1px solid ${STATUS_COLORS[s]}` : '1px solid transparent'
                          }}>
                            {STATUS_LABELS[s]}
                          </span>
                          {si < 2 && (
                            <span
                              style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                              →
                            </span>
                          )}
                        </Fragment>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {c.category} • Filed {timeAgo(c.createdAt)}
                    {c.status === 'resolved' && c.resolvedAt &&
                      ` • Resolved in ${Math.round(
                        (c.resolvedAt.toDate() - c.createdAt.toDate()) / 3600000
                      )}h`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
