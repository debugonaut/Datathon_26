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

const TT = { background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.75rem' };
const CHART_COLORS = ['#378ADD', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const PRI_C = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
const ST_C = { todo: '#ef4444', in_progress: '#f59e0b', resolved: '#10b981' };
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

  const sc = score >= 71 ? '#10b981' : score >= 41 ? '#f59e0b' : '#ef4444';
  const resComp = avg != null && hostelAvg != null ? [{ name: 'Mine', hours: avg, fill: '#378ADD' }, { name: 'Hostel', hours: hostelAvg, fill: '#8b5cf6' }] : [];

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.75rem' };
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0.25rem 0' }}>
      {/* Row 1: KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
        {[
          { l: 'Total Filed', v: data.length, c: '#378ADD' },
          { l: 'Open', v: open.length, c: '#ef4444' },
          { l: 'Resolved', v: resolved.length, c: '#10b981' },
          { l: 'Overdue', v: overdue.length, c: overdue.length > 0 ? '#ef4444' : '#10b981' },
          { l: 'Avg Res.', v: avg != null ? `${avg}h` : '—', c: '#f59e0b' },
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
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
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

          {/* Feature 10: Search and Filter Bar */}
          <div style={{ marginBottom: '16px', marginTop: '10px' }}>
            <input
              type="text"
              placeholder="Search complaints..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 14px', marginBottom: '10px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
            />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['all','todo','in_progress','resolved'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  padding: '4px 8px', borderRadius: '20px', fontSize: '0.70rem',
                  border: filterStatus === s ? '1px solid #378ADD' : '1px solid var(--border)',
                  background: filterStatus === s ? 'rgba(55,138,221,0.15)' : 'transparent',
                  color: filterStatus === s ? '#378ADD' : 'var(--text-muted)', cursor: 'pointer'
                }}>
                  {s === 'all' ? 'All' : s === 'todo' ? 'To Do'
                    : s === 'in_progress' ? 'In Progress' : 'Resolved'}
                </button>
              ))}
              <span style={{ color: 'var(--border)', alignSelf: 'center' }}>|</span>
              {['all','Plumbing','Electrical','Cleaning','Furniture','Other'].map(c => (
                <button key={c} onClick={() => setFilterCategory(c)} style={{
                  padding: '4px 8px', borderRadius: '20px', fontSize: '0.70rem',
                  border: filterCategory === c ? '1px solid #10b981' : '1px solid var(--border)',
                  background: filterCategory === c ? 'rgba(16,185,129,0.15)' : 'transparent',
                  color: filterCategory === c ? '#10b981' : 'var(--text-muted)', cursor: 'pointer'
                }}>
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
              <span style={{ color: 'var(--border)', alignSelf: 'center' }}>|</span>
              {['all','high','medium','low'].map(p => (
                <button key={p} onClick={() => setFilterPriority(p)} style={{
                  padding: '4px 8px', borderRadius: '20px', fontSize: '0.70rem',
                  border: filterPriority === p ? '1px solid #f59e0b' : '1px solid var(--border)',
                  background: filterPriority === p ? 'rgba(245,158,11,0.15)' : 'transparent',
                  color: filterPriority === p ? '#f59e0b' : 'var(--text-muted)', cursor: 'pointer'
                }}>
                  {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
              {(searchQuery || filterStatus !== 'all' || filterCategory !== 'all' || filterPriority !== 'all') && (
                <button
                  onClick={() => { setSearchQuery(''); setFilterStatus('all');
                    setFilterCategory('all'); setFilterPriority('all'); }}
                  style={{ padding: '4px 8px', borderRadius: '20px', fontSize: '0.70rem',
                    border: '1px solid rgba(239,68,68,0.3)',
                    background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                >Clear</button>
              )}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              {filteredComplaints.length === data.length
                ? `${data.length} complaint${data.length !== 1 ? 's' : ''}`
                : `${filteredComplaints.length} of ${data.length} complaints`}
            </div>
          </div>
          {filteredComplaints.length === 0 && data.length > 0 && (
            <div style={{ textAlign: 'center', padding: '2rem',
              color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No complaints match your filters.
              <button
                onClick={() => { setSearchQuery(''); setFilterStatus('all');
                  setFilterCategory('all'); setFilterPriority('all'); }}
                style={{ display: 'block', margin: '8px auto 0', background: 'none',
                  border: 'none', color: '#378ADD', cursor: 'pointer', fontSize: '0.85rem' }}
              >Clear all filters</button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', marginTop: '12px' }}>
            {filteredComplaints.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', paddingBottom: i < filteredComplaints.length - 1 ? '16px' : '0', position: 'relative' }}>
                {i < filteredComplaints.length - 1 && <div style={{ position: 'absolute', left: '7px', top: '18px', width: '2px', bottom: 0, background: 'var(--border)' }} />}
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, marginTop: '2px', background: ST_C[c.status], boxShadow: `0 0 6px ${ST_C[c.status]}66` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{c.title}</span>
                    <span style={{ fontSize: '0.7rem', padding: '1px 8px', borderRadius: '8px', background: `${PRI_C[c.priority]}22`, color: PRI_C[c.priority], fontWeight: 600 }}>{c.priority}</span>
                    {isOverdue(c) && <span style={{ fontSize: '0.7rem', padding: '1px 8px', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 600 }}>OVERDUE</span>}
                  </div>
                  

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '4px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{timeAgo(c.createdAt)} ago</span>
                      <span style={{ color: 'var(--border)' }}>|</span>
                      <span style={{ color: 'var(--text-muted)' }}>{ST_L[c.status]}</span>
                    </div>

                    {/* Acknowledgment & Expected Fix */}
                    {c.acknowledgedAt ? (
                      <span style={{ color: '#10b981', fontSize: '0.78rem' }}>✓ Warden has seen this</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Pending acknowledgement</span>
                    )}

                    {c.estimatedResolutionAt && c.status !== 'resolved' && (
                      <div style={{ marginTop: '2px', fontSize: '0.78rem',
                        color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🕐 Expected fix: {new Date(typeof c.estimatedResolutionAt?.toDate === 'function' ? c.estimatedResolutionAt.toDate() : c.estimatedResolutionAt)
                          .toLocaleString('en-IN', {
                            weekday: 'short', day: 'numeric', month: 'short',
                            hour: '2-digit', minute: '2-digit'
                          })}
                      </div>
                    )}
                    
                    {/* Withdraw / Re-open Action buttons */}
                    {c.status !== 'resolved' && c.withdrawnAt === null && (
                      <button
                        onClick={() => { setSelectedComplaint(c); setShowWithdrawModal(true); }}
                        style={{
                          marginTop: '4px', padding: '4px 12px', background: 'transparent',
                          border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px',
                          color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', width: 'fit-content'
                        }}
                      >
                        Withdraw complaint
                      </button>
                    )}

                    {c.status === 'resolved' && (c.reopenCount || 0) < 2 && c.withdrawnAt === null && (
                      <button
                        onClick={() => { setSelectedComplaint(c); setShowReopenModal(true); }}
                        style={{ marginTop: '4px', padding: '4px 12px', background: 'transparent',
                          border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px',
                          color: '#f59e0b', fontSize: '0.75rem', cursor: 'pointer', width: 'fit-content' }}
                      >
                        Issue not fixed? Re-open
                      </button>
                    )}

                  </div>

                  <div style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4, wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {c.descriptionTranslated || c.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Feature 7 Modal: Withdraw Complaint */}
      {showWithdrawModal && selectedComplaint && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: '12px',
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
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                  color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}
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
            background: 'var(--surface)', borderRadius: '12px',
            border: '1px solid var(--border)', padding: '1.5rem',
            width: '100%', maxWidth: '400px'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>Re-open this complaint?</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Please describe what is still wrong so the warden can follow up.
              {(selectedComplaint.reopenCount || 0) === 1 && (
                <span style={{ color: '#f59e0b', display: 'block', marginTop: '4px' }}>
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
                  background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
                  color: '#f59e0b', cursor: 'pointer', fontWeight: 600,
                  opacity: reopenReason.trim() ? 1 : 0.5 }}
              >Re-open</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
