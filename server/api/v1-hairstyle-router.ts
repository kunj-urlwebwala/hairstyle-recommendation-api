import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";

import type { User } from "../../database/schema";
import {
  ApiError,
  createConsultation,
  createTryOn,
  customerRequirementsSchema,
  imageMimeTypeSchema,
} from "../hairstyle-service";
import * as db from "../db";
import { checkConsultationRateLimit, checkTryOnRateLimit } from "../_core/rate-limit";

const consultationRequestSchema = z.object({
  image: z.object({
    base64: z.string().min(100).max(14_000_000),
    mimeType: imageMimeTypeSchema,
  }),
  requirements: customerRequirementsSchema.optional(),
});

const tryOnRequestSchema = z.object({
  sourceImageUrl: z.string().url(),
  mimeType: imageMimeTypeSchema,
  style: z.object({
    id: z.string().trim().max(100).optional(),
    name: z.string().trim().min(2).max(80),
    prompt: z.string().trim().min(10).max(900),
  }),
});

const savedLookRequestSchema = z.object({
  consultationId: z.string().trim().regex(/^con_[a-z0-9]{12}$/),
  recommendation: z.object({
    id: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(300),
    whyItWorks: z.string().trim().max(300),
    maintenance: z.enum(["Low", "Medium", "High"]),
    texture: z.string().trim().max(60),
    tone: z.string().trim().max(60),
    prompt: z.string().trim().max(900),
  }),
  previewImageUrl: z.string().url(),
});

function requestId(req: Request) {
  return (req.headers["x-request-id"] as string | undefined) ?? `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function publicOrigin(req: Request) {
  const forwardedProtocol = req.header("x-forwarded-proto")?.split(",")[0];
  const forwardedHost = req.header("x-forwarded-host")?.split(",")[0];
  const protocol = forwardedProtocol ?? req.protocol ?? "https";
  const host = forwardedHost ?? req.get("host");
  if (!host) throw new ApiError(500, "INTERNAL_ERROR", "Unable to resolve the API public origin.");
  return `${protocol}://${host}`;
}

async function requireUser(req: Request): Promise<User> {
  const dummyEmail = "local@mirror.app";
  let user = await db.getUserByEmail(dummyEmail);
  if (!user) {
    user = await db.createUser({
      email: dummyEmail,
      name: "Local User",
      passwordHash: "dummy",
    });
  }
  return user;
}

function enforceRateLimit(res: Response, result: ReturnType<typeof checkConsultationRateLimit>) {
  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retryAfterSeconds));
    throw new ApiError(
      429,
      "RATE_LIMITED",
      `You have reached today's limit for this feature. Please try again in ${result.retryAfterSeconds} seconds.`,
    );
  }
}

function sendError(res: Response, id: string, error: unknown) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "The request body is invalid.", details: error.flatten(), requestId: id } });
  }
  if (error instanceof ApiError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message, requestId: id } });
  }
  console.error("[v1-hairstyle-router] unhandled error", error);
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred.", requestId: id } });
}

/** Store a finished consultation so the customer's history survives reloads. */
export async function persistConsultation(
  userId: number,
  consultation: Awaited<ReturnType<typeof createConsultation>>,
): Promise<void> {
  const parsed = new URL(consultation.sourceImageUrl);
  await db.createConsultationRecord({
    id: consultation.id,
    userId,
    sourceImagePath: parsed.pathname,
    requirements: consultation.requirements as Record<string, unknown>,
    analysis: consultation.analysis,
    recommendations: consultation.recommendations,
    analysisModel: consultation.analysisModel ?? null,
  });
}

function isInternalPreviewUrl(previewImageUrl: string, origin: string): boolean {
  try {
    const parsed = new URL(previewImageUrl);
    return parsed.origin === origin && parsed.pathname.startsWith("/uploads/generated/");
  } catch {
    return false;
  }
}

