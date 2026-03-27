export const analyzeComplaint = async ({ imageBase64, transcript, typedText }) => {
  const textInputs = [
    transcript && `Voice transcript: "${transcript}"`,
    typedText && `Typed description: "${typedText}"`
  ].filter(Boolean).join('\n');

  if (!textInputs && !imageBase64) return null;

  // 1. Local Fallback (Safety Net)
  const getLocalFallback = () => {
    const text = (transcript || typedText || '').toLowerCase();
    return {
      category: text.includes('fan') || text.includes('light') || text.includes('switch') || text.includes('board') ? 'Electrical' :
                text.includes('water') || text.includes('tap') || text.includes('leak') || text.includes('sink') ? 'Plumbing' :
                text.includes('clean') || text.includes('dirt') || text.includes('garbage') ? 'Cleaning' : 'Other',
      priority: text.includes('urgent') || text.includes('now') || text.includes('emergency') || text.includes('current') ? 'high' : 'medium',
      title: (transcript || typedText || 'New Complaint').substring(0, 30) + (transcript?.length > 30 ? '...' : ''),
      description: transcript || typedText || 'Reported via Voice.',
      detectedLanguage: 'Local Intelligence',
      confidence: 0.5
    };
  };

  // 2. Try Claude (Anthropic) - Primary
  const anthropicKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (anthropicKey && anthropicKey.length > 30 && !anthropicKey.includes('your_key')) {
    try {
      console.log('🤖 Attempting Claude analysis...');
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 512,
          messages: [{
            role: 'user',
            content: [
              ...(imageBase64 ? [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } }] : []),
              { type: 'text', text: `Hostel Maintenance Analysis. Return JSON ONLY. Input: ${textInputs}\nAllowed Categories: Plumbing, Electrical, Cleaning, Furniture, Other.\nAllowed Priorities: low, medium, high.\nJSON format: {category, priority, title, description(formal English), detectedLanguage}` }
            ]
          }]
        })
      });
      if (response.ok) {
        const data = await response.json();
        const text = data.content?.[0]?.text || '';
        const clean = text.replace(/```json|```/g, '').trim();
        return JSON.parse(clean);
      }
      console.warn('⚠️ Claude failed (likely credits or connection).');
    } catch (err) {
      console.warn('⚠️ Claude service error:', err);
    }
  }

  // 3. Try Gemini (Google) - Fallback
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (geminiKey && geminiKey.length > 20 && !geminiKey.includes('your_key')) {
    try {
      console.log('💎 Attempting Gemini fallback...');
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `Hostel Maintenance Analysis. Return JSON ONLY. Input: ${textInputs}\nAllowed Categories: Plumbing, Electrical, Cleaning, Furniture, Other.\nAllowed Priorities: low, medium, high.\nJSON format: {category, priority, title, description(formal English), detectedLanguage}` },
              ...(imageBase64 ? [{ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }] : [])
            ]
          }]
        })
      });
      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const clean = text.replace(/```json|```/g, '').trim();
        return JSON.parse(clean);
      }
      console.warn('⚠️ Gemini failed (likely key/region issue).');
    } catch (err) {
      console.warn('⚠️ Gemini service error:', err);
    }
  }

  // 4. Final Fallback
  console.warn('🚀 All AI providers failed. Using Local Intelligence.');
  return getLocalFallback();
};
