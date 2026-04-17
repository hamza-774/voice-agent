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
    const SHOPIFY_URL = 'https://husan-e-libaas.myshopify.com';
    
    // Step 1: Ask Shopify for products (100% Free, No API Token needed)
    const searchQuery = encodeURIComponent(message);
    const shopifyRes = await fetch(`${SHOPIFY_URL}/search/suggest.json?q=${searchQuery}&resources[type]=product&resources[limit]=5`);
    const shopifyData = await shopifyRes.json();
    
    // Extract product titles and URLs
    const products = shopifyData.resources?.results?.products || [];
    
    let productContext = "No products found.";
    if (products.length > 0) {
      productContext = products.map(p => `- ${p.title} (URL: ${p.url})`).join('\n');
    }

    // Step 2: Ask Gemini to pick the best product OR just chat
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a voice shopping assistant for Husan-e-Libaas.

AVAILABLE PRODUCTS FROM SHOPIFY SEARCH:
 ${productContext}

RULES:
1. Keep replies under 20 words.
2. If the user asks for a product/suggestion AND products are listed above, pick the BEST match.
   Respond with ONLY this JSON: {"reply":"I found [Product Name] for you!","action":"navigate","url":"${SHOPIFY_URL}[EXACT_URL_FROM_LIST]"}
3. If the user asks for a product BUT the list says "No products found", respond with ONLY this JSON:
   {"reply":"Sorry, I couldn't find that item.","action":null,"url":null}
4. If the user is just saying hi or making general chat (not looking for a product), respond with ONLY this JSON:
   {"reply":"Your friendly reply here","action":null,"url":null}

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
    
    // Safely parse JSON
    let result;
    try {
      result = JSON.parse(aiResponse);
      // Ensure the URL is absolute if Gemini messes up
      if (result.url && !result.url.startsWith('http')) {
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
