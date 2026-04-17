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

  try {
    const query = `
      query SearchProducts($searchTerm: String!) {
        products(first: 5, query: $searchTerm) {
          edges {
            node { title handle }
          }
        }
      }
    `;

    // 🔥 FIX: Changed from 2024-01 to 2024-10!
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

    const responseText = await shopifyRes.text();

    if (!shopifyRes.ok) {
      return res.status(200).json({ 
        reply: `Still blocked. Status ${shopifyRes.status}. Details: ${responseText}`, 
        action: null, 
        url: null 
      });
    }

    const shopifyData = JSON.parse(responseText);
    const products = shopifyData.data?.products?.edges || [];
    
    if (products.length === 0) {
      return res.status(200).json({ 
        reply: `No products found for "${message}".`, 
        action: null, 
        url: null 
      });
    }

    const foundProducts = products.map(p => p.node.title).join(', ');
    return res.status(200).json({ 
      reply: `Success! I found these items: ${foundProducts}`, 
      action: null, 
      url: null 
    });

  } catch (error) {
    return res.status(200).json({ 
      reply: `Vercel crashed. Error: ${error.message}`, 
      action: null, 
      url: null 
    });
  }
}
