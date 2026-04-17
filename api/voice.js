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

  const SHOPIFY_URL = process.env.SHOPIFY_STORE_URL; 
  const SHOPIFY_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN;
  
  let productContext = "No products found.";

  // Step 1: Search Shopify for real products
  try {
    if (SHOPIFY_URL && SHOPIFY_TOKEN) {
      const query = `
        query SearchProducts($searchTerm: String!) {
          products(first: 5, query: $searchTerm) {
            edges {
              node {
                title
                handle
                onlineStoreUrl
              }
            }
          }
        }
      `;

      const shopifyRes = await fetch(`https://${SHOPIFY_URL}/api/2024-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': SHOPIFY_TOKEN,
        },
        body: JSON.stringify({ 
          query, 
          variables: { searchTerm: message } 
        })
      });

      if (shopifyRes.ok) {
        const shopifyData = await shopifyRes.json();
        const products = shopifyData.data?.products?.edges || [];
        
        if (products.length > 0) {
          productContext = products.map(p => {
            const url = p.node.onlineStoreUrl || `https://${SHOPIFY_URL}/products/${p.node.handle}`;
            return `Title: ${p.node.title}, URL: ${url}`;
          }).join('\n');
        }
      }
    }
  } catch (e) {
    // Silent fail
  }

  // Step 2: Ask Gemini to decide what to do
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a friendly voice shopping assistant.

AVAILABLE PRODUCTS FROM SHOPIFY:
 ${productContext}

RULES (Return ONLY valid JSON):
1. Keep replies under 15 words.
2. If user asks for trending/popular products, return: {"reply":"Opening trending collection!","action":"navigate","url":"/collections/trending-products"}
3. If user asks for new arrivals/latest, return: {"reply":"Check out new arrivals!","action":"navigate","url":"/collections/new-arrivals"}
4. If user asks to see general products (e.g., "show me products", "what do you sell"), return: {"reply":"Taking you to our catalog!","action":"navigate","url":"/collections/all"}
5. If user asks for a SPECIFIC item (like "knife", "nail lamp", "candle") AND products are listed above, pick the best match. Return: {"reply":"I found [Product Name]!","action":"navigate","url":"[EXACT_URL_FROM_LIST]"}
6. If no products are found for a specific search, return: {"reply":"Sorry, I couldn't find that item.","action":null,"url":null}
7. If just chatting (hi, hello), return: {"reply":"Your friendly reply.","action":null,"url":null}

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
      // Ensure URL is absolute so the widget can strip the domain later
      if (result.url && result.url.startsWith('/')) {
        result.url = `https://${SHOPIFY_URL}${result.url}`;
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
