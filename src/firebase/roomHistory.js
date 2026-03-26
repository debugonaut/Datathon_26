import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from './config';

// Fetch all complaints ever filed for a specific room
// across ALL tenants, not just the current one
export const fetchRoomHistory = async (roomId) => {
  const q = query(
    collection(db, 'complaints'),
    where('roomId', '==', roomId)
  );
  const snap = await getDocs(q);
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // Client-side sort to avoid Firebase composite index requirement for demo
  return docs.sort((a, b) => {
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return timeB - timeA;
  });
};

// Generate AI summary of room history
export const generateRoomSummary = async (complaints) => {
  if (!complaints.length) return null;
  const summary = {
    total: complaints.length,
    resolved: complaints.filter(c => c.status === 'resolved').length,
    categories: {},
    avgResolutionHours: null,
    reopened: complaints.filter(c => c.reopenCount > 0).length,
  };
  complaints.forEach(c => {
    summary.categories[c.category] = (summary.categories[c.category] || 0) + 1;
  });
  const resolved = complaints.filter(c => c.resolvedAt && c.createdAt);
  if (resolved.length) {
    const total = resolved.reduce((sum, c) =>
      sum + (c.resolvedAt.toDate() - c.createdAt.toDate()), 0);
    summary.avgResolutionHours = Math.round(total / resolved.length / 3600000);
  }
  const topCategory = Object.entries(summary.categories)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-client-side-api-key-allowed': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620', // Automatically corrects 'claude-sonnet-4-20250514' invalid model for fallback predictability
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Summarize this hostel room's maintenance history in 2 sentences max. Be factual and neutral. Do not mention tenant names or UIDs.

Total complaints: ${summary.total}
Resolved: ${summary.resolved}
Most common issue: ${topCategory}
Average resolution time: ${summary.avgResolutionHours ? summary.avgResolutionHours + ' hours' : 'unknown'}
Complaints re-opened: ${summary.reopened}

Write as if briefing a new tenant moving into this room.`
        }]
      })
    });
    if (!response.ok) {
      throw new Error(`Anthropic API Error: ${response.status}`);
    }
    const data = await response.json();
    return {
      ...summary,
      topCategory,
      aiSummary: data.content?.[0]?.text || null
    };
  } catch (err) {
    console.warn("AI generation for room history failed, falling back to basic stats.", err);
    return {
      ...summary,
      topCategory,
      aiSummary: null
    };
  }
};
