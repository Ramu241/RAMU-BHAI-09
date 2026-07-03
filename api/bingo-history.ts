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
    
    // Support custom pageSize/pageNo if sent from client, default to standard pagination
    const requestBody = req.body && Object.keys(req.body).length > 0 
      ? req.body 
      : { pageSize: 12, pageNo: 1 };

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://bdgwinmy.cc",
        "Referer": "https://bdgwinmy.cc/"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      // Fallback to GET just in case the API accepts GET
      const getResponse = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      const getData = await getResponse.json();
      return res.status(200).json(getData);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error("Vercel Serverless Proxy Error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch bingo history" });
  }
}
