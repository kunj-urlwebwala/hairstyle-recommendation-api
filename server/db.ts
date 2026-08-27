import { createRequire } from "module";
import { mkdirSync } from "fs";
import path from "path";
import type { DatabaseSync } from "node:sqlite";
import type {
  HairstyleRecommendation,
  StyleAnalysis,
} from "../shared/consultation";
import type {
  ConsultationRecord,
  InsertConsultationRecord,
  InsertSavedLook,
  InsertUser,
  SavedLook,
  User,
} from "../database/schema";

// Resolved at runtime so bundlers/test runners that predate node:sqlite
// do not try to transform the built-in module.
const require = createRequire(import.meta.url);
const { DatabaseSync: SqliteDatabase } =
  require("node:sqlite") as typeof import("node:sqlite");

// The SQLite file lives in ./database by default; create the folder up front.
const databasePath = (() => {
  const url = process.env.DATABASE_URL ?? "file:./database/mirror.db";
  const filePath = url.replace(/^file:/, "").replace("file://", "");
  mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  return path.resolve(filePath);
})();

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_signed_in INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS consultations (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_image_path TEXT NOT NULL,
  requirements TEXT NOT NULL,
  analysis TEXT NOT NULL,
  recommendations TEXT NOT NULL,
  analysis_model TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_looks (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consultation_id TEXT NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  recommendation TEXT NOT NULL,
  preview_image_url TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saved_looks_user ON saved_looks (user_id, created_at);

CREATE TABLE IF NOT EXISTS password_reset_otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reset_otps_email ON password_reset_otps (email, created_at);
`;

let _db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (!_db) {
    _db = new SqliteDatabase(databasePath);
    _db.exec(DDL);
  }
  return _db;
}

/** Close the SQLite handle. Used by graceful shutdown and tests. */
export async function closeDatabase(): Promise<void> {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: Number(row.id),
    email: String(row.email),
    name: row.name === null ? null : String(row.name),
    passwordHash: String(row.password_hash),
    role: row.role === "admin" ? "admin" : "user",
    createdAt: new Date(Number(row.created_at)),
    updatedAt: new Date(Number(row.updated_at)),
    lastSignedIn: new Date(Number(row.last_signed_in)),
  };
}

export async function createUser(user: InsertUser): Promise<User> {
  const db = getDb();
  const now = Date.now();

  const result = db
    .prepare(
      `INSERT INTO users (email, name, password_hash, role, created_at, updated_at, last_signed_in)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      user.email.toLowerCase(),
      user.name ?? null,
      user.passwordHash,
      user.role ?? "user",
      now,
      now,
      user.lastSignedIn?.getTime() ?? now,
    );

  const id = Number(result.lastInsertRowid);
  const created = await getUserById(id);
  if (!created) throw new Error(`Failed to load created user ${id}`);
  return created;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM users WHERE lower(email) = ? LIMIT 1")
    .get(email.toLowerCase());
  return row ? rowToUser(row as unknown as Record<string, unknown>) : undefined;
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE id = ? LIMIT 1").get(id);
  return row ? rowToUser(row as unknown as Record<string, unknown>) : undefined;
}

export async function touchLastSignedIn(id: number): Promise<void> {
  const db = getDb();
  db.prepare(
    "UPDATE users SET last_signed_in = ?, updated_at = ? WHERE id = ?",
  ).run(Date.now(), Date.now(), id);
}

function rowToConsultation(row: Record<string, unknown>): ConsultationRecord {
  return {
    id: String(row.id),
    userId: Number(row.user_id),
    sourceImagePath: String(row.source_image_path),
    requirements: JSON.parse(String(row.requirements)) as Record<
      string,
      unknown
    >,
    analysis: JSON.parse(String(row.analysis)) as StyleAnalysis,
    recommendations: JSON.parse(
      String(row.recommendations),
    ) as HairstyleRecommendation[],
    analysisModel:
      row.analysis_model === null ? null : String(row.analysis_model),
    createdAt: new Date(Number(row.created_at)),
  };
}

