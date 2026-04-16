export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { message } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'No message provided' });
  }

  try {
    // Call Google Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a friendly voice shopping assistant for Hush Puppies footwear store.

RULES:
1. Keep replies under 15 words. Be conversational.
2. If user asks for trending/popular/new products, respond with ONLY this JSON:
{"reply":"Opening trending collection for you...","action":"navigate","url":"/collections/trending-products"}
3. If user asks about new arrivals, respond with ONLY this JSON:
{"reply":"Check out our latest arrivals!","action":"navigate","url":"/collections/new-arrivals"}
4. Otherwise, just chat helpfully about shoes.

User said: ${message}`
            }]
          }],
          generationConfig: {
            responseMimeType: "application/json",
          }
        })
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini API error');
    }

    const aiResponse = data.candidates[0].content.parts[0].text;
    
    // Parse the JSON response
    const result = JSON.parse(aiResponse);
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('❌ Gemini Error:', error.message);
    
    return res.status(500).json({ 
      error: 'AI service error',
      message: error.message 
    });
  }
}