export function createV1HairstyleRouter() {
  const router = Router();

  router.use((req, res, next) => {
    const id = requestId(req);
    res.locals.requestId = id;
    res.header("X-Request-Id", id);
    next();
  });

  router.get("/health", (_req, res) => {
    res.json({ data: { status: "ok", service: "mirror-hairstyle-mvp" }, meta: { requestId: res.locals.requestId, apiVersion: "v1" } });
  });

  router.post("/hairstyle/consultations", async (req, res) => {
    const id = res.locals.requestId as string;
    try {
      const user = await requireUser(req);
      enforceRateLimit(res, checkConsultationRateLimit(user.id));

      const input = consultationRequestSchema.parse(req.body);
      const consultation = await createConsultation({
        imageBase64: input.image.base64,
        mimeType: input.image.mimeType,
        requirements: input.requirements,
        publicOrigin: publicOrigin(req),
      });
      await persistConsultation(user.id, consultation);

      return res.status(201).json({ data: { consultation }, meta: { requestId: id, apiVersion: "v1" } });
    } catch (error) {
      return sendError(res, id, error);
    }
  });

  router.post("/hairstyle/try-ons", async (req, res) => {
    const id = res.locals.requestId as string;
    try {
      const user = await requireUser(req);
      enforceRateLimit(res, checkTryOnRateLimit(user.id));

      const input = tryOnRequestSchema.parse(req.body);
      const tryOn = await createTryOn({ ...input, publicOrigin: publicOrigin(req) });
      return res.status(201).json({ data: { tryOn }, meta: { requestId: id, apiVersion: "v1" } });
    } catch (error) {
      return sendError(res, id, error);
    }
  });

  router.get("/hairstyle/saved-looks", async (req, res) => {
    const id = res.locals.requestId as string;
    try {
      const user = await requireUser(req);
      const looks = await db.listSavedLooksByUser(user.id);
      return res.json({
        data: {
          looks: looks.map((look) => ({
            id: look.id,
            consultationId: look.consultationId,
            recommendation: look.recommendation,
            previewImageUrl: look.previewImageUrl,
            createdAt: look.createdAt.toISOString(),
          })),
        },
        meta: { requestId: id, apiVersion: "v1" },
      });
    } catch (error) {
      return sendError(res, id, error);
    }
  });

  router.post("/hairstyle/saved-looks", async (req, res) => {
    const id = res.locals.requestId as string;
    try {
      const user = await requireUser(req);
      const input = savedLookRequestSchema.parse(req.body);

      const owned = (await db.listConsultationsByUser(user.id, 50)).some(
        (record) => record.id === input.consultationId,
      );
      if (!owned) {
        throw new ApiError(400, "UNKNOWN_CONSULTATION", "This look is not linked to one of your consultations.");
      }
      if (!isInternalPreviewUrl(input.previewImageUrl, publicOrigin(req))) {
        throw new ApiError(400, "INVALID_PREVIEW_URL", "Only previews generated by Mirror can be saved.");
      }

      const look = await db.createSavedLook({
        id: `look_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
        userId: user.id,
        consultationId: input.consultationId,
        recommendation: input.recommendation,
        previewImageUrl: input.previewImageUrl,
      });

      return res.status(201).json({
        data: {
          look: {
            id: look.id,
            consultationId: look.consultationId,
            recommendation: look.recommendation,
            previewImageUrl: look.previewImageUrl,
            createdAt: look.createdAt.toISOString(),
          },
        },
        meta: { requestId: id, apiVersion: "v1" },
      });
    } catch (error) {
      return sendError(res, id, error);
    }
  });

  router.delete("/hairstyle/saved-looks/:id", async (req, res) => {
    const id = res.locals.requestId as string;
    try {
      const user = await requireUser(req);
      const removed = await db.deleteSavedLook(user.id, req.params.id);
      if (!removed) {
        throw new ApiError(404, "SAVED_LOOK_NOT_FOUND", "That saved look no longer exists.");
      }
      return res.json({ data: { success: true }, meta: { requestId: id, apiVersion: "v1" } });
    } catch (error) {
      return sendError(res, id, error);
    }
  });

  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => sendError(res, res.locals.requestId ?? "req_unknown", error));
  return router;
}
