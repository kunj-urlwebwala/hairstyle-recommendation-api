-- Mirror AI Hairstyle MVP - review draft for the existing Laravel database owner.
-- This script is intentionally not part of the automatic Drizzle migration chain.
-- Confirm existing tenant/customer/stylist/appointment ID types before implementation.

CREATE TABLE ai_consultations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  customer_id VARCHAR(64) NOT NULL,
  salon_id VARCHAR(64) NULL,
  stylist_id VARCHAR(64) NULL,
  appointment_id VARCHAR(64) NULL,
  created_by_user_id VARCHAR(64) NULL,
  source_image_key VARCHAR(512) NOT NULL,
  source_image_mime VARCHAR(32) NOT NULL,
  request_requirements JSON NOT NULL,
  analysis_result JSON NULL,
  analysis_model VARCHAR(128) NULL,
  status ENUM('created', 'ready', 'retake_required', 'failed', 'expired') NOT NULL DEFAULT 'created',
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ai_consultations_customer (tenant_id, customer_id, created_at),
  INDEX idx_ai_consultations_appointment (appointment_id),
  INDEX idx_ai_consultations_expiry (expires_at)
);

CREATE TABLE ai_hairstyle_recommendations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  consultation_id CHAR(36) NOT NULL,
  rank_order TINYINT UNSIGNED NOT NULL,
  style_name VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  rationale TEXT NOT NULL,
  maintenance_level ENUM('low', 'medium', 'high') NOT NULL,
  texture_tag VARCHAR(64) NOT NULL,
  occasion_tag VARCHAR(64) NULL,
  hairstyle_prompt TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ai_recommendation_rank (consultation_id, rank_order),
  CONSTRAINT fk_ai_recommendations_consultation FOREIGN KEY (consultation_id) REFERENCES ai_consultations(id) ON DELETE CASCADE
);

CREATE TABLE ai_try_on_jobs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  consultation_id CHAR(36) NOT NULL,
  recommendation_id CHAR(36) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL,
  customer_id VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  status ENUM('queued', 'processing', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'queued',
  requested_model VARCHAR(128) NULL,
  resolved_model VARCHAR(128) NULL,
  error_code VARCHAR(64) NULL,
  error_message VARCHAR(512) NULL,
  queued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  INDEX idx_ai_try_on_status (status, queued_at),
  INDEX idx_ai_try_on_customer (tenant_id, customer_id, queued_at),
  UNIQUE KEY uq_ai_try_on_idempotency (tenant_id, idempotency_key),
  CONSTRAINT fk_ai_jobs_consultation FOREIGN KEY (consultation_id) REFERENCES ai_consultations(id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_jobs_recommendation FOREIGN KEY (recommendation_id) REFERENCES ai_hairstyle_recommendations(id) ON DELETE CASCADE
);

CREATE TABLE ai_generated_previews (
  id CHAR(36) NOT NULL PRIMARY KEY,
  try_on_job_id CHAR(36) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL,
  customer_id VARCHAR(64) NOT NULL,
  preview_image_key VARCHAR(512) NOT NULL,
  preview_image_mime VARCHAR(32) NOT NULL DEFAULT 'image/png',
  is_saved BOOLEAN NOT NULL DEFAULT FALSE,
  shared_with_stylist_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_previews_customer (tenant_id, customer_id, created_at),
  INDEX idx_ai_previews_expiry (expires_at),
  CONSTRAINT fk_ai_previews_job FOREIGN KEY (try_on_job_id) REFERENCES ai_try_on_jobs(id) ON DELETE CASCADE
);

CREATE TABLE ai_model_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  consultation_id CHAR(36) NULL,
  try_on_job_id CHAR(36) NULL,
  capability ENUM('analysis', 'image_edit') NOT NULL,
  provider_model VARCHAR(128) NOT NULL,
  attempt_order TINYINT UNSIGNED NOT NULL,
  status ENUM('succeeded', 'failed') NOT NULL,
  latency_ms INT UNSIGNED NULL,
  provider_request_id VARCHAR(128) NULL,
  error_code VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_attempts_consultation (consultation_id, created_at),
  INDEX idx_ai_attempts_job (try_on_job_id, created_at)
);
