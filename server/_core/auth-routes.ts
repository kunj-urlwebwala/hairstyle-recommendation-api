import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { createHash, randomInt } from "crypto";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import * as db from "../db";
import type { User } from "../../database/schema";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { passwordResetEmailTemplate, sendEmail } from "./mailer";
import { hashPassword } from "./passwords";
import { authenticateCredentials, authenticateRequest, createSessionToken } from "./session";
import { consumeRateLimit } from "./rate-limit";

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(128),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(320),
});

const resetPasswordSchema = z.object({
  email: z.string().trim().email().max(320),
  otp: z.string().trim().regex(/^\d{6}$/),
  password: z.string().min(8).max(128),
});

function buildUserResponse(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    role: user.role,
    lastSignedIn: (user.lastSignedIn ?? new Date()).toISOString(),
  };
}

function startSession(req: Request, res: Response, user: User): Promise<string> {
  return createSessionToken(user).then((sessionToken) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    return sessionToken;
  });
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Please provide a name, a valid email, and a password of at least 8 characters.",
      });
      return;
    }

    try {
      const existing = await db.getUserByEmail(parsed.data.email);
      if (existing) {
        res.status(409).json({ error: "An account with this email already exists." });
        return;
      }

      const user = await db.createUser({
        email: parsed.data.email.toLowerCase(),
        name: parsed.data.name,
        passwordHash: await hashPassword(parsed.data.password),
        lastSignedIn: new Date(),
      });

      const sessionToken = await startSession(req, res, user);
      res.status(201).json({ sessionToken, user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] Register failed:", error);
      res.status(500).json({ error: "Could not create the account. Please try again." });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Please provide an email and password." });
      return;
    }

    try {
      const user = await authenticateCredentials(parsed.data.email, parsed.data.password);
      if (!user) {
        res.status(401).json({ error: "Incorrect email or password." });
        return;
      }

      const sessionToken = await startSession(req, res, user);
      res.json({ sessionToken, user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: "Login failed. Please try again." });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // Get current authenticated user - works with both cookie (web) and Bearer token (native).
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch {
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  const hashOtp = (email: string, otp: string) =>
    createHash("sha256").update(`${email.toLowerCase()}:${otp}`).digest("hex");

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Please provide a valid email address." });
      return;
    }

    // Throttle code requests per address so the endpoint cannot be abused.
    const throttle = consumeRateLimit(`forgot:${parsed.data.email.toLowerCase()}`, 3, 60 * 60 * 1000);
    if (!throttle.allowed) {
      res.status(429).json({
        error: `Too many reset requests. Please try again in ${throttle.retryAfterSeconds} seconds.`,
      });
      return;
    }

    try {
      const user = await db.getUserByEmail(parsed.data.email);
      if (user && ENV.resendApiKey) {
        const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
        await db.createPasswordResetOtp(user.email, hashOtp(user.email, otp), Date.now() + 10 * 60 * 1000);
        const template = passwordResetEmailTemplate(otp);
        await sendEmail(user.email, template.subject, template.html);
      }
      // Same response either way so accounts cannot be enumerated.
      res.json({
        success: true,
        ...(ENV.resendApiKey ? {} : { warning: "Email delivery is not configured on this server." }),
      });
    } catch (error) {
      console.error("[Auth] Forgot password failed:", error);
      res.status(500).json({ error: "Could not start the password reset. Please try again." });
    }
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Please provide your email, the 6-digit code, and a new password." });
      return;
    }

    try {
      const pending = await db.getPendingResetOtp(parsed.data.email);
      if (!pending) {
        res.status(400).json({ error: "This reset code has expired. Please request a new one." });
        return;
      }

      if (hashOtp(parsed.data.email, parsed.data.otp) !== pending.otpHash) {
        const attempts = await db.registerResetOtpAttempt(pending.id);
        if (attempts >= 5) await db.consumeResetOtp(pending.id);
        res.status(400).json({ error: "That code is not correct. Check the email and try again." });
        return;
      }

      const user = await db.getUserByEmail(parsed.data.email);
      if (!user) {
        res.status(400).json({ error: "No account matches this email." });
        return;
      }

      await db.updateUserPassword(user.id, await hashPassword(parsed.data.password));
      await db.consumeResetOtp(pending.id);
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Reset password failed:", error);
      res.status(500).json({ error: "Could not reset the password. Please try again." });
    }
  });
}
