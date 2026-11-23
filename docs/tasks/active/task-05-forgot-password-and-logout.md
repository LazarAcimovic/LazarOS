### Task 5 — Forgot password (via Resend) and logout

#### Overview

Today a forgotten password means a dead account (PRD §10) — there is no reset path and the system
sends no email (Decisions D-014). This task adds the reset flow and hardens logout. The flow: the
user clicks **Forgot password**, enters their email, the backend mints a short-lived single-use
token, **Resend** sends an email carrying `${APP_URL}/reset-password?token=…`, and that link opens
a page to set a new password; a **Resend** button re-requests the email under a cooldown. Logout
already clears the cookie (PRD §4.12) and is covered here only to pin and verify it.

Email is a **new external dependency**, so this task reverses the "no email / password reset"
stance: subtask 5.0 writes the new rules into PRD / DB / Tech / UI and supersedes the relevant
Decisions bullet. The reset-token store lands as a **Prisma model**, which is why this task depends
on `refactor-05`; tests are written first against the `refactor-03` suite (TDD).

**The rules for this task live in `PRD.md` §2, §4.14, §4.15, §6, §7, §10** (written in 5.0), plus
`DB.md` (reset-token model), `Tech-Backend.md` §3/§5 and a new email section, `Tech.md` §1/§3, and
`UI.md` §3. This file is only the plan — read the rules from those sections, never from this
Overview.

**Depends on:** refactor-05, refactor-03 · **Blocks:** nothing

---

#### 5.0 — Docs: Promote the forgot-password, reset and logout rules into the source docs

