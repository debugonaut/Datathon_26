import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
  PieChart, Pie,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

// Dummy data for charts
const complaintTrends = [
  { name: 'Mon', total: 12, resolved: 8 },
  { name: 'Tue', total: 19, resolved: 15 },
  { name: 'Wed', total: 14, resolved: 12 },
  { name: 'Thu', total: 22, resolved: 16 },
  { name: 'Fri', total: 28, resolved: 20 },
  { name: 'Sat', total: 10, resolved: 9 },
  { name: 'Sun', total: 8, resolved: 7 },
];

const peakHours = [
  { hour: '08:00', value: 30 },
  { hour: '10:00', value: 45 },
  { hour: '12:00', value: 75 },
  { hour: '14:00', value: 60 },
  { hour: '16:00', value: 90 },
  { hour: '18:00', value: 110 },
  { hour: '20:00', value: 50 },
];

const categories = [
  { name: 'Plumbing', value: 45 },
  { name: 'Electrical', value: 30 },
  { name: 'Internet', value: 15 },
  { name: 'Cleaning', value: 10 },
];
const COLORS = ['#7C6EFA', '#4FA3F7', '#F5A623', '#22D3A0'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(28, 32, 48, 0.8)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '12px 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        color: 'var(--text-primary)'
      }}>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{label}</p>
        {payload.map((entry, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{entry.value}</span>
            <span style={{ fontSize: '0.85rem' }}>{entry.name}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Reusable Chart Card Shell
export const ChartCard = ({ title, labelText, accentColor, children }) => {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderTop: `2px solid ${accentColor}`,
      borderRadius: 'var(--radius-lg)',
      padding: '24px',
      position: 'relative',
      height: '350px',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
    }} className="chart-card">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '10px',
            color: accentColor,
            fontFamily: 'var(--font-mono)'
          }}>● LIVE</span>
          <h3 style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 600,
            letterSpacing: '-0.01em'
          }}>{title}</h3>
        </div>
        <span style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>↗</span>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        {children}
      </div>
    </div>
  );
};

export const LineChartOverview = () => (
  <ChartCard title="Complaint Trends" accentColor="var(--accent-primary)">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={complaintTrends} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '4 4' }} />
        <Area type="monotone" dataKey="total" stroke="var(--accent-primary)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTotal)" activeDot={{ r: 6, fill: 'var(--accent-primary)', stroke: 'var(--bg)', strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  </ChartCard>
);

export const BarChartPeakHours = () => {
  const getBarColor = (val) => {
    if (val > 80) return 'var(--accent-red)';
    if (val > 40) return 'var(--accent-amber)';
    return 'var(--accent-green)';
  };
  return (
    <ChartCard title="Peak Hours Activity" accentColor="var(--accent-red)">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={peakHours} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} content={<CustomTooltip />} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {peakHours.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.value)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export const DonutChartCategories = () => (
  <ChartCard title="Category Breakdown" accentColor="var(--accent-blue)">
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={categories}
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="80%"
            paddingAngle={2}
            dataKey="value"
            stroke="var(--bg)"
            strokeWidth={3}
          >
            {categories.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Dynamic Inner Label */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'none'
      }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total</div>
        <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>100</div>
      </div>
    </div>
  </ChartCard>
);

export const RadarChartStatus = () => (
  <ChartCard title="Resolution Efficiency" accentColor="var(--accent-green)">
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart outerRadius="70%" data={categories} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
        <Radar name="Efficiency" dataKey="value" stroke="var(--accent-green)" fill="var(--accent-green)" fillOpacity={0.2} />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  </ChartCard>
);
