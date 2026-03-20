import { useMemo, Fragment } from 'react';
import {
  AreaChart, Area,
  PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const TT = { background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.75rem' };
const CHART_COLORS = ['#378ADD', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const PRI_C = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
const ST_C = { todo: '#ef4444', in_progress: '#f59e0b', resolved: '#10b981' };
const ST_L = { todo: 'To Do', in_progress: 'In Progress', resolved: 'Resolved' };

function timeAgo(ts) {
  if (!ts || typeof ts.toDate !== 'function') return '?';
  const d = Date.now() - ts.toDate().getTime(), m = Math.floor(d/60000), h = Math.floor(d/3600000), dy = Math.floor(d/86400000);
  return m < 60 ? `${m}m` : h < 24 ? `${h}h` : `${dy}d`;
}
function isOverdue(c) {
  if (c.status === 'resolved') return false;
  const d = c.createdAt?.toDate?.(); if (!d) return false;
  const h = (Date.now() - d.getTime()) / 3600000;
  return (c.priority === 'high' && h > 48) || (c.priority === 'medium' && h > 96) || (c.priority === 'low' && h > 168);
}

function genDummy() {
  const cats = ['Electrical', 'Plumbing', 'Cleaning', 'Internet'];
  const pris = ['low', 'medium', 'high'], sts = ['todo', 'in_progress', 'resolved'];
  const d = [], now = Date.now();
  for (let i = 0; i < 8; i++) {
    const ct = new Date(now - Math.floor((i*29)/7) * 86400000 - i*7200000);
    const st = sts[i%3], rt = st === 'resolved' ? new Date(ct.getTime()+((i%5)+2)*3600000) : null;
    d.push({ id: `d${i}`, title: `Sample Issue ${i+1}`, category: cats[i%4], priority: pris[i%3], status: st,
      createdAt: { toDate: () => ct }, resolvedAt: rt ? { toDate: () => rt } : null });
  }
  return d.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());
}

function myAvg(c) { const r = c.filter(x => x.resolvedAt && x.createdAt); if (!r.length) return null; return Math.round(r.reduce((s, x) => s + (x.resolvedAt.toDate()-x.createdAt.toDate()), 0)/r.length/3600000); }
function catBreak(c) { const m = {}; c.forEach(x => m[x.category]=(m[x.category]||0)+1); return Object.entries(m).map(([n,v])=>({name:n,value:v})); }
function scoreHist(c, cs) {
  const now = Date.now(), d = [];
  for (let i = 29; i >= 0; i--) {
    const de = new Date(now - i*86400000);
    const pl = c.filter(x => { const cr = x.createdAt?.toDate?.(); return cr && cr > de && x.status !== 'resolved'; })
      .reduce((s,x) => s + (x.priority==='high'?30:x.priority==='medium'?15:5), 0);
    d.push({ date: de.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}), score: Math.min(100,Math.max(0,cs+pl)) });
  }
  return d;
}

