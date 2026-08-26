import type { CookieOptions, Request } from "express";

/**
 * Session cookie options.
 * Cross-site requests from the Expo web dev server need SameSite=None plus Secure,
 * so HTTPS proxies keep working; plain localhost falls back to lax/non-secure.
 */
export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure"> {
  const isLocal =
    req.hostname === "localhost" || req.hostname === "127.0.0.1" || req.hostname === "::1";

  if (isLocal) {
    return { httpOnly: true, path: "/", sameSite: "lax", secure: false };
  }

  const forwardedProto = req.headers["x-forwarded-proto"];
  const isSecureRequest =
    req.protocol === "https" ||
    (typeof forwardedProto === "string" && forwardedProto.split(",")[0].trim() === "https");

  return { httpOnly: true, path: "/", sameSite: "none", secure: isSecureRequest };
}
