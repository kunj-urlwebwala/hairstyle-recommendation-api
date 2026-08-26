import type { HairstyleRecommendation, StyleAnalysis } from "../shared/consultation";

/**
 * User and feature table row types.
 * The matching DDL lives in server/db.ts and is applied automatically on startup.
 */

export type UserRole = "user" | "admin";

export type User = {
  id: number;
  email: string;
  name: string | null;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

export type InsertUser = {
  email: string;
  name?: string | null;
  passwordHash: string;
  role?: UserRole;
  lastSignedIn?: Date;
};

/** One completed AI consultation, stored so results survive reloads. */
export type ConsultationRecord = {
  id: string;
  userId: number;
  /** Path of the stored portrait under /uploads/, e.g. /uploads/consultations/con_x.jpg */
  sourceImagePath: string;
  requirements: Record<string, unknown>;
  analysis: StyleAnalysis;
  recommendations: HairstyleRecommendation[];
  analysisModel: string | null;
  createdAt: Date;
};

export type InsertConsultationRecord = Omit<ConsultationRecord, "createdAt"> & {
  createdAt?: Date;
};

/** A preview the customer bookmarked from a consultation. */
export type SavedLook = {
  id: string;
  userId: number;
  consultationId: string;
  recommendation: HairstyleRecommendation;
  previewImageUrl: string;
  createdAt: Date;
};

export type InsertSavedLook = Omit<SavedLook, "userId" | "createdAt"> & {
  userId: number;
  createdAt?: Date;
};

// TODO: add more table definitions here as your product grows.
