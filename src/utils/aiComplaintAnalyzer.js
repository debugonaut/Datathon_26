export const analyzeComplaint = async ({ imageBase64, transcript, typedText }) => {
  const inputs = [];
  if (imageBase64) {
    inputs.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 }
    });
  }
  const textInputs = [
    transcript && `Voice transcript: "${transcript}"`,
    typedText && `Typed description: "${typedText}"`
  ].filter(Boolean).join('\n');
  if (textInputs) {
    inputs.push({
      type: 'text',
      text: `You are analyzing a hostel room maintenance complaint.\n${textInputs}\nRespond ONLY in raw JSON with no markdown, no backticks, no explanation:\n{\n  "category": "Plumbing|Electrical|Cleaning|Furniture|Other",\n  "priority": "low|medium|high",\n  "title": "max 8 words, specific and clear",\n  "description": "1-2 sentences, clean and professional",\n  "confidence": 0.0-1.0\n}\nPriority rules:\n- high: no electricity, flooding, security risk, health hazard\n- medium: broken fixtures, leaks, non-functional appliances\n- low: cosmetic issues, minor inconveniences`
    });
  }

  if (inputs.length === 0) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-client-side-api-key-allowed': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', 
        max_tokens: 256,
        messages: [{ role: 'user', content: inputs }]
      })
    });
    
    clearTimeout(timeoutId);
    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('AI Analysis timed out');
    } else {
      console.error('AI Analysis Error:', err);
    }
    return null;
  }
};
