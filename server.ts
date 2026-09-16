import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import { sql } from 'drizzle-orm';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API route for health
  app.get("/api/health", async (req, res) => {
    try {
      const result = await db.execute(sql`SELECT 1 as is_alive`);
      res.json({ status: "ok", postgres: result.rows[0].is_alive === 1 });
    } catch (e: any) {
      res.status(500).json({ status: "error", error: e.message });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
