import { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

const CHART_COLORS = ['#6C63FF', '#22D3A0', '#F59E0B', '#EF4444', '#3B82F6', '#06B6D4'];

const TT = {
  contentStyle: { background: '#1C1F27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#F1F5F9', fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '8px 12px' },
  cursor: { stroke: 'rgba(255,255,255,0.06)' }
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

function chipStyleLocal(val, type='status') {
  if (type==='priority') {
    if (val==='high')   return { background:'rgba(239,68,68,0.12)', color:'#EF4444' };
    if (val==='medium') return { background:'rgba(245,158,11,0.12)', color:'#F59E0B' };
    return { background:'rgba(16,185,129,0.12)', color:'#10B981' };
  }
  if (val==='in_progress') return { background:'rgba(245,158,11,0.12)', color:'#F59E0B' };
  if (val==='todo') return { background:'rgba(239,68,68,0.12)', color:'#EF4444' };
  return { background:'rgba(16,185,129,0.12)', color:'#10B981' };
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

  const [viewMode, setViewMode] = useState('grid');
  const [focusIndex, setFocusIndex] = useState(0);

  const open = data.filter(c => c.status !== 'resolved').length;
  const resolved = data.filter(c => c.status === 'resolved').length;
  const rate = Math.round((resolved / data.length) * 100);
  const engagement = Math.round((new Set(data.map(c => c.roomId)).size / 20) * 100);

  const chartDefs = [
    { id: 'trends',     label: 'Complaint trends',     accent: '#6C63FF', badge: 'LIVE' },
    { id: 'peak',       label: 'Peak hours activity',  accent: '#EF4444', badge: 'LIVE' },
    { id: 'categories', label: 'Category breakdown',   accent: '#3B82F6', badge: 'LIVE' },
    { id: 'resolution', label: 'Resolution efficiency',accent: '#22D3A0', badge: '30D'  },
  ];

  const kpis = [
    { label: 'Complaint volume', value: data.length, delta: '+14.5%', pos: true, accent: '#6C63FF', spark: [8,12,10,18,15,22,19] },
    { label: 'Resolution rate',  value: data.length ? `${Math.round((resolved/data.length)*100)}%` : '0%', delta: '+3.1%', pos: true, accent: '#22D3A0', spark: [60,65,70,72,78,88,94] },
    { label: 'High priority',    value: data.filter(c=>c.priority==='high').length, delta: '+2', pos: false, accent: '#EF4444', spark: [5,8,6,10,8,12,12] },
    { label: 'Avg. time',        value: avg != null ? `${avg}h` : '—', delta: '-18%', pos: true, accent: '#F59E0B', spark: [8,7,6,7,5,5,4] },
  ];

  const Sparkline = ({ data: d, color }) => {
    const max = Math.max(...d), min = Math.min(...d);
    const pts = d.map((v,i) => `${(i/(d.length-1))*56},${16-((v-min)/(max-min||1))*14}`).join(' ');
    return <svg width="56" height="18" viewBox="0 0 56 18"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  };

  const ChartCard = ({ def, children, onExpand }) => (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', transition:'box-shadow 0.2s', position:'relative' }}
      onMouseOver={e=>e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,0.2)'}
      onMouseOut={e=>e.currentTarget.style.boxShadow='none'}
    >
      <div style={{ height:2, background:def.accent }} />
      <div style={{ padding:'14px 16px 0' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:def.accent, animation: def.badge==='LIVE' ? 'pulse 2s infinite' : 'none' }} />
            <span style={{ fontSize:12.5, fontWeight:600, color:'var(--text)' }}>{def.label}</span>
            <span style={{ fontSize:10, fontFamily:'var(--font-mono)', background:'var(--bg-input)', color:'var(--text-3)', padding:'1px 6px', borderRadius:4 }}>{def.badge}</span>
          </div>
          <button onClick={onExpand} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', display:'flex', alignItems:'center', padding:4, borderRadius:6, transition:'color 0.15s' }}
            onMouseOver={e=>e.currentTarget.style.color='var(--text)'}
            onMouseOut={e=>e.currentTarget.style.color='var(--text-3)'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
          </button>
        </div>
      </div>
      <div style={{ padding:'0 16px 16px' }}>{children}</div>
    </div>
  );

  const renderChart = (id, height=180) => {
    const days = vol.slice(-7).map(d => d.date.split(' ')[0]);

    if (id === 'trends') return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={vol.slice(-7).map((d,i)=>({...d, label: days[i]}))} margin={{top:4,right:4,bottom:0,left:-20}}>
          <defs>
            <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#6C63FF" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
          <XAxis dataKey="label" tick={{fill:'#475569',fontSize:10}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fill:'#475569',fontSize:10}} axisLine={false} tickLine={false}/>
          <Tooltip contentStyle={TT.contentStyle} cursor={TT.cursor}/>
          <Area type="monotone" dataKey="count" stroke="#6C63FF" strokeWidth={2.5} fill="url(#aGrad)" dot={false} activeDot={{r:4,fill:'#6C63FF'}}/>
        </AreaChart>
      </ResponsiveContainer>
    );

    if (id === 'peak') {
      const peakData = peaks.map(p => ({
        ...p,
        fill: p.count >= 4 ? '#EF4444' : p.count >= 2 ? '#F59E0B' : '#22D3A0'
      }));
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={peakData} margin={{top:4,right:4,bottom:0,left:-20}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
            <XAxis dataKey="hour" tick={{fill:'#475569',fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:'#475569',fontSize:10}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={TT.contentStyle} cursor={TT.cursor}/>
            <Bar dataKey="count" radius={[6,6,0,0]}>
              {peakData.map((entry,i) => <Cell key={i} fill={entry.fill}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (id === 'categories') {
      const total = cats.reduce((s,c)=>s+c.value,0);
      return (
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div style={{position:'relative',width:height,height,flexShrink:0}}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={cats} cx="50%" cy="50%" innerRadius="55%" outerRadius="78%" paddingAngle={2} dataKey="value">
                  {cats.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                </Pie>
                <Tooltip contentStyle={TT.contentStyle}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',pointerEvents:'none'}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:22,fontWeight:500,color:'var(--text)',lineHeight:1}}>Total</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:28,fontWeight:700,color:'var(--text)',lineHeight:1.1}}>{total}</div>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:7,flex:1}}>
            {cats.map((c,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:7}}>
                <div style={{width:8,height:8,borderRadius:2,background:CHART_COLORS[i%CHART_COLORS.length],flexShrink:0}}/>
                <span style={{fontSize:11.5,color:'var(--text-2)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</span>
                <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-3)'}}>{total>0?Math.round((c.value/total)*100):0}%</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (id === 'resolution') {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={resCat} layout="vertical" margin={{top:4,right:8,bottom:0,left:8}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false}/>
            <XAxis type="number" tick={{fill:'#475569',fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis type="category" dataKey="category" tick={{fill:'#475569',fontSize:10}} axisLine={false} tickLine={false} width={60}/>
            <Tooltip contentStyle={TT.contentStyle} cursor={TT.cursor} formatter={v=>[`${v}h`,'Avg time']}/>
            <Bar dataKey="avgHours" fill="#22D3A0" radius={[0,6,6,0]}/>
          </BarChart>
        </ResponsiveContainer>
      );
    }
  };

  const timelineItems = data.slice(-5).reverse();

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20,paddingBottom:24}}>

      {/* Sample data banner */}
      <div style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:8,padding:'8px 14px',display:'flex',alignItems:'center',gap:8,fontSize:12,color:'var(--amber)'}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Sample data — analytics will populate with real complaints
      </div>

      {/* Header + toggle */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <h2 style={{fontFamily:'var(--font-heading)',fontSize:20,fontWeight:700,color:'var(--text)',letterSpacing:'-0.02em',margin:0}}>Analytics overview</h2>
        <div style={{display:'flex',background:'var(--bg-input)',padding:4,borderRadius:999,border:'1px solid var(--border)',gap:2}}>
          {[['grid','Grid','M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],['focus','Focus','M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3']].map(([v,l,path])=>(
            <button key={v} onClick={()=>setViewMode(v)} style={{
              background:viewMode===v?'var(--bg-card)':'transparent',
              border:'none', borderRadius:999, padding:'6px 14px',
              color:viewMode===v?'var(--text)':'var(--text-3)',
              cursor:'pointer', display:'flex', alignItems:'center', gap:5,
              fontSize:12.5, fontWeight:500, fontFamily:'var(--font)',
              boxShadow:viewMode===v?'0 0 0 1px var(--border)':'none',
              transition:'all 0.15s', position:'relative'
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={path}/></svg>
              {l}
              {viewMode===v && <div style={{position:'absolute',bottom:-2,left:'20%',right:'20%',height:2,background:'var(--primary)',borderRadius:2}}/>}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:14}}>
        {kpis.map((k,i)=>(
          <div key={i} style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,padding:'16px 18px',position:'relative',overflow:'hidden',transition:'box-shadow 0.2s'}}
            onMouseOver={e=>e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,0.2)'}
            onMouseOut={e=>e.currentTarget.style.boxShadow='none'}
          >
            <div style={{height:3,background:k.accent,position:'absolute',top:0,left:0,right:0,borderRadius:'14px 14px 0 0'}}/>
            <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.09em',color:'var(--text-3)',marginBottom:8,marginTop:6}}>{k.label}</div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:32,fontWeight:500,color:'var(--text)',lineHeight:1,marginBottom:8}}>{k.value}</div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',flexDirection:'column',gap:2}}>
                <span style={{fontSize:11,fontFamily:'var(--font-mono)',fontWeight:600,padding:'2px 7px',borderRadius:4,background:k.pos?'rgba(16,185,129,0.12)':'rgba(239,68,68,0.12)',color:k.pos?'var(--green)':'var(--red)',display:'inline-block'}}>{k.delta}</span>
                <span style={{fontSize:10,color:'var(--text-3)'}}>vs last period</span>
              </div>
              <div style={{opacity:0.5}}><Sparkline data={k.spark} color={k.accent}/></div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts + Timeline */}
      <div style={{display:'flex',gap:20,alignItems:'flex-start'}}>

        {/* Charts */}
        <div style={{flex:1,minWidth:0}}>
          {viewMode==='grid' ? (
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:16}}>
              {chartDefs.map((def,i)=>(
                <ChartCard key={def.id} def={def} onExpand={()=>{setFocusIndex(i);setViewMode('focus');}}>
                  {renderChart(def.id)}
                </ChartCard>
              ))}
            </div>
          ) : (
            <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden',minHeight:420}}>
              <div style={{height:2,background:chartDefs[focusIndex].accent}}/>
              <div style={{padding:'16px 20px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
                  <button onClick={()=>setFocusIndex(i=>(i-1+chartDefs.length)%chartDefs.length)} style={{width:36,height:36,borderRadius:'50%',background:'var(--bg-input)',border:'1px solid var(--border)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-2)',transition:'all 0.15s'}}
                    onMouseOver={e=>e.currentTarget.style.borderColor='var(--border-strong)'}
                    onMouseOut={e=>e.currentTarget.style.borderColor='var(--border)'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                  </button>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:7,height:7,borderRadius:'50%',background:chartDefs[focusIndex].accent,animation:'pulse 2s infinite'}}/>
                    <span style={{fontFamily:'var(--font-heading)',fontSize:16,fontWeight:600,color:'var(--text)'}}>{chartDefs[focusIndex].label}</span>
                  </div>
                  <button onClick={()=>setFocusIndex(i=>(i+1)%chartDefs.length)} style={{width:36,height:36,borderRadius:'50%',background:'var(--bg-input)',border:'1px solid var(--border)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-2)',transition:'all 0.15s'}}
                    onMouseOver={e=>e.currentTarget.style.borderColor='var(--border-strong)'}
                    onMouseOut={e=>e.currentTarget.style.borderColor='var(--border)'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                </div>
                {renderChart(chartDefs[focusIndex].id, 320)}
                <div style={{display:'flex',justifyContent:'center',gap:7,marginTop:20}}>
                  {chartDefs.map((_,i)=>(
                    <div key={i} onClick={()=>setFocusIndex(i)} style={{width:i===focusIndex?20:7,height:7,borderRadius:4,background:i===focusIndex?'var(--primary)':'rgba(148,163,184,0.3)',cursor:'pointer',transition:'all 0.2s'}}/>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Timeline sidebar */}
        <div style={{width:280,flexShrink:0}}>
          <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden'}}>
            <div style={{padding:'14px 16px 10px',borderBottom:'1px solid var(--border)'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:'var(--green)',animation:'pulse 2s infinite'}}/>
                <span style={{fontFamily:'var(--font-heading)',fontSize:13,fontWeight:600,color:'var(--text)'}}>Live timeline</span>
              </div>
              <div style={{fontSize:11,color:'var(--text-3)'}}>Real-time feed of active hostel issues</div>
            </div>

            {timelineItems.map((c,i)=>{
              const nc = c.status==='resolved' ? {bg:'#D1FAE5',border:'#10B981',icon:'#059669',line:'#10B981'} : c.status==='in_progress' ? {bg:'#FEF3C7',border:'#F59E0B',icon:'#D97706',line:'#F59E0B'} : {bg:'#FEE2E2',border:'#EF4444',icon:'#DC2626',line:'#EF4444'};
              const isLast = i === timelineItems.length-1;
              return (
                <div key={c.id} style={{display:'flex',gap:10,padding:'0 14px',alignItems:'stretch'}}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:22,flexShrink:0,paddingTop:12}}>
                    <div style={{width:18,height:18,borderRadius:'50%',background:nc.bg,border:`1.5px solid ${nc.border}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      {c.status==='resolved'
                        ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={nc.icon} strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
                        : <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={nc.icon} strokeWidth="3"><circle cx="12" cy="12" r="8"/></svg>
                      }
                    </div>
                    {!isLast && <div style={{width:1.5,flex:1,minHeight:10,marginTop:4,background:nc.line,opacity:0.2,borderRadius:1}}/>}
                  </div>
                  <div style={{flex:1,padding:'10px 0 10px',borderBottom:isLast?'none':'1px solid var(--border)',opacity:c.status==='resolved'?0.6:1}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:3}}>
                      <div style={{fontSize:12,fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:150}}>{c.title || `${c.category} issue`}</div>
                      <span style={{fontSize:10,color:'var(--text-3)',fontFamily:'var(--font-mono)',flexShrink:0,marginLeft:6}}>
                        {c.createdAt?.toDate ? Math.floor((Date.now()-c.createdAt.toDate().getTime())/3600000)+'h' : '—'}
                      </span>
                    </div>
                    <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
                      <span style={{fontSize:10,fontWeight:500,padding:'1.5px 6px',borderRadius:3,...chipStyleLocal(c.priority,'priority')}}>{c.priority}</span>
                      <span style={{fontSize:10,padding:'1.5px 6px',borderRadius:3,background:'var(--bg-input)',color:'var(--text-3)'}}>{c.category}</span>
                    </div>
                    {c.status!=='resolved' && (
                      <div style={{height:2,borderRadius:1,marginTop:5,background:'var(--bg-hover)',overflow:'hidden'}}>
                        <div style={{width:`${Math.min(100,c.priority==='high'?60:c.priority==='medium'?35:15)}%`,height:'100%',background:nc.border,borderRadius:1}}/>
                      </div>
                    )}
                    {c.acknowledgedByWarden && <div style={{fontSize:10,color:'var(--green)',marginTop:3}}>✓ Warden has seen this</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
