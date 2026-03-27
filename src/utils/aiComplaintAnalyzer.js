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
      text: `You are an expert maintenance analyst for a university hostel. 
Analyze the following student complaint (which may be in English, Hindi, Marathi, or Hinglish/transliterated form).

${textInputs}

CRITICAL INSTRUCTIONS:
1. Respond ONLY in raw JSON with no markdown, no backticks, no explanation.
2. The "description" field MUST be a professional, formal English translation of the input. Avoid "Hinglish". Convert into standard technical English (e.g., "fan nahi chal raha" -> "The ceiling fan is non-functional").
3. The "title" should be a concise 4-8 word summary in English.
4. "detectedLanguage" should identify the input language (e.g., "Hindi", "Hinglish", "English", "Marathi").

JSON FORMAT:
{
  "category": "Plumbing|Electrical|Cleaning|Furniture|Other",
  "priority": "low|medium|high",
  "title": "Concise English title",
  "description": "Professional English description",
  "detectedLanguage": "string",
  "confidence": 0.0-1.0
}

Priority rules:
- high: total power failure, flooding/major leaks, security/fire risks, health hazards.
- medium: broken fixtures, appliance malfunction, water supply issues.
- low: cosmetic issues, minor cleanliness, furniture wear.`
    });
  }

  if (inputs.length === 0) return null;

  const key = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!key || key === 'your_key_here') {
    console.warn('Anthropic API key is missing or set to placeholder.');
    return null;
  }

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
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620', 
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
