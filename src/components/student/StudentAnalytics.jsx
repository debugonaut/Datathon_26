import { useState, useEffect, useMemo, Fragment } from 'react';
import {
  AreaChart, Area,
  PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp, increment, deleteDoc, writeBatch } from 'firebase/firestore';
import { getSLAStatus } from '../../utils/sla';

const TT = { background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.75rem' };
const CHART_COLORS = ['#4FA3F7', '#22D3A0', '#F5A623', '#F06565', '#7C6EFA'];
const PRI_C = { high: '#F06565', medium: '#F5A623', low: '#22D3A0' };
const ST_C = { todo: '#F06565', in_progress: '#F5A623', resolved: '#22D3A0' };
const ST_L = { todo: 'To Do', in_progress: 'In Progress', resolved: 'Resolved' };

function timeAgo(date) {
  if (!date || typeof date.toDate !== 'function') return '?';
  const d = Date.now() - date.toDate().getTime(), m = Math.floor(d/60000), h = Math.floor(d/3600000), dy = Math.floor(d/86400000);
  return m < 60 ? `${m}m` : h < 24 ? `${h}h` : `${dy}d`;
}
function isOverdue(c) {
  if (c.status === 'resolved') return false;
  const d = c.createdAt?.toDate?.(); if (!d) return false;
  const h = (Date.now() - d.getTime()) / 3600000;
  return (c.priority === 'high' && h > 24) || (c.priority === 'medium' && h > 72) || (c.priority === 'low' && h > 168);
}

function chipStyle(val, type = 'status') {
  if (type === 'priority') {
    if (val === 'high')   return { background:'rgba(239,68,68,0.12)',   color:'var(--red)'   };
    if (val === 'medium') return { background:'rgba(245,158,11,0.12)',  color:'var(--amber)' };
    return                       { background:'rgba(16,185,129,0.12)',  color:'var(--green)' };
  }
  if (val === 'in_progress') return { background:'rgba(245,158,11,0.12)',  color:'var(--amber)' };
  if (val === 'todo')        return { background:'rgba(239,68,68,0.12)',   color:'var(--red)'   };
  return                           { background:'rgba(16,185,129,0.12)',  color:'var(--green)' };
}

function myAvg(c) {
  const r = c.filter(x => x.resolvedAt?.toDate && x.createdAt?.toDate);
  if (!r.length) return null;
  return Math.round(r.reduce((s, x) => s + (x.resolvedAt.toDate().getTime() - x.createdAt.toDate().getTime()), 0) / r.length / 3600000);
}
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

export default function StudentAnalytics({ roomScore, view = 'complaints' }) {
  const { userDoc } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  // Modals state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [reopenReason, setReopenReason] = useState('');

  // Fetch real complaints for this room
  useEffect(() => {
    let isMounted = true;
    const fetchComplaints = async () => {
      if (!userDoc?.roomId) return;
      try {
        const q = query(
          collection(db, 'complaints'),
          where('roomId', '==', userDoc.roomId)
        );
        const snap = await getDocs(q);
        if (isMounted) {
          const comp = snap.docs.map(d => {
            const dt = d.data();
            // Feature 8: Security - ensure internalNotes is stripped on client side just in case
            delete dt.internalNotes;
            return { id: d.id, ...dt };
          }).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
          setData(comp);
        }
      } catch (err) {
        console.error("Error fetching complaints:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchComplaints();
    return () => { isMounted = false; };
  }, [userDoc?.roomId, showWithdrawModal, showReopenModal]);

  const score = roomScore ?? 100;
  const avg = useMemo(() => myAvg(data), [data]);
  const cats = useMemo(() => catBreak(data), [data]);
  const hist = useMemo(() => scoreHist(data, score), [data, score]);
  const open = data.filter(c => c.status !== 'resolved');
  const resolved = data.filter(c => c.status === 'resolved');
  const overdue = data.filter(isOverdue);
  const hostelAvg = 24;

  const sc = score >= 71 ? '#22D3A0' : score >= 41 ? '#F5A623' : '#F06565';
  const resComp = avg != null && hostelAvg != null ? [{ name: 'Mine', hours: avg, fill: '#4FA3F7' }, { name: 'Hostel', hours: hostelAvg, fill: '#7C6EFA' }] : [];

  const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.75rem' };
  const label = { fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' };

  // Feature 10: Filtering
  const filteredComplaints = data.filter(c => {
    const matchesSearch = !searchQuery
      || c.title?.toLowerCase().includes(searchQuery.toLowerCase())
      || c.description?.toLowerCase().includes(searchQuery.toLowerCase())
      || c.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchesCategory = filterCategory === 'all' || c.category === filterCategory;
    const matchesPriority = filterPriority === 'all' || c.priority === filterPriority;
    return matchesSearch && matchesStatus && matchesCategory && matchesPriority;
  });

  if (view === 'analytics') {
    // Student KPIs
    const studentKpis = [
      { label: 'Total filed',   value: data.length,    accent: '#6C63FF', spark: [1,2,1,3,2,4,data.length] },
      { label: 'Open',          value: open.length,    accent: '#EF4444', spark: [0,1,1,2,1,2,open.length] },
      { label: 'Resolved',      value: resolved.length,accent: '#10B981', spark: [0,0,1,1,2,2,resolved.length] },
      { label: 'Overdue',       value: overdue.length, accent: '#F59E0B', spark: [0,0,0,1,0,1,overdue.length] },
      { label: 'Avg fix time',  value: avg!=null?`${avg}h`:'—', accent: '#3B82F6', spark: [8,6,7,5,6,4,avg||0] },
    ];

    const displayScore = Math.max(0, Math.min(100, score));
    const scoreColor = displayScore>=70?'var(--green)':displayScore>=40?'var(--amber)':'var(--red)';
    const scoreLabel = displayScore>=80?'Excellent':displayScore>=60?'Good':displayScore>=40?'Fair':displayScore>=20?'Poor':'Critical';

    return (
      <div style={{display:'flex',flexDirection:'column',gap:20,paddingBottom:24}}>

        {/* KPI strip */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:12}}>
          {studentKpis.map((k,i)=>(
            <div key={i} style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,padding:'14px 16px',position:'relative',overflow:'hidden',transition:'box-shadow 0.2s'}}
              onMouseOver={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.2)'}
              onMouseOut={e=>e.currentTarget.style.boxShadow='none'}
            >
              <div style={{height:3,background:k.accent,position:'absolute',top:0,left:0,right:0,borderRadius:'14px 14px 0 0'}}/>
              <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.09em',color:'var(--text-3)',marginBottom:6,marginTop:4}}>{k.label}</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:28,fontWeight:500,color:'var(--text)',lineHeight:1}}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Charts + Score */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 200px',gap:16}}>

          {/* Score history */}
          <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden'}}>
            <div style={{height:2,background:scoreColor}}/>
            <div style={{padding:'14px 16px 0'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:12}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:scoreColor}}/>
                <span style={{fontSize:12.5,fontWeight:600,color:'var(--text)'}}>Room score — 30 days</span>
              </div>
            </div>
            <div style={{padding:'0 16px 16px'}}>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={hist} margin={{top:4,right:4,bottom:0,left:-20}}>
                  <defs>
                    <linearGradient id="sGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={scoreColor} stopOpacity={0.35}/>
                      <stop offset="95%" stopColor={scoreColor} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                  <XAxis dataKey="date" tick={{fill:'#475569',fontSize:9}} axisLine={false} tickLine={false} interval={6}/>
                  <YAxis domain={[0,100]} tick={{fill:'#475569',fontSize:9}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)',fontSize:11}} cursor={{stroke:'rgba(255,255,255,0.06)'}}/>
                  <Area type="monotone" dataKey="score" stroke={scoreColor} strokeWidth={2.5} fill="url(#sGrad)" dot={false} activeDot={{r:4}}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category breakdown */}
          <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden'}}>
            <div style={{height:2,background:'#3B82F6'}}/>
            <div style={{padding:'14px 16px 0'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:12}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:'#3B82F6'}}/>
                <span style={{fontSize:12.5,fontWeight:600,color:'var(--text)'}}>By category</span>
              </div>
            </div>
            <div style={{padding:'0 16px 16px',display:'flex',alignItems:'center',gap:12}}>
              {cats.length>0 ? (
                <>
                  <div style={{position:'relative',width:130,height:130,flexShrink:0}}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={cats} cx="50%" cy="50%" innerRadius="52%" outerRadius="74%" paddingAngle={2} dataKey="value">
                          {cats.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                        </Pie>
                        <Tooltip contentStyle={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)',fontSize:11}}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',pointerEvents:'none'}}>
                      <div style={{fontFamily:'var(--font-mono)',fontSize:20,fontWeight:500,color:'var(--text)'}}>{data.length}</div>
                      <div style={{fontSize:9,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em'}}>total</div>
                    </div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:6,flex:1}}>
                    {cats.map((c,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:6}}>
                        <div style={{width:7,height:7,borderRadius:2,background:CHART_COLORS[i%CHART_COLORS.length],flexShrink:0}}/>
                        <span style={{fontSize:11,color:'var(--text-2)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</span>
                        <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-3)'}}>{c.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <div style={{fontSize:13,color:'var(--text-3)',padding:'20px 0'}}>No data yet</div>}
            </div>
          </div>

          {/* Score circle */}
          <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,padding:'16px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,overflow:'hidden',position:'relative'}}>
            <div style={{height:3,background:scoreColor,position:'absolute',top:0,left:0,right:0,borderRadius:'14px 14px 0 0'}}/>
            <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.09em',color:'var(--text-3)',marginTop:6}}>Room health</div>
            <svg width="100" height="100" viewBox="0 0 100 100" style={{transform:'rotate(-90deg)'}}>
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--bg-input)" strokeWidth="10"/>
              <circle cx="50" cy="50" r="42" fill="none" stroke={scoreColor} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${displayScore*2.638} ${(100-displayScore)*2.638}`}
                style={{transition:'stroke-dasharray 0.6s ease'}}
              />
            </svg>
            <div style={{marginTop:-80,fontFamily:'var(--font-mono)',fontSize:28,fontWeight:500,color:scoreColor,lineHeight:1,textAlign:'center'}}>
              {displayScore}
            </div>
            <div style={{marginTop:48,fontSize:12,fontWeight:600,color:scoreColor}}>{scoreLabel}</div>
            <div style={{fontSize:10,color:'var(--text-3)',textAlign:'center',lineHeight:1.4}}>out of 100</div>
          </div>
        </div>
      </div>
    );
  }

  // view === 'complaints'
  const categoryConfig = {
    Electrical: { icon: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>, color: '#6C63FF', bg: 'rgba(108,99,255,0.08)' },
    Plumbing:   { icon: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>, color: '#06B6D4', bg: 'rgba(6,182,212,0.08)' },
    Furniture:  { icon: <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 1 4 0"/></>, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
    Cleaning:   { icon: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></>, color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
    Internet:   { icon: <><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></>, color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
    Other:      { icon: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>, color: '#64748B', bg: 'rgba(100,116,139,0.08)' },
  };

  const groupByDate = (items) => {
    const groups = {};
    const active = items.filter(c => c.status !== 'resolved');
    const resolved = items.filter(c => c.status === 'resolved');
    
    active.forEach(c => {
      const d = c.createdAt?.toDate?.();
      if (!d) return;
      const now = new Date();
      const diff = Math.floor((now - d) / 86400000);
      const label = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
      if (!groups[label]) groups[label] = [];
      groups[label].push(c);
    });
    if (resolved.length) groups['Resolved'] = resolved;
    return groups;
  };

  const grouped = groupByDate(filteredComplaints);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* Search & Filters */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ position:'relative' }}>
          <svg style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', width:16, height:16, color:'var(--text-3)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            className="input"
            style={{ paddingLeft:40, borderRadius:16, background:'var(--bg-card)', border:'1px solid var(--border)' }}
            placeholder="Search my complaints…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
          {[['all','All'],['todo','To Do'],['in_progress','In Progress'],['resolved','Resolved']].map(([v,l]) => (
            <button key={v} onClick={() => setFilterStatus(v)}
              style={{ fontSize:12, padding:'5px 14px', borderRadius:20, border:'1px solid', cursor:'pointer', transition:'all 0.15s', fontFamily:'var(--font)',
                background: filterStatus===v ? 'var(--primary)' : 'transparent',
                color: filterStatus===v ? '#fff' : 'var(--text-2)',
                borderColor: filterStatus===v ? 'var(--primary)' : 'var(--border-strong)'
              }}>{l}</button>
          ))}
          {['Plumbing','Electrical','Cleaning','Furniture','Other'].map(cat => (
            <button key={cat} onClick={() => setFilterCategory(filterCategory===cat?'all':cat)}
              style={{ fontSize:12, padding:'5px 14px', borderRadius:20, border:'1px solid', cursor:'pointer', transition:'all 0.15s', fontFamily:'var(--font)',
                background: filterCategory===cat ? 'var(--primary)' : 'transparent',
                color: filterCategory===cat ? '#fff' : 'var(--text-2)',
                borderColor: filterCategory===cat ? 'var(--primary)' : 'var(--border-strong)'
              }}>{cat}</button>
          ))}
        </div>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text-3)', fontSize:14 }}>
          No complaints found.
        </div>
      )}

      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, marginTop: date==='Today'?0:10 }}>
            <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-3)', whiteSpace:'nowrap', display: 'flex', alignItems: 'center', gap: 10 }}>
              {date}
              {date === 'Resolved' && items.length > 0 && (
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!window.confirm(`Delete all ${items.length} resolved tickets? This cannot be undone.`)) return;
                    const batch = writeBatch(db);
                    items.forEach(item => batch.delete(doc(db, 'complaints', item.id)));
                    await batch.commit();
                    setData(prev => prev.filter(p => p.status !== 'resolved'));
                  }}
                  style={{
                    padding: '2px 8px', borderRadius: 6, border: '1px solid var(--red-border)',
                    background: 'var(--red-soft)', color: 'var(--red)', fontSize: 9, 
                    fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase'
                  }}
                >
                  Clear All Resolved
                </button>
              )}
            </span>

            <div style={{ flex:1, height:1, background:'var(--border)', opacity:0.6 }} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:16 }}>
            {items.map((c) => {
              const sla = getSLAStatus(c);
              const isResolved = c.status === 'resolved';
              const conf = categoryConfig[c.category] || categoryConfig.Other;

              return (
                <div key={c.id} style={{
                  background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:20,
                  padding:'20px', position:'relative', overflow:'hidden',
                  opacity: isResolved ? 0.7 : 1, transition:'transform 0.2s, box-shadow 0.2s'
                }}
                  onMouseOver={e => { if(!isResolved) { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 8px 30px rgba(0,0,0,0.12)'; }}}
                  onMouseOut={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; }}
                >
                  {/* Decorative blobs */}
                  <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:conf.bg, filter:'blur(20px)', zIndex:0 }} />
                  <div style={{ position:'absolute', bottom:-40, left:-20, width:140, height:140, borderRadius:'50%', background:'var(--primary-soft)', opacity:0.1, filter:'blur(30px)', zIndex:0 }} />

                  <div style={{ position:'relative', zIndex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:38, height:38, borderRadius:'50%', background:conf.bg, display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${conf.color}33` }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={conf.color} strokeWidth="2.5">{conf.icon}</svg>
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{c.category}</div>
                          <div style={{ fontSize:11, color:'var(--text-3)', fontFamily:'var(--font-mono)' }}>{timeAgo(c.createdAt)} ago</div>
                        </div>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                        <span style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', padding:'3px 8px', borderRadius:20, background: PRI_C[c.priority]+'22', color:PRI_C[c.priority], border:`1px solid ${PRI_C[c.priority]}44` }}>
                          {c.priority}
                        </span>
                        <span style={{ fontSize:10, fontWeight:700, color:'var(--text-3)' }}>Room {c.roomNumber}</span>
                      </div>
                    </div>

                    <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:8, lineHeight:1.3 }}>{c.title}</div>
                    
                    <div style={{ background:'var(--bg-input)', borderRadius:12, padding:'10px 14px', marginBottom:14, fontSize:13, color:'var(--text-2)', lineHeight:1.6, border:'1px solid var(--border)' }}>
                      {c.descriptionTranslated || c.description}
                    </div>

                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        {!isResolved && sla && (
                          <div style={{ position:'relative', width:42, height:42 }}>
                            <svg width="42" height="42" viewBox="0 0 42 42" style={{ transform:'rotate(-90deg)' }}>
                              <circle cx="21" cy="21" r="18" fill="none" stroke="var(--border)" strokeWidth="4"/>
                              <circle cx="21" cy="21" r="18" fill="none" stroke={sla.breached ? 'var(--red)' : sla.critical ? 'var(--amber)' : 'var(--green)'} strokeWidth="4" strokeLinecap="round"
                                strokeDasharray={`${sla.percent * 1.13} 113`}
                                style={{ transition:'stroke-dasharray 0.5s ease' }}
                              />
                            </svg>
                            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, fontFamily:'var(--font-mono)', color:'var(--text)' }}>
                              {Math.round(sla.percent)}%
                            </div>
                          </div>
                        )}
                        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                          <span style={{ fontSize:12, fontWeight:600, color: ST_C[c.status] }}>{ST_L[c.status]}</span>
                          {c.acknowledgedAt && !isResolved && <span style={{ fontSize:10.5, color:'var(--green)', fontWeight:500 }}>✓ Acknowledged</span>}
                          {c.estimatedResolutionAt?.toDate && !isResolved && (
  <span style={{ fontSize: 10.5, color: 'var(--amber)', fontWeight: 500 }}>
    ETA: {c.estimatedResolutionAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
  </span>
)}
                        </div>
                      </div>

                      <div style={{ display:'flex', gap:6 }}>
                        {!isResolved && !c.withdrawnAt && (
                          <button onClick={() => { setSelectedComplaint(c); setShowWithdrawModal(true); }}
                            style={{ padding:'6px 12px', borderRadius:10, border:'1px solid var(--red)33', background:'var(--red)11', color:'var(--red)', fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}
                          >Withdraw</button>
                        )}
                        {isResolved && (c.reopenCount||0) < 2 && !c.withdrawnAt && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => { setSelectedComplaint(c); setShowReopenModal(true); }}
                              style={{ padding:'6px 12px', borderRadius:10, border:'1px solid var(--primary)33', background:'var(--primary)11', color:'var(--primary)', fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}
                            >Re-open</button>
                            <button onClick={async (e) => {
                              e.stopPropagation();
                              if (!window.confirm('Delete this resolved ticket?')) return;
                              await deleteDoc(doc(db, 'complaints', c.id));
                              setData(prev => prev.filter(p => p.id !== c.id));
                            }}
                              style={{ padding:'6px 12px', borderRadius:10, border:'1px solid var(--red)33', background:'var(--red)11', color:'var(--red)', fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}
                            >Delete</button>
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Modals - keep existing logic but update UI */}
      {showWithdrawModal && selectedComplaint && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:24, padding:24, width:'100%', maxWidth:400, boxShadow:'0 20px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize:18, fontWeight:700, color:'var(--text)', marginBottom:8 }}>Withdraw Complaint?</div>
            <div style={{ fontSize:13, color:'var(--text-3)', marginBottom:16 }}>Only withdraw if the issue has been resolved or is no longer relevant.</div>
            <textarea placeholder="Reason (optional)..." value={withdrawReason} onChange={e => setWithdrawReason(e.target.value)} rows={3}
              style={{ width:'100%', padding:12, borderRadius:12, background:'var(--bg-input)', border:'1px solid var(--border)', color:'var(--text)', fontSize:14, fontFamily:'var(--font)', resize:'none', marginBottom:16 }}
            />
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowWithdrawModal(false)} style={{ flex:1, padding:11, borderRadius:12, border:'1px solid var(--border)', background:'transparent', color:'var(--text-3)', fontWeight:600, cursor:'pointer' }}>Cancel</button>
              <button onClick={async () => {
                await updateDoc(doc(db, 'complaints', selectedComplaint.id), { withdrawnAt: Timestamp.now(), withdrawnReason: withdrawReason || 'No reason provided', status: 'resolved', resolvedAt: Timestamp.now() });
                const pts = selectedComplaint.priority === 'high' ? 30 : selectedComplaint.priority === 'medium' ? 15 : 5;
                const roomRef = doc(db, 'hostels', selectedComplaint.hostelId, 'blocks', selectedComplaint.blockId, 'buildings', selectedComplaint.buildingId, 'floors', selectedComplaint.floorId, 'rooms', selectedComplaint.roomId);
                await updateDoc(roomRef, { score: increment(pts) });
                setShowWithdrawModal(false); setWithdrawReason('');
              }} style={{ flex:1, padding:11, borderRadius:12, border:'none', background:'var(--red)', color:'#fff', fontWeight:600, cursor:'pointer' }}>Withdraw</button>
            </div>
          </div>
        </div>
      )}

      {showReopenModal && selectedComplaint && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:24, padding:24, width:'100%', maxWidth:400, boxShadow:'0 20px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize:18, fontWeight:700, color:'var(--text)', marginBottom:8 }}>Re-open Complaint?</div>
            <div style={{ fontSize:13, color:'var(--text-3)', marginBottom:16 }}>Please provide a reason. You can re-open a complaint up to 2 times.</div>
            <textarea placeholder="What's still wrong?..." value={reopenReason} onChange={e => setReopenReason(e.target.value)} rows={3}
              style={{ width:'100%', padding:12, borderRadius:12, background:'var(--bg-input)', border:'1px solid var(--border)', color:'var(--text)', fontSize:14, fontFamily:'var(--font)', resize:'none', marginBottom:16 }}
            />
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowReopenModal(false)} style={{ flex:1, padding:11, borderRadius:12, border:'1px solid var(--border)', background:'transparent', color:'var(--text-3)', fontWeight:600, cursor:'pointer' }}>Cancel</button>
              <button disabled={!reopenReason.trim()} onClick={async () => {
                if (!reopenReason.trim()) return;
                const pts = selectedComplaint.priority === 'high' ? 30 : selectedComplaint.priority === 'medium' ? 15 : 5;
                await updateDoc(doc(db, 'complaints', selectedComplaint.id), { status:'in_progress', reopenedAt: Timestamp.now(), reopenReason: reopenReason.trim(), reopenCount: increment(1), resolvedAt: null, estimatedResolutionAt: null });
                const roomRef = doc(db, 'hostels', selectedComplaint.hostelId, 'blocks', selectedComplaint.blockId, 'buildings', selectedComplaint.buildingId, 'floors', selectedComplaint.floorId, 'rooms', selectedComplaint.roomId);
                await updateDoc(roomRef, { score: increment(-pts) });
                setShowReopenModal(false); setReopenReason('');
              }} style={{ flex:1, padding:11, borderRadius:12, border:'none', background:'var(--primary)', color:'#fff', fontWeight:600, cursor:'pointer', opacity:reopenReason.trim()?1:0.5 }}>Re-open</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
