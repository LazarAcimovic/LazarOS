/* ============================================================
   LazarOS — schema + seed (Microsoft SQL Server / T-SQL)
   Run this ONCE against your SQL Server (SSMS or sqlcmd).
   It creates the database, tables, indexes, and seed data.
   ============================================================ */

/* ---- 1. Create the database if it doesn't exist ---- */
IF DB_ID('LazarOS') IS NULL
    CREATE DATABASE LazarOS;
GO

USE LazarOS;
GO

/* ---- 2. Drop existing tables (safe re-run during dev) ---- */
IF OBJECT_ID('dbo.tasks', 'U')    IS NOT NULL DROP TABLE dbo.tasks;
IF OBJECT_ID('dbo.profiles', 'U') IS NOT NULL DROP TABLE dbo.profiles;
GO

/* ---- 3. profiles ---- */
CREATE TABLE profiles (
    id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    first_name  VARCHAR(100)     NOT NULL,
    last_name   VARCHAR(100)     NOT NULL,
    email       VARCHAR(255)     NOT NULL UNIQUE,
    password    VARCHAR(255)     NOT NULL,
    created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

/* ---- 4. tasks ---- */
CREATE TABLE tasks (
    id            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    user_id       UNIQUEIDENTIFIER NOT NULL,
    title         VARCHAR(255)     NOT NULL,
    description   VARCHAR(MAX)     NULL,
    due_date      DATE             NOT NULL,
    priority      VARCHAR(10)      NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high')),
    status        VARCHAR(10)      NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','completed')),
    is_deleted    BIT              NOT NULL DEFAULT 0,
    completed_at  DATETIME2        NULL,
    created_at    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_tasks_profiles FOREIGN KEY (user_id) REFERENCES profiles(id)
);
GO

/* ---- 5. Indexes ---- */
CREATE INDEX IX_tasks_user_id     ON tasks(user_id);
CREATE INDEX IX_tasks_due_date    ON tasks(due_date);
CREATE INDEX IX_tasks_status      ON tasks(status);
CREATE INDEX IX_tasks_user_active ON tasks(user_id, is_deleted, status, due_date);
GO

/* ============================================================
   6. SEED DATA
   Login: email=lazar@lazaros.dev  password=Password123!
   ============================================================ */
DECLARE @user_id UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
DECLARE @today DATE = CAST(GETDATE() AS DATE);

INSERT INTO profiles (id, first_name, last_name, email, password)
VALUES (
    @user_id,
    'Lazar',
    'Lazarevic',
    'lazar@lazaros.dev',
    '$2b$10$cxXcJsy8A2NQksG4ZqRVBeXwKmCP3qupWwKUx5VJIh2vshcJWKsxa'
);

INSERT INTO tasks (user_id, title, description, due_date, priority, status)
VALUES
/* ---- Today ---- */
(@user_id, 'Review Spring Security',         'Filters, JWT, method-level security',        DATEADD(DAY, 0, @today), 'high',   'pending'),
(@user_id, 'Work on thesis',                 'Write the architecture chapter',             DATEADD(DAY, 0, @today), 'high',   'pending'),
(@user_id, 'Review Java Streams',            'map / filter / collect / reduce',            DATEADD(DAY, 0, @today), 'medium', 'pending'),
(@user_id, 'Reply to recruiter email',       NULL,                                         DATEADD(DAY, 0, @today), 'medium', 'pending'),
(@user_id, 'Water the plants',               NULL,                                         DATEADD(DAY, 0, @today), 'low',    'pending'),

/* ---- Day +1 ---- */
(@user_id, 'Review React Server Components', 'RSC vs client components, data fetching',    DATEADD(DAY, 1, @today), 'high',   'pending'),
(@user_id, 'Apply to Company X',             'Tailor CV and cover letter',                 DATEADD(DAY, 1, @today), 'high',   'pending'),
(@user_id, 'Review Spring Boot notes 21-51', NULL,                                         DATEADD(DAY, 1, @today), 'medium', 'pending'),
(@user_id, 'Grocery shopping',               'Milk, eggs, coffee',                         DATEADD(DAY, 1, @today), 'low',    'pending'),
(@user_id, 'Gym leg day',                    NULL,                                         DATEADD(DAY, 1, @today), 'low',    'pending'),

/* ---- Day +2 ---- */
(@user_id, 'Apply to 3 jobs',                'Backend / full-stack roles',                 DATEADD(DAY, 2, @today), 'high',   'pending'),
(@user_id, 'Review Java Collections',        'List, Set, Map, complexity',                 DATEADD(DAY, 2, @today), 'medium', 'pending'),
(@user_id, 'Read Next.js documentation',     'App router + caching',                        DATEADD(DAY, 2, @today), 'medium', 'pending'),
(@user_id, 'Call the bank',                  NULL,                                         DATEADD(DAY, 2, @today), 'medium', 'pending'),
(@user_id, 'Plan weekend trip',              NULL,                                         DATEADD(DAY, 2, @today), 'low',    'pending'),

/* ---- Day +3 ---- */
(@user_id, 'Review Spring Boot notes 21-51', 'Second pass (spaced repetition)',            DATEADD(DAY, 3, @today), 'medium', 'pending'),
(@user_id, 'Refactor LazarOS backend',       'Split controllers, add validation',          DATEADD(DAY, 3, @today), 'high',   'pending'),
(@user_id, 'Review SQL indexing',            'Clustered vs non-clustered',                 DATEADD(DAY, 3, @today), 'medium', 'pending'),
(@user_id, 'Dentist appointment',            NULL,                                         DATEADD(DAY, 3, @today), 'high',   'pending'),
(@user_id, 'Backup laptop',                  NULL,                                         DATEADD(DAY, 3, @today), 'low',    'pending');
GO