export default function StudentAnalytics({ roomScore }) {
  const data = useMemo(() => genDummy(), []);
  const score = roomScore ?? 100;
  const avg = useMemo(() => myAvg(data), [data]);
  const cats = useMemo(() => catBreak(data), [data]);
  const hist = useMemo(() => scoreHist(data, score), [data, score]);
  const open = data.filter(c => c.status !== 'resolved');
  const resolved = data.filter(c => c.status === 'resolved');
  const overdue = data.filter(isOverdue);
  const hostelAvg = 24;

  const sc = score >= 71 ? '#10b981' : score >= 41 ? '#f59e0b' : '#ef4444';
  const gaugeData = [{ name: 's', value: score, fill: sc }, { name: 'r', value: 100-score, fill: 'rgba(255,255,255,0.06)' }];
  const resComp = avg && hostelAvg ? [{ name: 'Mine', hours: avg, fill: '#378ADD' }, { name: 'Hostel', hours: hostelAvg, fill: '#8b5cf6' }] : [];

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.75rem' };
  const label = { fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0.25rem 0' }}>

      {/* Banner */}
      <div style={{ background: 'rgba(55,138,221,0.08)', border: '1px solid rgba(55,138,221,0.25)', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
        <span>ℹ️</span>
        <span><strong>Sample Data</strong> — your stats will populate with real complaints.</span>
      </div>

      {/* Row 1: KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
        {[
          { l: 'Total Filed', v: data.length, c: '#378ADD' },
          { l: 'Open', v: open.length, c: '#ef4444' },
          { l: 'Resolved', v: resolved.length, c: '#10b981' },
          { l: 'Overdue', v: overdue.length, c: overdue.length > 0 ? '#ef4444' : '#10b981' },
          { l: 'Avg Res.', v: avg ? `${avg}h` : '—', c: '#f59e0b' },
        ].map(k => (
          <div key={k.l} style={card}>
            <div style={label}>{k.l}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: k.c, lineHeight: 1.1 }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Row 2: 3-column dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr', gap: '8px', minHeight: 0 }}>

        {/* Left: Room score gauge */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={label}>Room Score</div>
            <div style={{
              width: '140px', height: '140px', margin: '1rem auto',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `conic-gradient(${sc} ${score}%, rgba(255,255,255,0.05) ${score}%)`,
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute', inset: '10px', background: 'var(--surface)', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'
              }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: sc }}>{score}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ 100</span>
              </div>
            </div>
            <div style={{ fontSize: '0.8.5rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              {score >= 71 ? 'Good shape' : score >= 41 ? 'Needs attention' : 'Critical'}
            </div>
          </div>

          {/* Category donut */}
          <div style={card}>
            <div style={label}>By Category</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={cats} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                  {cats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TT} />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '0.6rem' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Resolution comparison */}
          {resComp.length > 0 && (
            <div style={card}>
              <div style={label}>My vs Hostel Avg</div>
              <ResponsiveContainer width="100%" height={160}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="90%" data={resComp} startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="hours" cornerRadius={4}>{resComp.map((e, i) => <Cell key={i} fill={e.fill} />)}</RadialBar>
                  <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '0.6rem' }} />
                  <Tooltip contentStyle={TT} formatter={v => [`${v}h`, 'Avg']} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Center: Score trend chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={card}>
            <div style={label}>Room Score — 30 Days</div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={hist}>
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 8, fill: 'var(--text-muted)' }} interval={6} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--text-muted)' }} width={20} />
                <Tooltip contentStyle={TT} />
                <Area type="monotone" dataKey="score" stroke="#10b981" fill="url(#sg)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Overdue alerts */}
          {overdue.length > 0 && (
            <div style={{ ...card, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={label}>⚠️ Overdue Complaints</div>
              {overdue.slice(0, 3).map(c => (
                <div key={c.id} style={{ fontSize: '0.75rem', color: 'var(--text-primary)', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <strong style={{ color: '#ef4444' }}>{c.title}</strong> — {c.category} · {timeAgo(c.createdAt)} ago
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Complaint Timeline */}
        <div style={{ ...card, overflowY: 'auto', maxHeight: '600px' }}>
          <div style={label}>Complaint Timeline</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', marginTop: '12px' }}>
            {data.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', paddingBottom: i < data.length - 1 ? '16px' : '0', position: 'relative' }}>
                {i < data.length - 1 && <div style={{ position: 'absolute', left: '7px', top: '18px', width: '2px', bottom: 0, background: 'var(--border)' }} />}
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, marginTop: '2px', background: ST_C[c.status], boxShadow: `0 0 6px ${ST_C[c.status]}66` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{c.title}</span>
                    <span style={{ fontSize: '0.7rem', padding: '1px 8px', borderRadius: '8px', background: `${PRI_C[c.priority]}22`, color: PRI_C[c.priority], fontWeight: 600 }}>{c.priority}</span>
                    {isOverdue(c) && <span style={{ fontSize: '0.7rem', padding: '1px 8px', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 600 }}>OVERDUE</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0', fontSize: '0.75rem' }}>
                    {['todo', 'in_progress', 'resolved'].map((s, si) => {
                      const ci = ['todo', 'in_progress', 'resolved'].indexOf(c.status);
                      const past = si <= ci;
                      return (
                        <Fragment key={s}>
                          <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '0.7rem',
                            background: past ? `${ST_C[s]}22` : 'rgba(255,255,255,0.04)',
                            color: past ? ST_C[s] : 'var(--text-muted)', fontWeight: past ? 600 : 400,
                            border: c.status === s ? `1px solid ${ST_C[s]}` : '1px solid transparent' }}>{ST_L[s]}</span>
                          {si < 2 && <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>→</span>}
                        </Fragment>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {c.category} · {timeAgo(c.createdAt)} ago
                    {c.status === 'resolved' && c.resolvedAt && ` · ${Math.round((c.resolvedAt.toDate()-c.createdAt.toDate())/3600000)}h`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