Rules: none (this subtask creates the rules' home)
Not in scope: any code change.
Docs to update: PRD §2 (accounts can now self-recover), PRD §4.14 (forgot-password request flow),
PRD §4.15 (reset-password flow), PRD §4.12 (logout — confirm it stays accurate), PRD §6 (token
length, token TTL, resend cooldown, daily send cap), PRD §7 (token hashed at rest, single-use,
expiry, enumeration-safe response), PRD §10 (remove "password reset" from out of scope); DB §2
(the `password_reset_tokens` model); Tech-Backend §3 (the two new public routes), Tech-Backend §5
(the new Zod schemas), a new Tech-Backend email section (Resend integration); Tech.md §1 (the
`resend` package), Tech.md §3 (`RESEND_API_KEY`, `MAIL_FROM`, `APP_URL`, token-TTL env); UI §3
(the forgot-password and reset-password screens, the resend button and its cooldown); Decisions
D-0NN (supersede the "no email / external systems" bullet of D-014 — choose Resend; record the
free-tier limits 3,000/month and 100/day that cap the resend cadence).
Verify: `node scripts/check-docs.mjs`

- [ ] PRD §4.14 and §4.15 describe the full flow; every number (token length, TTL, cooldown, daily
      cap) is written into PRD §6; the security rules are in PRD §7.
- [ ] DB §2 documents `password_reset_tokens`; Tech-Backend documents the routes, schemas and the
      Resend email section; Tech.md documents the package and env vars.
- [ ] A `docs/Decisions.md` entry supersedes the relevant D-014 bullet and records the Resend
      choice and free-tier limits; no §/path reference dangles.
- Commit: `docs: specify forgot-password, reset and the Resend email integration`

---

#### 5.1 — DevOps: Set up Resend and the email environment (your manual steps)

Rules: Tech-Backend §7, Tech.md §3
Not in scope: the endpoint logic (5.3). Committing any real key — only `.env.example` placeholders.
Docs to update: Tech.md §3 (the env table), the new Tech-Backend email section, backend
`.env.example`.
Verify: a one-off smoke send (a tiny script or a temporary route) sends a test email through Resend
and it arrives in your inbox; then remove the temporary route.

What you (Lazar) do on the Resend side — these are manual and cannot be scripted from here:

- [ ] Create a **Resend** account at resend.com. The free plan is **3,000 emails/month, 100/day** —
      record that in Tech.md §3 so the resend cooldown (5.3) stays under 100/day.
- [ ] **Sending identity — pick one:**
  - **Dev/testing:** use Resend's shared `onboarding@resend.dev` sender. It can only deliver to the
    email address of **your own Resend account**, which is fine for testing the flow against your
    own account's email.
  - **Real recipients:** add and **verify a domain** in Resend (add the DKIM/SPF DNS records Resend
    lists to your domain's DNS; verification can take a little while). Then send from an address at
    that domain.
- [ ] Create a Resend **API key** with send permission; put it in backend `.env` as
      `RESEND_API_KEY` and add a placeholder line to `.env.example` (never commit the real key).
- [ ] Set `MAIL_FROM` (the verified sender, e.g. `noreply@yourdomain` or `onboarding@resend.dev`)
      and `APP_URL` (the frontend base used to build the reset link) in `.env` and `.env.example`.
- [ ] Confirm the smoke send arrives; delete the temporary send route/script.
- Commit: `chore(backend): resend client and email environment`

---

#### 5.2 — Backend-migration: Add the `password_reset_tokens` Prisma model

Rules: DB §2, PRD §7
Not in scope: endpoint logic (5.3–5.4). Any change to `profiles` or `tasks`.
Docs to update: DB §2 (the model), Tech-Backend §1 if the Prisma schema layout is described.
Verify: `npx prisma migrate` applies cleanly; the table exists with the documented columns and
index; the refactor-03 migration assertion (schema check) passes.

- [ ] Model with `id` (uuid), `user_id` (FK → `profiles`, cascade on user delete not required —
      there is no profile delete), `token_hash` (indexed), `expires_at` (timestamptz), `used_at`
      (nullable timestamptz), `created_at` (timestamptz).
- [ ] The raw token is **never** stored — only its hash (PRD §7); a unique/index on `token_hash`
      supports lookup.
- [ ] `prisma migrate` creates the migration; DB.md matches the generated schema.
- Commit: `feat(db): password_reset_tokens model`

---

#### 5.3 — Backend-endpoint: `POST /api/auth/forgot-password`

Rules: PRD §4.14, PRD §6, PRD §7, Tech-Backend §3, Tech-Backend §5
Not in scope: the reset endpoint (5.4). Returning whether the email exists.
Docs to update: Tech-Backend §3 (the route) if the earlier doc omitted a detail.
Verify: integration test — an unknown email and a known email both return the **same** generic
`200`; a known email writes a token row and triggers the Resend call (mocked in tests); a second
request within the cooldown is rejected/no-op.

- [ ] Zod validates `{ email }`; the response is always a generic `200` ("if an account exists, a
      reset link has been sent") — never reveals existence (PRD §7, mirroring §4.2).
- [ ] On a real match: generate a cryptographically random token, store its hash + `expires_at`
      (TTL from PRD §6), and call Resend with the recipient, subject and a body containing
      `${APP_URL}/reset-password?token=<raw>`.
- [ ] A per-email cooldown (PRD §6) throttles the resend button and keeps sends under the Resend
      daily cap; a Resend API failure is handled without leaking existence.
- Commit: `feat(backend): forgot-password request endpoint`

---

#### 5.4 — Backend-endpoint: `POST /api/auth/reset-password`

Rules: PRD §4.15, PRD §6, PRD §7, Tech-Backend §3, Tech-Backend §5
Not in scope: the request endpoint (5.3).
Docs to update: Tech-Backend §3 (the route) if needed.
Verify: integration test — a valid, unexpired, unused token with a PRD §6-valid password returns
`200` and changes the password; an expired, already-used or unknown token → `400`; a weak password
→ `400`.

- [ ] Zod validates `{ token, password }`; the password meets the PRD §6 rules (8–20, one of each
      class).
- [ ] Look up by `token_hash`; reject when missing, `expires_at` passed, or `used_at` set.
- [ ] On success: bcrypt-hash (cost 10) and update the profile, set `used_at` (single-use), and
      invalidate the user's other outstanding tokens.
- Commit: `feat(backend): reset-password endpoint`

---

#### 5.5 — Backend-endpoint: Pin and harden logout

Rules: PRD §4.12, Tech-Backend §3, Tech-Backend §4
Not in scope: changing the cookie policy (D-004/D-007 are settled).
Docs to update: none (PRD §4.12 already describes it; confirm it is still accurate).
Verify: integration test — `POST /api/auth/logout` clears the `jwt` cookie (the clear matches the
set-cookie flags) and a subsequent protected request returns `401`.

- [ ] `res.clearCookie("jwt")` clears with flags matching how it was set, so browsers drop it.
- [ ] A test pins "logout then protected request → 401".
- Commit: `test(backend): pin logout behaviour`

---

#### 5.6 — Frontend-page: Forgot-password and reset-password screens

Rules: PRD §4.14, PRD §4.15, UI §3, Tech-Frontend §5, Tech-Frontend §7
Depends on: none (refactor-06 has landed; build on the new patterns).
Not in scope: the backend endpoints (5.3–5.4). Changing the login/register screens beyond adding
the link.
Docs to update: UI §3 (the two screens and the resend button/cooldown).
Verify: `npm run test:e2e` — forgot → (email caught) → reset → login journey passes; manual walk of
both screens including the resend cooldown timer.

- [ ] `/forgot-password`: email field + submit; after submit, a generic "check your email"
      message (never reveals existence) and a **Resend** button disabled by a visible cooldown.
- [ ] `/reset-password`: reads `token` from the query; new-password + confirm fields validated by
      Zod (PRD §6); success routes to `/login`; an invalid/expired token shows a clear error with a
      link back to `/forgot-password`.
- [ ] `/login` links to `/forgot-password`; the auth `api/` gains the two calls.
- Commit: `feat(frontend): forgot-password and reset-password screens`

---

#### 5.7 — Test: End-to-end and integration coverage for the reset journey

Rules: PRD §4.14, PRD §4.15, PRD §7
Not in scope: re-testing unrelated auth paths (refactor-03 owns those).
Docs to update: Tech-Backend §9 / Tech-Frontend §9 (list the reset suites).
Verify: `cd backend && npm test` and `npm run test:e2e` are green for the reset journey.

- [ ] Integration: cooldown enforced; token is single-use and expires; the forgot response never
      differs for known vs unknown email.
- [ ] e2e: request a reset, capture the link (Resend test/sandbox or an intercept — never a live
      send in e2e), set a new password, and log in with it.
- [ ] Negative e2e: a used or expired link shows the error screen, not a password form.
- Commit: `test: cover the forgot-password and reset journey end to end`
