export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  // This will read out EXACTLY what Vercel sees
  const url = process.env.SHOPIFY_STORE_URL || "MISSING URL";
  const token = process.env.SHOPIFY_STOREFRONT_TOKEN || "MISSING TOKEN";

  return res.status(200).json({ 
    reply: `The URL in Vercel is: ${url}. The token starts with: ${token.substring(0, 5)}.`, 
    action: null, 
    url: null 
  });
}
