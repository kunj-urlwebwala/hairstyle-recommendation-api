import { z } from "zod";

import { COOKIE_NAME } from "../shared/const.js";
import {
  createConsultation,
  createTryOn,
  customerRequirementsSchema,
  imageMimeTypeSchema,
} from "./hairstyle-service";
import { persistConsultation } from "./api/v1-hairstyle-router";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

function publicOrigin(req: any) {
  const forwardedProtocol = typeof req.headers?.["x-forwarded-proto"] === "string" ? req.headers["x-forwarded-proto"].split(",")[0] : undefined;
  const forwardedHost = typeof req.headers?.["x-forwarded-host"] === "string" ? req.headers["x-forwarded-host"].split(",")[0] : undefined;
  const protocol = forwardedProtocol ?? req.protocol ?? "https";
  const host = forwardedHost ?? req.get?.("host");
  if (!host) throw new Error("Unable to resolve the API public origin.");
  return `${protocol}://${host}`;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  // Retained for the MVP tester. External integrations should use /api/v1/hairstyle/*.
  consultation: router({
    analyze: protectedProcedure
      .input(z.object({ imageBase64: z.string().min(100).max(14_000_000), mimeType: imageMimeTypeSchema, requirements: customerRequirementsSchema.optional() }))
      .mutation(async ({ ctx, input }) => {
        const consultation = await createConsultation({ ...input, publicOrigin: publicOrigin(ctx.req) });
        await persistConsultation(ctx.user.id, consultation);
        return consultation;
      }),
    tryOn: protectedProcedure
      .input(z.object({ sourceImageUrl: z.string().url(), mimeType: imageMimeTypeSchema, styleName: z.string().min(2).max(80), stylePrompt: z.string().min(10).max(900) }))
      .mutation(({ ctx, input }) => createTryOn({
        sourceImageUrl: input.sourceImageUrl,
        mimeType: input.mimeType,
        style: { name: input.styleName, prompt: input.stylePrompt },
        publicOrigin: publicOrigin(ctx.req),
      })),
  }),
});

export type AppRouter = typeof appRouter;
