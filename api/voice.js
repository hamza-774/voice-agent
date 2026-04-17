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

  const SHOPIFY_URL = 'https://husan-e-libaas.myshopify.com';
  let productContext = "No products found.";

  // Step 1: Safely ask Shopify for products (Isolated so it never crashes the app)
  try {
    const searchQuery = encodeURIComponent(message);
    const shopifyRes = await fetch(`${SHOPIFY_URL}/search/suggest.json?q=${searchQuery}&resources[type]=product&resources[limit]=5`);
    
    if (shopifyRes.ok) {
      const shopifyData = await shopifyRes.json();
      const products = shopifyData.resources?.results?.products || [];
      
      if (products.length > 0) {
        productContext = products.map(p => `Title: ${p.title}, URL: ${p.url}`).join('\n');
      }
    }
  } catch (shopifyError) {
    console.log('Shopify search skipped:', shopifyError.message);
    // If Shopify fails, we just continue with "No products found"
  }

  // Step 2: Ask Gemini to respond based on the products
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a voice shopping assistant.

AVAILABLE PRODUCTS:
 ${productContext}

RULES:
1. Keep replies under 20 words.
2. If the user wants a product AND products are listed, pick the best one. Return JSON: {"reply":"I found [Name] for you!","action":"navigate","url":"/products/slug-here"}
3. If no products are found, return JSON: {"reply":"Sorry, I couldn't find that.","action":null,"url":null}
4. If just chatting (no product request), return JSON: {"reply":"Your friendly reply.","action":null,"url":null}

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
    
    let result;
    try {
      result = JSON.parse(aiResponse);
      // Fix URL if Gemini only returned the path
      if (result.url && result.url.startsWith('/')) {
        result.url = `${SHOPIFY_URL}${result.url}`;
      }
    } catch (e) {
      result = { reply: aiResponse.replace(/[^a-zA-Z0-9\s!?.]/g, '').trim(), action: null, url: null };
    }
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('❌ Gemini Error:', error.message);
    return res.status(500).json({ 
      error: 'AI service error',
      message: error.message 
    });
  }
}