export async function createConsultationRecord(
  record: InsertConsultationRecord,
): Promise<ConsultationRecord> {
  const db = getDb();
  const createdAt = record.createdAt?.getTime() ?? Date.now();

  db.prepare(
    `INSERT INTO consultations (id, user_id, source_image_path, requirements, analysis, recommendations, analysis_model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    record.id,
    record.userId,
    record.sourceImagePath,
    JSON.stringify(record.requirements ?? {}),
    JSON.stringify(record.analysis),
    JSON.stringify(record.recommendations),
    record.analysisModel ?? null,
    createdAt,
  );

  const row = getDb()
    .prepare("SELECT * FROM consultations WHERE id = ? LIMIT 1")
    .get(record.id);
  if (!row) throw new Error(`Failed to load created consultation ${record.id}`);
  return rowToConsultation(row as unknown as Record<string, unknown>);
}

export async function listConsultationsByUser(
  userId: number,
  limit = 20,
): Promise<ConsultationRecord[]> {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM consultations WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    )
    .all(userId, limit);
  return rows.map((row) =>
    rowToConsultation(row as unknown as Record<string, unknown>),
  );
}

function rowToSavedLook(row: Record<string, unknown>): SavedLook {
  return {
    id: String(row.id),
    userId: Number(row.user_id),
    consultationId: String(row.consultation_id),
    recommendation: JSON.parse(
      String(row.recommendation),
    ) as HairstyleRecommendation,
    previewImageUrl: String(row.preview_image_url),
    createdAt: new Date(Number(row.created_at)),
  };
}

export async function createSavedLook(
  look: InsertSavedLook,
): Promise<SavedLook> {
  const db = getDb();
  const createdAt = look.createdAt?.getTime() ?? Date.now();

  db.prepare(
    `INSERT INTO saved_looks (id, user_id, consultation_id, recommendation, preview_image_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    look.id,
    look.userId,
    look.consultationId,
    JSON.stringify(look.recommendation),
    look.previewImageUrl,
    createdAt,
  );

  const row = getDb()
    .prepare("SELECT * FROM saved_looks WHERE id = ? LIMIT 1")
    .get(look.id);
  if (!row) throw new Error(`Failed to load created saved look ${look.id}`);
  return rowToSavedLook(row as unknown as Record<string, unknown>);
}

export async function listSavedLooksByUser(
  userId: number,
): Promise<SavedLook[]> {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM saved_looks WHERE user_id = ? ORDER BY created_at DESC",
    )
    .all(userId);
  return rows.map((row) =>
    rowToSavedLook(row as unknown as Record<string, unknown>),
  );
}

export async function deleteSavedLook(
  userId: number,
  id: string,
): Promise<boolean> {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM saved_looks WHERE user_id = ? AND id = ?")
    .run(userId, id);
  return Number(result.changes) > 0;
}

export async function createPasswordResetOtp(
  email: string,
  otpHash: string,
  expiresAtMs: number,
): Promise<void> {
  const db = getDb();
  const now = Date.now();

  // Invalidate any earlier pending codes for this address.
  db.prepare(
    "UPDATE password_reset_otps SET consumed_at = ? WHERE email = ? AND consumed_at IS NULL",
  ).run(now, email.toLowerCase());

  db.prepare(
    `INSERT INTO password_reset_otps (email, otp_hash, expires_at, attempts, created_at)
     VALUES (?, ?, ?, 0, ?)`,
  ).run(email.toLowerCase(), otpHash, expiresAtMs, now);
}

export type PendingResetOtp = {
  id: number;
  otpHash: string;
  expiresAt: number;
  attempts: number;
};

export async function getPendingResetOtp(
  email: string,
): Promise<PendingResetOtp | undefined> {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, otp_hash, expires_at, attempts FROM password_reset_otps
       WHERE email = ? AND consumed_at IS NULL AND expires_at > ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(email.toLowerCase(), Date.now());
  if (!row) return undefined;

  const record = row as unknown as Record<string, unknown>;
  return {
    id: Number(record.id),
    otpHash: String(record.otp_hash),
    expiresAt: Number(record.expires_at),
    attempts: Number(record.attempts),
  };
}

export async function registerResetOtpAttempt(id: number): Promise<number> {
  const db = getDb();
  db.prepare(
    "UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?",
  ).run(id);
  const row = db
    .prepare("SELECT attempts FROM password_reset_otps WHERE id = ?")
    .get(id);
  return Number(
    (row as unknown as Record<string, unknown> | undefined)?.attempts ?? 0,
  );
}

export async function consumeResetOtp(id: number): Promise<void> {
  const db = getDb();
  db.prepare("UPDATE password_reset_otps SET consumed_at = ? WHERE id = ?").run(
    Date.now(),
    id,
  );
}

export async function updateUserPassword(
  userId: number,
  passwordHash: string,
): Promise<void> {
  const db = getDb();
  db.prepare(
    "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
  ).run(passwordHash, Date.now(), userId);
}

// TODO: add feature queries here as your schema grows.
