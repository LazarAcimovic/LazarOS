-- ============================================================
--   LazarOS — schema + seed (PostgreSQL)
--   Run this ONCE against your database, e.g. from backend/:
--     psql "$DATABASE_URL" -f db/schema.sql
--   The database itself is created separately (createdb / CREATE DATABASE);
--   this script owns the tables, indexes and seed only (DB §5, D-016).
-- ============================================================

-- The whole script runs in UTC so DEFAULT now() stamps and the seed's current_date
-- anchoring match the backend's UTC time model (Tech-Backend §8).
SET TIME ZONE 'UTC';

-- ---- 1. Drop existing tables (safe re-run during dev) ----
-- tasks first: its foreign key references profiles.
DROP TABLE IF EXISTS tasks    CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ---- 2. profiles ----
CREATE TABLE profiles (
    id          uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name  varchar(100) NOT NULL,
    last_name   varchar(100) NOT NULL,
    email       varchar(255) NOT NULL UNIQUE,
    password    varchar(255) NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

-- ---- 3. tasks ----
CREATE TABLE tasks (
    id            uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       uuid         NOT NULL,
    title         varchar(255) NOT NULL,
    description   text         NULL,
    due_date      date         NOT NULL,
    priority      varchar(10)  NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high')),
    status        varchar(10)  NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','completed')),
    is_deleted    boolean      NOT NULL DEFAULT false,
    completed_at  timestamptz  NULL,
    created_at    timestamptz  NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    updated_at    timestamptz  NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    CONSTRAINT "FK_tasks_profiles" FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- ---- 4. Indexes ----
CREATE INDEX "IX_tasks_user_id"     ON tasks(user_id);
CREATE INDEX "IX_tasks_due_date"    ON tasks(due_date);
CREATE INDEX "IX_tasks_status"      ON tasks(status);
CREATE INDEX "IX_tasks_user_active" ON tasks(user_id, is_deleted, status, due_date);

-- ============================================================
--   5. SEED DATA
--   Login: email=lazar@lazaros.dev  password=Password123!
--   Ported to PostgreSQL in refactor-04 R04.5.
-- ============================================================
-- (seed inserted here by R04.5)
