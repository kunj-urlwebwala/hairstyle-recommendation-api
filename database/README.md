# Mirror Database

The API uses SQLite through Node's built-in `node:sqlite` module — no external
database server is required. The database file is created automatically on
first run (default `database/mirror.db`, override with `DATABASE_URL`), and the
schema below is applied at startup by `server/db.ts`.

## Tables

### users

Local email/password accounts.

| Column                                   | Type        | Notes                              |
| ---------------------------------------- | ----------- | ---------------------------------- |
| id                                       | INTEGER PK  | Auto-increment                     |
| email                                    | TEXT UNIQUE | Login identifier, stored lowercase |
| name                                     | TEXT NULL   | Display name                       |
| password_hash                            | TEXT        | scrypt hash (`scrypt:salt:digest`) |
| role                                     | TEXT        | `user` or `admin`                  |
| created_at / updated_at / last_signed_in | INTEGER     | Epoch milliseconds                 |

### consultations

One row per completed AI consultation, so history survives reloads.

| Column            | Type                  | Notes                                         |
| ----------------- | --------------------- | --------------------------------------------- |
| id                | TEXT PK               | `con_<12 hex>`                                |
| user_id           | INTEGER FK → users.id | Cascade delete                                |
| source_image_path | TEXT                  | Portrait path under `/uploads/consultations/` |
| requirements      | TEXT JSON             | Customer-stated preferences                   |
| analysis          | TEXT JSON             | `StyleAnalysis` payload shown to the customer |
| recommendations   | TEXT JSON             | Four `HairstyleRecommendation` entries        |
| analysis_model    | TEXT NULL             | Provider model that produced the analysis     |
| created_at        | INTEGER               | Epoch milliseconds                            |

### saved_looks

Previews the customer bookmarked from a consultation.

| Column            | Type                       | Notes                            |
| ----------------- | -------------------------- | -------------------------------- |
| id                | TEXT PK                    | `look_<16 hex>`                  |
| user_id           | INTEGER FK → users.id      | Cascade delete                   |
| consultation_id   | TEXT FK → consultations.id | Cascade delete                   |
| recommendation    | TEXT JSON                  | The saved style                  |
| preview_image_url | TEXT                       | `/uploads/generated/...` preview |
| created_at        | INTEGER                    | Epoch milliseconds               |

### password_reset_otps

Short-lived one-time codes for password resets (requires `RESEND_API_KEY`
to deliver the email).

| Column      | Type         | Notes                            |
| ----------- | ------------ | -------------------------------- |
| id          | INTEGER PK   | Auto-increment                   |
| email       | TEXT         | Requesting address               |
| otp_hash    | TEXT         | SHA-256 of the 6-digit code      |
| expires_at  | INTEGER      | Issued + 10 minutes              |
| attempts    | INTEGER      | Wrong-code attempts; capped at 5 |
| consumed_at | INTEGER NULL | Set when used or superseded      |
| created_at  | INTEGER      | Epoch milliseconds               |

## Backup / reset

The whole database lives in one file. To back up, copy `database/mirror.db`;
to start fresh, stop the API and delete it.
