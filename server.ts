import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // CORS Middleware
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,Content-Type,Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json());

  // Proxy API route to avoid CORS when fetching Bingo 1M history
  app.all("/api/bingo-history", async (req, res) => {
    try {
      const targetUrl = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json";
      
      const method = req.method === "POST" ? "POST" : "GET";
      const options: any = {
        method: method,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Origin": "https://bdgwinmy.cc",
          "Referer": "https://bdgwinmy.cc/"
        }
      };

      if (method === "POST") {
        options.headers["Content-Type"] = "application/json";
        options.body = req.body && Object.keys(req.body).length > 0 
          ? JSON.stringify(req.body) 
          : JSON.stringify({ pageSize: 12, pageNo: 1 });
      }

      let response = await fetch(targetUrl, options);

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
        return res.status(502).json({ error: "Invalid JSON from target" });
      }

      return res.json(data);
    } catch (error: any) {
      console.error("Error proxying bingo history:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch bingo history" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
