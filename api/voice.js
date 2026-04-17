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

  // Step 1: Safely search Shopify (won't crash if store has a password)
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
  } catch (e) {
    // Silently fail if Shopify is blocked
  }

  // Step 2: Ask Gemini with ALL the rules restored
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a friendly voice shopping assistant for Husan-e-Libaas.

AVAILABLE PRODUCTS FROM SEARCH:
 ${productContext}

RULES (Return ONLY valid JSON):
1. Keep replies under 15 words.
2. If user asks for trending/popular/hot products, return: {"reply":"Opening trending collection for you...","action":"navigate","url":"/collections/trending-products"}
3. If user asks for new arrivals/latest products, return: {"reply":"Check out our latest arrivals!","action":"navigate","url":"/collections/new-arrivals"}
4. If user asks for a specific product (like jeans, shoes, shirt) AND products are listed above, pick the best match. Return: {"reply":"I found [Product Name]!","action":"navigate","url":"[EXACT_URL_FROM_LIST]"}
5. If no products are found for their specific search, return: {"reply":"Sorry, I couldn't find that item.","action":null,"url":null}
6. If just saying hi or general chat, return: {"reply":"Your friendly reply here.","action":null,"url":null}

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
      // Ensure URL is absolute
      if (result.url && result.url.startsWith('/')) {
        result.url = `${SHOPIFY_URL}${result.url}`;
      }
    } catch (e) {
      result = { reply: aiResponse.replace(/[^a-zA-Z0-9\s!?.]/g, '').trim(), action: null, url: null };
    }
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return res.status(500).json({ 
      error: 'Service error',
      message: error.message 
    });
  }
}
