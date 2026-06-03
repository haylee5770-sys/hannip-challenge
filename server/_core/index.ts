import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { dailyReminderHandler } from "../scheduledHandlers";
import { sdk } from "./sdk";
import * as db from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // Scheduled job callbacks — must precede vite/static fallthrough
  app.post("/api/scheduled/dailyReminder", dailyReminderHandler);

  // Admin DB health check endpoint
  app.get("/api/admin/db-health", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req).catch(() => null);
      if (!user || user.role !== "admin") return res.status(403).json({ error: "관리자만 접근 가능해요" });
      const seasons = await db.listSeasons();
      const active = await db.getActiveSeason();
      return res.json({ ok: true, seasonCount: seasons.length, activeSeasonId: active?.id ?? null });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  // Direct admin REST endpoint for season creation (bypass tRPC for debugging)
  app.post("/api/admin/create-season", async (req, res) => {
    try {
      console.log("[create-season] received body:", JSON.stringify(req.body));
      const user = await sdk.authenticateRequest(req).catch(() => null);
      console.log("[create-season] user:", user?.email, "role:", user?.role);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "관리자만 사용할 수 있어요" });
      }
      const { name, startDate, totalDays = 13 } = req.body;
      if (!name || !startDate) {
        return res.status(400).json({ error: "name, startDate 필수" });
      }
      const d = new Date(startDate + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + (totalDays - 1));
      const endDate = d.toISOString().slice(0, 10);
      const active = await db.getActiveSeason();
      if (active) await db.endSeason(active.id);
      const all = await db.listSeasons();
      const nextNumber = all.reduce((max: number, s: { seasonNumber?: number | null }) => Math.max(max, s.seasonNumber ?? 0), 0) + 1;
      console.log("[create-season] inserting seasonNumber=", nextNumber, "name=", name);
      const id = await db.createSeason({
        seasonNumber: nextNumber,
        totalDays,
        name,
        startDate,
        endDate,
        status: "active",
        createdByUserId: user.id,
      });
      console.log("[create-season] success, id=", id);
      return res.json({ ok: true, id, seasonNumber: nextNumber, endDate });
    } catch (e: any) {
      console.error("[create-season] ERROR:", e);
      return res.status(500).json({ error: e?.message ?? String(e) });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
