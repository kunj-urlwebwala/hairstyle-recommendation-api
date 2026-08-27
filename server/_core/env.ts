export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "file:./database/mirror.db",
  isProduction: process.env.NODE_ENV === "production",

  // AI providers. At least one key is required for consultations and try-ons.
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",

  // Text analysis models, tried in order until one responds.
  analysisPrimaryModel:
    process.env.AI_ANALYSIS_PRIMARY_MODEL ?? "gemini-3.6-flash",
  analysisFallbackModel:
    process.env.AI_ANALYSIS_FALLBACK_MODEL ?? "gpt-4o-mini",

  // Virtual try-on image models, tried in order until one responds.
  tryOnPrimaryImageModel:
    process.env.AI_TRYON_PRIMARY_IMAGE_MODEL ?? "gemini-3.1-flash-image",
  tryOnFallbackImageModel:
    process.env.AI_TRYON_FALLBACK_IMAGE_MODEL ?? "gpt-image-1",
  tryOnImageQuality: process.env.AI_TRYON_IMAGE_QUALITY ?? "medium",

  // Uploaded portraits and generated previews are written here.
  storageDir: process.env.STORAGE_DIR ?? "./storage/uploads",

  // Optional transactional email (password resets). Uses Resend when configured.
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  mailFrom: process.env.MAIL_FROM ?? "Mirror <onboarding@resend.dev>",
};
