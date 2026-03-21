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
import { collection, query, where, getDocs, doc, updateDoc, Timestamp, increment } from 'firebase/firestore';
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
  const nodeColors = {
    in_progress: { bg:'#FEF3C7', stroke:'#F59E0B', icon:'#D97706', line:'#F59E0B', top:'#F59E0B' },
    todo:        { bg:'#FEE2E2', stroke:'#EF4444', icon:'#DC2626', line:'#EF4444', top:'#EF4444' },
    resolved:    { bg:'#D1FAE5', stroke:'#10B981', icon:'#059669', line:'#10B981', top:'#10B981' },
  };

  const HexNode = ({ status }) => {
    const nc = nodeColors[status] || nodeColors.todo;
    const iconPath = status === 'resolved'
      ? <path d="M20 6 9 17l-5-5"/>
      : status === 'in_progress'
      ? <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      : <circle cx="12" cy="12" r="8"/>;

    return (
      <div style={{ position:'relative', width:44, height:44, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg style={{ position:'absolute', top:0, left:0 }} width="44" height="44" viewBox="0 0 44 44">
          <polygon points="22,2 40,12 40,32 22,42 4,32 4,12" fill={nc.bg} stroke={nc.stroke} strokeWidth="1.5"/>
        </svg>
        <svg style={{ position:'relative', zIndex:1 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={nc.icon} strokeWidth="2.5">
          {iconPath}
        </svg>
      </div>
    );
  };

  // Group by date
  const groupByDate = (items) => {
    const groups = {};
    items.forEach(c => {
      const d = c.createdAt?.toDate?.();
      if (!d) return;
      const now = new Date();
      const diff = Math.floor((now - d) / 86400000);
      const label = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
      if (!groups[label]) groups[label] = [];
      groups[label].push(c);
    });
    return groups;
  };

  const grouped = groupByDate(filteredComplaints);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Search + filters — keep existing filter logic */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ position:'relative' }}>
          <svg style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', width:14, height:14, color:'var(--text-3)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            className="input"
            style={{ paddingLeft:34 }}
            placeholder="Search complaints…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {[['all','All'],['todo','To Do'],['in_progress','In Progress'],['resolved','Resolved']].map(([v,l]) => (
            <button key={v} onClick={() => setFilterStatus(v)}
              style={{ fontSize:11.5, padding:'4px 11px', borderRadius:20, border:'1px solid', cursor:'pointer', transition:'all 0.15s', fontFamily:'var(--font)',
                background: filterStatus===v ? 'var(--primary)' : 'transparent',
                color: filterStatus===v ? '#fff' : 'var(--text-2)',
                borderColor: filterStatus===v ? 'var(--primary)' : 'var(--border-strong)'
              }}>{l}</button>
          ))}
          {['Plumbing','Electrical','Cleaning','Furniture','Other'].map(cat => (
            <button key={cat} onClick={() => setFilterCategory(filterCategory===cat?'all':cat)}
              style={{ fontSize:11.5, padding:'4px 11px', borderRadius:20, border:'1px solid', cursor:'pointer', transition:'all 0.15s', fontFamily:'var(--font)',
                background: filterCategory===cat ? 'var(--primary)' : 'transparent',
                color: filterCategory===cat ? '#fff' : 'var(--text-2)',
                borderColor: filterCategory===cat ? 'var(--primary)' : 'var(--border-strong)'
              }}>{cat}</button>
          ))}
        </div>
      </div>

      <div style={{ fontSize:13, color:'var(--text-2)', fontFamily:'var(--font-mono)' }}>
        {filteredComplaints.length} complaint{filteredComplaints.length !== 1 ? 's' : ''}
      </div>

      {/* Timeline grouped by date */}
      {Object.keys(grouped).length === 0 && (
        <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-3)', fontSize:13 }}>
          No complaints match your filter.
        </div>
      )}

      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          {/* Date separator */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-3)', whiteSpace:'nowrap' }}>{date}</span>
            <div style={{ flex:1, height:1, background:'var(--border)' }} />
          </div>

          {items.map((c, i) => {
            const nc = nodeColors[c.status] || nodeColors.todo;
            const sla = getSLAStatus(c);
            const isLast = i === items.length - 1;
            const resolved = c.status === 'resolved';

            return (
              <div key={c.id} style={{ display:'flex', gap:0, marginBottom:4 }}>
                {/* Spine */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:52, flexShrink:0 }}>
                  <HexNode status={c.status} />
                  {!isLast && <div style={{ width:2, flex:1, minHeight:16, margin:'3px 0', borderRadius:1, background:nc.line, opacity:0.2 }} />}
                </div>

                {/* Card */}
                <div style={{ flex:1, paddingBottom: isLast ? 24 : 24, paddingLeft:10 }}>
                  <div style={{
                    background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:14,
                    padding:'16px 18px', opacity: resolved ? 0.7 : 1,
                    transition:'box-shadow 0.15s, border-color 0.15s',
                    position:'relative', overflow:'hidden',
                  }}
                    onMouseOver={e => { e.currentTarget.style.boxShadow='0 3px 12px rgba(0,0,0,0.15)'; e.currentTarget.style.borderColor='var(--border-strong)'; }}
                    onMouseOut={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.borderColor='var(--border)'; }}
                  >
                    {/* Top accent bar */}
                    <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:nc.top, borderRadius:'14px 14px 0 0' }} />

                    {/* Title row */}
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', lineHeight:1.3 }}>{c.title}</div>
                      <div style={{ fontSize:11, color:'var(--text-3)', flexShrink:0, marginLeft:12, marginTop:2, fontFamily:'var(--font-mono)' }}>
                        {timeAgo(c.createdAt)}
                      </div>
                    </div>

                    {/* Description */}
                    <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.55, marginBottom:10 }}>
                      {c.descriptionTranslated || c.description}
                    </div>

                    {/* Pills */}
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:10 }}>
                      <span style={{ fontSize:11, fontWeight:500, padding:'3px 8px', borderRadius:4, ...chipStyle(c.status) }}>
                        {ST_L[c.status]}
                      </span>
                      <span style={{ fontSize:11, fontWeight:500, padding:'3px 8px', borderRadius:4, ...chipStyle(c.priority, 'priority') }}>
                        {c.priority}
                      </span>
                      <span style={{ fontSize:11, padding:'3px 8px', borderRadius:4, background:'var(--bg-input)', color:'var(--text-2)' }}>
                        {c.category}
                      </span>
                      {sla?.breached && (
                        <span style={{ fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:4, background:'rgba(220,38,38,0.12)', color:'var(--red)', border:'1px solid rgba(220,38,38,0.2)', display:'flex', alignItems:'center', gap:4 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          Timer breach
                        </span>
                      )}
                    </div>

                    {/* Footer */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:3, flex:1 }}>
                        {c.acknowledgedAt
                          ? <span style={{ fontSize:12, color:'var(--green)' }}>✓ Warden has seen this</span>
                          : <span style={{ fontSize:12, color:'var(--text-3)' }}>Pending warden acknowledgement</span>
                        }
                        {c.estimatedResolutionAt && c.status !== 'resolved' && (
                          <span style={{ fontSize:12, color:'var(--amber)', display:'flex', alignItems:'center', gap:4 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            Expected: {new Date(typeof c.estimatedResolutionAt?.toDate === 'function' ? c.estimatedResolutionAt.toDate() : c.estimatedResolutionAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                          </span>
                        )}
                        {sla && !sla.breached && c.status !== 'resolved' && (
                          <span style={{ fontSize:11, color:'var(--text-3)', fontFamily:'var(--font-mono)' }}>
                            {sla.label}
                          </span>
                        )}
                        {/* Timer bar */}
                        {sla && c.status !== 'resolved' && (
                          <div style={{ height:4, borderRadius:2, background:'var(--bg-input)', overflow:'hidden', width:140, marginTop:2 }}>
                            <div style={{
                              width:`${sla.percent}%`, height:'100%', borderRadius:2,
                              background: sla.percent >= 80 ? 'var(--red)' : sla.percent >= 50 ? 'var(--amber)' : 'var(--green)',
                              transition:'width 0.5s ease'
                            }} />
                          </div>
                        )}
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        {c.status !== 'resolved' && c.withdrawnAt === null && (
                          <button
                            onClick={() => { setSelectedComplaint(c); setShowWithdrawModal(true); }}
                            style={{ fontSize:12, padding:'5px 12px', borderRadius:7, border:'1px solid rgba(239,68,68,0.3)', background:'transparent', color:'var(--red)', cursor:'pointer', fontFamily:'var(--font)', fontWeight:500, transition:'background 0.12s' }}
                            onMouseOver={e => e.currentTarget.style.background='var(--red-soft)'}
                            onMouseOut={e => e.currentTarget.style.background='transparent'}
                          >Withdraw</button>
                        )}
                        {c.status === 'resolved' && (c.reopenCount||0) < 2 && c.withdrawnAt === null && (
                          <button
                            onClick={() => { setSelectedComplaint(c); setShowReopenModal(true); }}
                            style={{ fontSize:12, padding:'5px 12px', borderRadius:7, border:'1px solid rgba(59,130,246,0.3)', background:'transparent', color:'var(--blue)', cursor:'pointer', fontFamily:'var(--font)', fontWeight:500, transition:'background 0.12s' }}
                            onMouseOver={e => e.currentTarget.style.background='var(--blue-soft)'}
                            onMouseOut={e => e.currentTarget.style.background='transparent'}
                          >Issue not fixed? Re-open</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Feature 7 Modal: Withdraw Complaint */}
      {showWithdrawModal && selectedComplaint && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--bg-surface)', borderRadius: '12px',
            border: '1px solid var(--border)', padding: '1.5rem',
            width: '100%', maxWidth: '400px'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>Withdraw this complaint?</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Only withdraw if the issue has already been fixed or is no longer relevant.
            </div>
            <textarea
              placeholder="Brief reason (optional)"
              value={withdrawReason}
              onChange={e => setWithdrawReason(e.target.value)}
              rows={3}
              style={{
                width: '100%', padding: '8px 12px',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: '8px', color: 'var(--text-primary)',
                fontSize: '0.85rem', resize: 'none', marginBottom: '12px'
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowWithdrawModal(false); setWithdrawReason(''); }}
                style={{ padding: '6px 16px', borderRadius: '8px', background: 'transparent',
                  border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}
              >Cancel</button>
              <button
                onClick={async () => {
                  await updateDoc(doc(db, 'complaints', selectedComplaint.id), {
                    withdrawnAt: Timestamp.now(),
                    withdrawnReason: withdrawReason || 'No reason provided',
                    status: 'resolved', resolvedAt: Timestamp.now(),
                  });
                  const pts = selectedComplaint.priority === 'high' ? 30
                    : selectedComplaint.priority === 'medium' ? 15 : 5;
                  
                  const roomRef = doc(db, 'hostels', selectedComplaint.hostelId, 'blocks', selectedComplaint.blockId, 'buildings', selectedComplaint.buildingId, 'floors', selectedComplaint.floorId, 'rooms', selectedComplaint.roomId);
                  await updateDoc(roomRef, { score: increment(pts) });
                  setShowWithdrawModal(false); setWithdrawReason('');
                }}
                style={{ padding: '6px 16px', borderRadius: '8px',
                  background: 'rgba(240,101,101,0.15)', border: '1px solid rgba(240,101,101,0.4)',
                  color: '#F06565', cursor: 'pointer', fontWeight: 600 }}
              >Confirm Withdraw</button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 9 Modal: Re-open Complaint */}
      {showReopenModal && selectedComplaint && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--bg-surface)', borderRadius: '12px',
            border: '1px solid var(--border)', padding: '1.5rem',
            width: '100%', maxWidth: '400px'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>Re-open this complaint?</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Please describe what is still wrong so the warden can follow up.
              {(selectedComplaint.reopenCount || 0) === 1 && (
                <span style={{ color: '#F5A623', display: 'block', marginTop: '4px' }}>
                  Note: this complaint can only be re-opened once more after this.
                </span>
              )}
            </div>
            <textarea
              placeholder="What is still wrong? (required)"
              value={reopenReason}
              onChange={e => setReopenReason(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: '8px 12px',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: '8px', color: 'var(--text-primary)',
                fontSize: '0.85rem', resize: 'none', marginBottom: '12px' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowReopenModal(false); setReopenReason(''); }}
                style={{ padding: '6px 16px', borderRadius: '8px', background: 'transparent',
                  border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}
              >Cancel</button>
              <button
                disabled={!reopenReason.trim()}
                onClick={async () => {
                  if (!reopenReason.trim()) return;
                  const pts = selectedComplaint.priority === 'high' ? 30
                    : selectedComplaint.priority === 'medium' ? 15 : 5;
                  
                  await updateDoc(doc(db, 'complaints', selectedComplaint.id), {
                    status: 'in_progress', reopenedAt: Timestamp.now(),
                    reopenReason: reopenReason.trim(),
                    reopenCount: increment(1),
                    resolvedAt: null, estimatedResolutionAt: null,
                  });

                  const roomRef = doc(db, 'hostels', selectedComplaint.hostelId, 'blocks', selectedComplaint.blockId, 'buildings', selectedComplaint.buildingId, 'floors', selectedComplaint.floorId, 'rooms', selectedComplaint.roomId);
                  await updateDoc(roomRef, { score: increment(-pts) });
                  setShowReopenModal(false); setReopenReason('');
                }}
                style={{ padding: '6px 16px', borderRadius: '8px',
                  background: 'rgba(245,166,35,0.15)', border: '1px solid rgba(245,166,35,0.4)',
                  color: '#F5A623', cursor: 'pointer', fontWeight: 600,
                  opacity: reopenReason.trim() ? 1 : 0.5 }}
              >Re-open</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
