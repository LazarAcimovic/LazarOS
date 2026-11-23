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
-- ============================================================
INSERT INTO profiles (id, first_name, last_name, email, password)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Lazar',
    'Lazarevic',
    'lazar@lazaros.dev',
    '$2b$10$cxXcJsy8A2NQksG4ZqRVBeXwKmCP3qupWwKUx5VJIh2vshcJWKsxa'
);

INSERT INTO tasks (user_id, title, description, due_date, priority, status)
VALUES
/* ---- Today ---- */
('11111111-1111-1111-1111-111111111111', 'Review Spring Security',         'Filters, JWT, method-level security',        current_date + make_interval(days => 0), 'high',   'pending'),
('11111111-1111-1111-1111-111111111111', 'Work on thesis',                 'Write the architecture chapter',             current_date + make_interval(days => 0), 'high',   'pending'),
('11111111-1111-1111-1111-111111111111', 'Review Java Streams',            'map / filter / collect / reduce',            current_date + make_interval(days => 0), 'medium', 'pending'),
('11111111-1111-1111-1111-111111111111', 'Reply to recruiter email',       NULL,                                         current_date + make_interval(days => 0), 'medium', 'pending'),
('11111111-1111-1111-1111-111111111111', 'Water the plants',               NULL,                                         current_date + make_interval(days => 0), 'low',    'pending'),

/* ---- Day +1 ---- */
('11111111-1111-1111-1111-111111111111', 'Review React Server Components', 'RSC vs client components, data fetching',    current_date + make_interval(days => 1), 'high',   'pending'),
('11111111-1111-1111-1111-111111111111', 'Apply to Company X',             'Tailor CV and cover letter',                 current_date + make_interval(days => 1), 'high',   'pending'),
('11111111-1111-1111-1111-111111111111', 'Review Spring Boot notes 21-51', NULL,                                         current_date + make_interval(days => 1), 'medium', 'pending'),
('11111111-1111-1111-1111-111111111111', 'Grocery shopping',               'Milk, eggs, coffee',                         current_date + make_interval(days => 1), 'low',    'pending'),
('11111111-1111-1111-1111-111111111111', 'Gym leg day',                    NULL,                                         current_date + make_interval(days => 1), 'low',    'pending'),

/* ---- Day +2 ---- */
('11111111-1111-1111-1111-111111111111', 'Apply to 3 jobs',                'Backend / full-stack roles',                 current_date + make_interval(days => 2), 'high',   'pending'),
('11111111-1111-1111-1111-111111111111', 'Review Java Collections',        'List, Set, Map, complexity',                 current_date + make_interval(days => 2), 'medium', 'pending'),
('11111111-1111-1111-1111-111111111111', 'Read Next.js documentation',     'App router + caching',                        current_date + make_interval(days => 2), 'medium', 'pending'),
('11111111-1111-1111-1111-111111111111', 'Call the bank',                  NULL,                                         current_date + make_interval(days => 2), 'medium', 'pending'),
('11111111-1111-1111-1111-111111111111', 'Plan weekend trip',              NULL,                                         current_date + make_interval(days => 2), 'low',    'pending'),

/* ---- Day +3 ---- */
('11111111-1111-1111-1111-111111111111', 'Review Spring Boot notes 21-51', 'Second pass (spaced repetition)',            current_date + make_interval(days => 3), 'medium', 'pending'),
('11111111-1111-1111-1111-111111111111', 'Refactor LazarOS backend',       'Split controllers, add validation',          current_date + make_interval(days => 3), 'high',   'pending'),
('11111111-1111-1111-1111-111111111111', 'Review SQL indexing',            'Clustered vs non-clustered',                 current_date + make_interval(days => 3), 'medium', 'pending'),
('11111111-1111-1111-1111-111111111111', 'Dentist appointment',            NULL,                                         current_date + make_interval(days => 3), 'high',   'pending'),
('11111111-1111-1111-1111-111111111111', 'Backup laptop',                  NULL,                                         current_date + make_interval(days => 3), 'low',    'pending');
