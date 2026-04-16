import OpenAI from 'openai';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Check API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is missing!');
    return res.status(500).json({ 
      error: 'API key not configured',
      message: 'Add OPENAI_API_KEY in Vercel settings'
    });
  }

  const { message } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'No message provided' });
  }

  console.log('📩 Received message:', message);

  try {
    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });

    const systemPrompt = `You are a friendly voice shopping assistant for Hush Puppies footwear store.

RULES:
1. Keep replies under 15 words. Be conversational.
2. If user asks for trending/popular/new products, respond with:
{"reply":"Opening trending collection for you...","action":"navigate","url":"/collections/trending-products"}
3. If user asks about new arrivals:
{"reply":"Check out our latest arrivals!","action":"navigate","url":"/collections/new-arrivals"}
4. Otherwise, just chat helpfully.`;

    console.log('🤔 Calling OpenAI...');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      response_format: { type: "json_object" }
    });

    console.log('✅ OpenAI response:', response.choices[0].message.content);
    
    const result = JSON.parse(response.choices[0].message.content);
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('❌ OpenAI Error:', error.message);
    console.error('Full error:', error);
    
    return res.status(500).json({ 
      error: 'AI service error',
      message: error.message,
      type: error.type
    });
  }
}
