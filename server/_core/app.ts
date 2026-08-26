import "dotenv/config";
import express from "express";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "./auth-routes";
import { ENV } from "./env";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { createV1HairstyleRouter } from "../api/v1-hairstyle-router";

export function createApiServer() {
  const app = express();

  // In development, allow the test client origin. Production should configure an explicit origin allowlist.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    const isDevelopment = process.env.NODE_ENV !== "production";
    if (origin && (isDevelopment || configuredOrigins.includes(origin))) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // Uploaded portraits and generated previews live on local disk.
  app.use(
    "/uploads",
    express.static(path.resolve(ENV.storageDir), { maxAge: "30d", immutable: true }),
  );

  registerAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use("/api/v1", createV1HairstyleRouter());

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  return app;
}
