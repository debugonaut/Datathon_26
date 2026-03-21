import { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

const CHART_COLORS = ['#7C6EFA', '#22D3A0', '#F5A623', '#F06565', '#4FA3F7', '#2DD4BF'];

const TT = {
  contentStyle: { background: '#1C2030', border: '1px solid #2E3448', borderRadius: '8px', color: '#EDF0FA', fontSize: '11px', fontFamily: "'JetBrains Mono'" },
  cursor: { stroke: '#2E3448' }
};

// ── Dummy data ──────────────────────────────────────────────────────────────
function genDummy() {
  const cats = ['Electrical', 'Plumbing', 'Cleaning', 'Carpentry', 'Internet', 'Other'];
  const pris = ['low', 'medium', 'high'];
  const stats = ['todo', 'in_progress', 'resolved'];
  const d = [], now = Date.now();
  for (let i = 0; i < 45; i++) {
    const ago = Math.floor((i * 29) / 44);
    const ct = new Date(now - ago * 86400000 - (i * 3600000) % 86400000);
    const st = stats[i % 3];
    const rt = st === 'resolved' ? new Date(ct.getTime() + ((i % 5) + 2) * 3600000) : null;
    d.push({ id: i, category: cats[i % 6], priority: pris[i % 3], status: st,
      floorNumber: String((i % 4) + 1), roomId: `r${i % 20}`,
      createdAt: { toDate: () => ct }, resolvedAt: rt ? { toDate: () => rt } : null });
  }
  return d.sort((a, b) => a.createdAt.toDate() - b.createdAt.toDate());
}

function volByDay(c) {
  const m = {}; const now = Date.now();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    m[d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })] = 0;
  }
  c.forEach(x => { const d = x.createdAt?.toDate?.(); if (d) { const k = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); if (k in m) m[k]++; } });
  return Object.entries(m).map(([date, count]) => ({ date, count }));
}
function catBreak(c) { const m = {}; c.forEach(x => m[x.category] = (m[x.category] || 0) + 1); return Object.entries(m).map(([n, v]) => ({ name: n, value: v })); }
function priBreak(c) {
  const m = { low: 0, medium: 0, high: 0 }; c.forEach(x => m[x.priority]++);
  return [{ name: 'Low', value: m.low, fill: '#22D3A0' }, { name: 'Med', value: m.medium, fill: '#F5A623' }, { name: 'High', value: m.high, fill: '#F06565' }];
}
function avgRes(c) {
  const r = c.filter(x => x.resolvedAt && x.createdAt);
  if (!r.length) return null;
  return Math.round(r.reduce((s, x) => s + (x.resolvedAt.toDate() - x.createdAt.toDate()) / 3600000, 0) / r.length);
}
function resByCat(c) {
  const m = {}; c.filter(x => x.resolvedAt && x.createdAt).forEach(x => {
    const h = (x.resolvedAt.toDate() - x.createdAt.toDate()) / 3600000;
    if (!m[x.category]) m[x.category] = { t: 0, c: 0 }; m[x.category].t += h; m[x.category].c++;
  });
  return Object.entries(m).map(([cat, d]) => ({ category: cat, avgHours: Math.round(d.t / d.c) }));
}
function peakHrs(c) {
  const h = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}`, count: 0 }));
  c.forEach(x => { const d = x.createdAt?.toDate?.(); if (d) h[d.getHours()].count++; });
  return h;
}
function heatmap(c) {
  const wks = [], now = Date.now();
  for (let i = 5; i >= 0; i--) { wks.push({ l: i === 0 ? 'Now' : `W-${i}`, s: new Date(now - (i+1) * 7 * 86400000), e: new Date(now - i * 7 * 86400000) }); }
  const fs = [...new Set(c.map(x => x.floorNumber))].sort();
  return fs.map(f => {
    const r = { floor: `F${f}` };
    wks.forEach(w => { r[w.l] = c.filter(x => { const d = x.createdAt?.toDate?.(); return d && x.floorNumber === f && d >= w.s && d < w.e; }).length; });
    return r;
  });
}
function funnel(c) {
  return [
    { stage: 'Filed', count: c.length, fill: '#7C6EFA' },
    { stage: 'In Progress', count: c.filter(x => x.status === 'in_progress' || x.status === 'resolved').length, fill: '#F5A623' },
    { stage: 'Resolved', count: c.filter(x => x.status === 'resolved').length, fill: '#22D3A0' },
  ];
}

// ── Component ───────────────────────────────────────────────────────────────
export default function WardenAnalytics({ hostelId }) {
  const data = useMemo(() => genDummy(), []);
  const vol = useMemo(() => volByDay(data), [data]);
  const cats = useMemo(() => catBreak(data), [data]);
  const pris = useMemo(() => priBreak(data), [data]);
  const avg = useMemo(() => avgRes(data), [data]);
  const resCat = useMemo(() => resByCat(data), [data]);
  const peaks = useMemo(() => peakHrs(data), [data]);
  const heat = useMemo(() => heatmap(data), [data]);
  const fun = useMemo(() => funnel(data), [data]);

  const open = data.filter(c => c.status !== 'resolved').length;
  const resolved = data.filter(c => c.status === 'resolved').length;
  const rate = Math.round((resolved / data.length) * 100);
  const engagement = Math.round((new Set(data.map(c => c.roomId)).size / 20) * 100);
  const weekKeys = heat.length > 0 ? Object.keys(heat[0]).filter(k => k !== 'floor') : [];

  const heatColor = v => v === 0 ? 'rgba(255,255,255,0.03)' : v === 1 ? 'rgba(245,166,35,0.3)' : v === 2 ? 'rgba(245,166,35,0.6)' : 'rgba(240,101,101,0.8)';

  const card = { background: 'var(--bg-surface)', border: '1px solid var(--border-v2)', borderRadius: '12px', padding: '20px 24px', transition: 'border-color 0.2s ease' };
  const label = { fontSize: '10px', color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px', fontFamily: 'var(--font-body)' };
  const bigNum = (color) => ({ fontSize: '24px', fontWeight: 600, color, lineHeight: 1.1, fontFamily: 'var(--font-mono)' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0.25rem 0' }}>

      {/* Sample data banner */}
      <div style={{ background: 'rgba(245,166,35,0.05)', border: '1px solid rgba(245,166,35,0.15)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-primary)', marginBottom: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)', flexShrink: 0 }} />
        <span><strong>Sample data</strong> — analytics will populate with real complaints.</span>
      </div>

      {/* Row 1: KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
        {[
          { l: 'Total', v: data.length, c: 'var(--violet)' },
          { l: 'Open', v: open, c: 'var(--red)' },
          { l: 'Resolved', v: resolved, c: 'var(--green)' },
          { l: 'Rate', v: `${rate}%`, c: 'var(--green)' },
          { l: 'Avg Res.', v: avg ? `${avg}h` : '—', c: 'var(--amber)' },
          { l: 'Engagement', v: `${engagement}%`, c: 'var(--violet)' },
        ].map(k => (
          <div key={k.l} style={{...card, borderTop: `2px solid ${k.c}`}}>
            <div style={label}>{k.l}</div>
            <div style={bigNum(k.c)}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Row 2: Main 3-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1fr', gap: '8px', minHeight: 0 }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Category donut */}
          <div style={card}>
            <div style={label}>By Category</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={cats} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                  {cats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip {...TT} />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '0.62rem' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Priority pie */}
          <div style={card}>
            <div style={label}>Priority Split</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pris} cx="50%" cy="50%" outerRadius={80} paddingAngle={2} dataKey="value">
                  {pris.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip {...TT} />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '0.62rem' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Funnel */}
          <div style={card}>
            <div style={label}>Resolution Funnel</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={fun} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} width={60} />
                <Tooltip {...TT} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {fun.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Center column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Volume area chart */}
          <div style={card}>
            <div style={label}>Complaint Volume — 30 Days</div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={vol}>
                <defs>
                  <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C6EFA" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7C6EFA" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1C2030" />
                <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#454D65' }} interval={5} />
                <YAxis tick={{ fontSize: 9, fill: '#454D65' }} allowDecimals={false} width={20} />
                <Tooltip {...TT} />
                <Area type="monotone" dataKey="count" stroke="#7C6EFA" fill="url(#vg)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#7C6EFA' }} name="Complaints" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Peak hours */}
          <div style={card}>
            <div style={label}>Peak Hours (24h)</div>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={peaks}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1C2030" />
                <XAxis dataKey="hour" tick={{ fontSize: 7, fill: '#454D65' }} interval={2} />
                <YAxis tick={{ fontSize: 8, fill: '#454D65' }} allowDecimals={false} width={16} />
                <Tooltip {...TT} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {peaks.map((e, i) => <Cell key={i} fill={e.count === Math.max(...peaks.map(h => h.count)) ? '#F06565' : e.count > 1 ? '#F5A623' : '#22D3A0'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Cumulative filed vs resolved */}
          <div style={card}>
            <div style={label}>Cumulative Filed vs Resolved</div>
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={(() => {
                let f = 0, r = 0;
                return vol.map(day => {
                  f += day.count;
                  r += data.filter(c => { const d = c.resolvedAt?.toDate?.(); return d && d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) === day.date; }).length;
                  return { date: day.date, filed: f, resolved: r };
                });
              })()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1C2030" />
                <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#454D65' }} interval={5} />
                <YAxis tick={{ fontSize: 8, fill: '#454D65' }} allowDecimals={false} width={20} />
                <Tooltip {...TT} />
                <Legend iconSize={6} wrapperStyle={{ fontSize: '12px', fontFamily: "'Plus Jakarta Sans'" }} />
                <Line type="monotone" dataKey="filed" stroke="#F06565" strokeWidth={2.5} dot={false} name="Filed" />
                <Line type="monotone" dataKey="resolved" stroke="#22D3A0" strokeWidth={2.5} dot={false} name="Resolved" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Radar */}
          <div style={card}>
            <div style={label}>Status by Category</div>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={[...new Set(data.map(c => c.category))].map(cat => ({
                category: cat.slice(0, 5),
                open: data.filter(c => c.category === cat && c.status === 'todo').length,
                prog: data.filter(c => c.category === cat && c.status === 'in_progress').length,
                done: data.filter(c => c.category === cat && c.status === 'resolved').length,
              }))}>
                <PolarGrid stroke="#1C2030" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 8, fill: '#454D65' }} />
                <Radar name="Open" dataKey="open" stroke="#F06565" fill="#F06565" fillOpacity={0.15} />
                <Radar name="In Prog" dataKey="prog" stroke="#F5A623" fill="#F5A623" fillOpacity={0.15} />
                <Radar name="Done" dataKey="done" stroke="#22D3A0" fill="#22D3A0" fillOpacity={0.15} />
                <Legend iconSize={6} wrapperStyle={{ fontSize: '12px', fontFamily: "'Plus Jakarta Sans'" }} />
                <Tooltip {...TT} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          {/* Avg resolution by category */}
          <div style={card}>
            <div style={label}>Avg Resolution (hrs)</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={resCat} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 8, fill: 'var(--text-muted)' }} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 8, fill: 'var(--text-muted)' }} width={55} />
                <Tooltip {...TT} />
                <Bar dataKey="avgHours" radius={[0, 3, 3, 0]}>
                  {resCat.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Floor heatmap */}
          <div style={card}>
            <div style={label}>Floor Heatmap (6 wks)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.65rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '3px 6px', color: 'var(--text-muted)', textAlign: 'left', fontWeight: 500 }}></th>
                  {weekKeys.map(w => <th key={w} style={{ padding: '3px 4px', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 500 }}>{w}</th>)}
                </tr>
              </thead>
              <tbody>
                {heat.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: '3px 6px', color: 'var(--text-primary)', fontWeight: 500 }}>{row.floor}</td>
                    {weekKeys.map(w => (
                      <td key={w} style={{ padding: '2px 3px', textAlign: 'center' }}>
                        <div style={{
                          background: heatColor(row[w]), borderRadius: '4px', padding: '3px 6px',
                          color: row[w] > 0 ? 'white' : 'var(--text-muted)',
                          fontWeight: row[w] > 2 ? 700 : 400, fontSize: '0.65rem',
                        }}>{row[w] || '–'}</div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
