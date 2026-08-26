import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import type { Request } from "express";
import * as db from "../db";
import type { User } from "../../database/schema";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { ForbiddenError } from "../../shared/_core/errors";
import { ENV } from "./env";
import { verifyPassword } from "./passwords";

export type SessionPayload = {
  sub: number;
  email: string;
  name: string;
};

function getSessionSecret(): Uint8Array {
  if (!ENV.cookieSecret) {
    throw new Error("JWT_SECRET is not configured. Set it in your .env file.");
  }
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function createSessionToken(user: User, expiresInMs = ONE_YEAR_MS): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);

  return new SignJWT({ email: user.email, name: user.name ?? "" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user.id))
    .setIssuedAt(issuedAt)
    .setExpirationTime(expirationSeconds)
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), { algorithms: ["HS256"] });
    const claims = payload as Record<string, unknown>;
    const id = Number(claims.sub);
    const email = typeof claims.email === "string" ? claims.email : undefined;
    if (!Number.isInteger(id) || id <= 0 || !email) return null;

    return {
      sub: id,
      email,
      name: typeof claims.name === "string" ? claims.name : "",
    };
  } catch {
    return null;
  }
}

function readSessionCookie(req: Request): string | undefined {
  const parsed = parseCookieHeader(req.headers.cookie ?? "");
  return parsed[COOKIE_NAME];
}

/**
 * Resolve the authenticated user for a request.
 * Accepts the session cookie (web) or an Authorization: Bearer token (native clients).
 */
export async function authenticateRequest(req: Request): Promise<User> {
  const authHeader = req.headers.authorization;
  const bearer = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : undefined;

  const token = bearer ?? readSessionCookie(req);
  if (!token) throw ForbiddenError("Missing session");

  const session = await verifySessionToken(token);
  if (!session) throw ForbiddenError("Invalid session");

  const user = await db.getUserById(session.sub);
  if (!user) throw ForbiddenError("User not found");

  await db.touchLastSignedIn(user.id);
  return user;
}

export async function authenticateCredentials(
  email: string,
  password: string,
): Promise<User | null> {
  const user = await db.getUserByEmail(email);
  if (!user) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  await db.touchLastSignedIn(user.id);
  return user;
}
