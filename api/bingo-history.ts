export default async function handler(req: any, res: any) {
  // Allow CORS from any origin for maximum compatibility
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    const targetUrl = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json";
    
    // We prefer GET for simple retrieval as it's highly cached, lightweight, and 100% supported
    const method = req.method === "POST" ? "POST" : "GET";
    const options: RequestInit = {
      method: method,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://bdgwinmy.cc",
        "Referer": "https://bdgwinmy.cc/"
      }
    };

    if (method === "POST") {
      options.headers = {
        ...options.headers,
        "Content-Type": "application/json"
      };
      options.body = req.body && Object.keys(req.body).length > 0 
        ? JSON.stringify(req.body) 
        : JSON.stringify({ pageSize: 12, pageNo: 1 });
    }

    let response = await fetch(targetUrl, options);

    // Fallback to GET if POST failed
    if (!response.ok && method === "POST") {
      response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json, text/plain, */*",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse response text as JSON:", text.substring(0, 100));
      throw new Error("Invalid JSON response from target");
    }

    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(data);
  } catch (error: any) {
    console.error("Vercel Serverless Proxy Error:", error);
    res.setHeader("Content-Type", "application/json");
    return res.status(500).json({ error: error.message || "Failed to fetch bingo history" });
  }
}
