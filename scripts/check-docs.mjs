#!/usr/bin/env node
// check-docs.mjs — mechanical doc consistency check wired to the pre-commit hook.
// See AGENTS.md §10 and the retrofit prompt's Appendix E. Prose rules are necessary but not
// sufficient; this is what makes them enforceable.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const REPO = resolve(new URL("..", import.meta.url).pathname.replace(/^\//, ""));
const errors = [];
const warnings = [];

const arg = new Set(process.argv.slice(2));
const warningsAreErrors = arg.has("--warnings-as-errors");

function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

function readText(p) {
  try { return readFileSync(p, "utf8"); }
  catch { return null; }
}

function readLines(p) {
  const t = readText(p);
  return t === null ? null : t.split(/\r?\n/);
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// -- 1. Section index drift ---------------------------------------------------

const SOURCE_DOCS_WITH_INDEX = [
  "docs/PRD.md",
  "docs/Tech.md",
  "docs/Tech-Backend.md",
  "docs/Tech-Frontend.md",
  "docs/UI.md",
];

for (const docPath of SOURCE_DOCS_WITH_INDEX) {
  const lines = readLines(join(REPO, docPath));
  if (!lines) { err(`${docPath}: missing`); continue; }

  // Find the "## Section index" block and its table.
  let inIndex = false;
  const indexNumbers = new Set();
  for (const line of lines) {
    if (/^## Section index\b/.test(line)) { inIndex = true; continue; }
    if (inIndex && /^## /.test(line)) break;
    if (inIndex) {
      // row: | 1 | Title |
      const m = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|/);
      if (m) {
        const n = m[1];
        if (/\d+:\d+|\d+-\d+/.test(line)) err(`${docPath}: section-index row for ${n} contains a line range`);
        indexNumbers.add(n);
      }
    }
  }

  // Compare to actual `^## N.` headings.
  const headingNumbers = new Set();
  for (const line of lines) {
    const m = line.match(/^## (\d+)\./);
    if (m) headingNumbers.add(m[1]);
  }
  for (const n of indexNumbers) {
    if (!headingNumbers.has(n)) err(`${docPath}: index row ${n} has no matching \`^## ${n}.\` heading`);
  }
  for (const n of headingNumbers) {
    if (!indexNumbers.has(n)) err(`${docPath}: \`## ${n}.\` heading missing from the section index`);
  }
}

// -- 2 & 7. Dangling §/path references in source docs ------------------------

const SOURCE_DOCS = [
  "docs/Overview.md",
  "docs/PRD.md",
  "docs/UI.md",
  "docs/DB.md",
  "docs/Tech.md",
  "docs/Tech-Backend.md",
  "docs/Tech-Frontend.md",
];

function headingsForDoc(docPath) {
  const lines = readLines(join(REPO, docPath));
  if (!lines) return null;
  const hs = new Set();
  for (const line of lines) {
    const m = line.match(/^## (\d+)/);
    if (m) hs.add(m[1]);
    const sub = line.match(/^### (\d+\.\d+)/);
    if (sub) hs.add(sub[1]);
  }
  return hs;
}

const docHeadings = new Map();
for (const d of [...SOURCE_DOCS, "docs/Decisions.md"]) {
  docHeadings.set(d, headingsForDoc(d));
}

const DOC_NAME_TO_PATH = {
  "PRD": "docs/PRD.md",
  "UI": "docs/UI.md",
  "DB": "docs/DB.md",
  "Tech": "docs/Tech.md",
  "Tech-Backend": "docs/Tech-Backend.md",
  "Tech-Frontend": "docs/Tech-Frontend.md",
  "Overview": "docs/Overview.md",
};

for (const docPath of SOURCE_DOCS) {
  const text = readText(join(REPO, docPath));
  if (!text) continue;
  // Match things like `PRD §4.8`, `UI §12`, `Tech-Backend §3`.
  const re = /\b(PRD|UI|DB|Tech-Backend|Tech-Frontend|Tech|Overview)\s*§\s*(\d+(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(text))) {
    const target = DOC_NAME_TO_PATH[m[1]];
    if (!target) continue;
    if (target === docPath) continue; // self-§ refs: the index already checks these
    const hs = docHeadings.get(target);
    if (!hs || !hs.has(m[2])) {
      err(`${docPath}: dangling reference "${m[1]} §${m[2]}" → ${target} has no such heading`);
    }
  }
}

// -- 3. Dangling decision references -----------------------------------------

const decisionsLines = readLines(join(REPO, "docs/Decisions.md")) ?? [];
const decisionIds = new Set();
for (const line of decisionsLines) {
  const m = line.match(/^### (D-\d{3})\b/);
  if (m) decisionIds.add(m[1]);
}

for (const docPath of [...SOURCE_DOCS, ...walk(join(REPO, "docs/tasks")), ...walk(join(REPO, "docs/refactors"))]) {
  if (statSync(docPath).isDirectory?.()) continue;
  if (!docPath.endsWith(".md")) continue;
  const text = readText(docPath);
  if (!text) continue;
  const relPath = relative(REPO, docPath);
  const re = /\b(D-\d{3})\b/g;
  let m;
  while ((m = re.exec(text))) {
    if (!decisionIds.has(m[1])) err(`${relPath}: dangling decision reference "${m[1]}"`);
  }
}

// -- 4 & 5. Task/campaign subtask contract -----------------------------------

const SUBTASK_LINES = ["Rules:", "Not in scope:", "Docs to update:", "Verify:"];

function checkTrackerFile(path, kind /* "task" | "campaign" */) {
  const lines = readLines(path);
  if (!lines) return;
  const relPath = relative(REPO, path);
  // Find all #### headings.
  const subs = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^#### /.test(lines[i])) subs.push(i);
  }

  // The reserved headings that are NOT subtasks:
  const RESERVED = /^#### (Overview|Baseline|Out of scope|Rollback)\b/;

  for (let idx = 0; idx < subs.length; idx++) {
    const start = subs[idx];
    const end = idx + 1 < subs.length ? subs[idx + 1] : lines.length;
    const heading = lines[start];
    if (RESERVED.test(heading)) continue;

    // Heading shape: `#### <id> — <sub-tag>: <title>`. Em dash.
    if (!/^#### \S+\s+—\s+[A-Za-z-]+\s*:\s+\S/.test(heading)) {
      err(`${relPath}:${start + 1}: subtask heading doesn't match "#### <id> — <sub-tag>: <title>" — "${heading}"`);
    }

    // Four required lines must appear within the subtask body.
    const body = lines.slice(start + 1, end).join("\n");
    for (const line of SUBTASK_LINES) {
      if (!body.includes(line)) {
        err(`${relPath}:${start + 1}: subtask missing "${line}" line`);
      }
    }

    // Rules: line sanity.
    const rulesMatch = body.match(/^Rules:\s*(.+)$/m);
    if (rulesMatch) {
      const rulesValue = rulesMatch[1].trim();
      // Forbid naming another task file.
      if (/task-\d+/.test(rulesValue) && !/Decisions\s+D-/.test(rulesValue)) {
        err(`${relPath}:${start + 1}: Rules: names a task file — only PRD/UI/DB/Tech or D-0NN allowed`);
      }
      // Fragments. Split on comma; each must start with a valid prefix.
      const valid = /^(PRD|UI|DB|Tech|Tech-Backend|Tech-Frontend|Overview|Decisions|none|D-\d{3})\b/;
      const fragments = rulesValue.split(/[,·]/).map(s => s.trim()).filter(Boolean);
      for (const f of fragments) {
        if (!valid.test(f)) {
          err(`${relPath}:${start + 1}: Rules: fragment "${f}" doesn't start with a document name, D-0NN or 'none'`);
        }
      }
    }
  }

  // Count open vs closed checkboxes for progress validation (done at the file level below).
  return { subs, lines };
}

// Collect per-file progress.
function countBoxes(lines) {
  let open = 0, closed = 0;
  for (const line of lines) {
    if (/^\s*- \[ \]\s/.test(line)) open++;
    else if (/^\s*- \[x\]\s/i.test(line)) closed++;
  }
  return { open, closed, total: open + closed };
}

const taskFiles = walk(join(REPO, "docs/tasks/active")).filter(p => p.endsWith(".md") && !p.endsWith("index.md"));
const campaignFiles = walk(join(REPO, "docs/refactors/active")).filter(p => p.endsWith(".md") && !p.endsWith("index.md"));

for (const p of taskFiles) checkTrackerFile(p, "task");
for (const p of campaignFiles) checkTrackerFile(p, "campaign");

// -- 6. Index drift (shape shared across trackers) ---------------------------

function checkIndex(indexPath, filesDir) {
  const lines = readLines(indexPath);
  if (!lines) return;
  const idxDir = relative(REPO, indexPath).split(/[\\/]/).slice(0, -1).join("/");
  const indexedFiles = new Set();
  const progressMap = new Map(); // filePath -> { done, total }
  for (const line of lines) {
    const m = line.match(/\|\s*([^|]+?)\s*\|\s*(\d+)\/(\d+)\s*\|.*?\]\(([^)]+)\)/);
    if (m) {
      const title = m[1];
      const done = Number(m[2]);
      const total = Number(m[3]);
      const href = m[4];
      const absFile = resolve(REPO, idxDir, href);
      indexedFiles.add(absFile);
      progressMap.set(absFile, { done, total, title });
      if (!existsSync(absFile)) {
        err(`${relative(REPO, indexPath)}: row "${title}" links to missing file ${href}`);
      }
    }
  }
  // Every .md in the folder (except index.md) must have a row.
  for (const f of walk(join(REPO, filesDir))) {
    if (!f.endsWith(".md")) continue;
    if (f.endsWith("index.md")) continue;
    if (!indexedFiles.has(f)) err(`${relative(REPO, f)}: no row in ${relative(REPO, indexPath)}`);
  }
  // Progress-cell vs file reality.
  for (const [absFile, { done, total, title }] of progressMap) {
    if (!existsSync(absFile)) continue;
    const l = readLines(absFile) ?? [];
    const { open, closed } = countBoxes(l);
    // Count subtasks: `#### <id>` headings except reserved.
    const subCount = l.filter(x => /^#### /.test(x) && !/^#### (Overview|Baseline|Out of scope|Rollback)\b/.test(x)).length;
    // A subtask counts as done only when ALL its boxes are ticked.
    const completedSubtasks = (() => {
      let count = 0;
      const idxs = [];
      for (let i = 0; i < l.length; i++) if (/^#### /.test(l[i]) && !/^#### (Overview|Baseline|Out of scope|Rollback)\b/.test(l[i])) idxs.push(i);
      for (let i = 0; i < idxs.length; i++) {
        const a = idxs[i], b = i + 1 < idxs.length ? idxs[i + 1] : l.length;
        const body = l.slice(a, b);
        const bodyBoxes = countBoxes(body);
        if (bodyBoxes.total > 0 && bodyBoxes.open === 0) count++;
      }
      return count;
    })();
    if (subCount !== total) err(`${relative(REPO, indexPath)}: "${title}" progress total ${total} ≠ ${subCount} subtasks in file`);
    if (completedSubtasks !== done) err(`${relative(REPO, indexPath)}: "${title}" progress done ${done} ≠ ${completedSubtasks} fully-ticked subtasks in file`);
    // boxes used only for info; suppress lint noise:
    void open; void closed;
  }
}

checkIndex(join(REPO, "docs/tasks/active/index.md"), "docs/tasks/active");
checkIndex(join(REPO, "docs/refactors/active/index.md"), "docs/refactors/active");

// -- 7. Documented paths that do not exist (source docs only) ----------------

// Plan docs (tasks, refactors) and Decisions.md are exempt; TEMPLATE.md files are exempt.
const PATH_SCAN_DOCS = SOURCE_DOCS;
for (const docPath of PATH_SCAN_DOCS) {
  const text = readText(join(REPO, docPath));
  if (!text) continue;
  // Match paths in backticks that look like repo paths: at least one slash, no spaces,
  // no URL scheme. Skip anything with query strings, placeholders (<...>) or shell syntax.
  const re = /`([^`\s<>]+\/[^`\s<>]+)`/g;
  let m;
  while ((m = re.exec(text))) {
    const p = m[1];
    // Skip obvious non-paths.
    if (p.startsWith("http://") || p.startsWith("https://")) continue;
    if (p.includes("://")) continue;
    if (/^[0-9]+\.[0-9]+$/.test(p)) continue;
    if (/^@[\w-]+\//.test(p)) continue; // npm scoped packages
    if (p.includes("@") && !p.startsWith("backend/") && !p.startsWith("frontend/") && !p.startsWith("docs/") && !p.startsWith("scripts/") && !p.startsWith(".github") && !p.startsWith(".githooks")) continue;
    if (p.startsWith("/api/")) continue; // HTTP paths, not FS paths
    // Allow `docs/old/**` placeholder — it's gitignored.
    if (p.startsWith("docs/old/")) continue;
    // Shell-ish tokens
    if (/[*?]/.test(p)) continue;
    // Template placeholders (e.g. docs/tasks/done/YYYY-MM.md).
    if (/\b(YYYY|MM|DD|NN|slug|name)\b/.test(p)) continue;
    // Only check paths that look rooted at the repo.
    const KNOWN_ROOTS = ["backend/", "frontend/", "docs/", "scripts/", ".githooks/", ".github/"];
    if (!KNOWN_ROOTS.some(r => p.startsWith(r))) continue;
    // Strip trailing : line-number or :line-range
    const bare = p.replace(/:\d+(?:-\d+)?$/, "");
    if (!existsSync(join(REPO, bare))) {
      err(`${docPath}: documented path \`${p}\` does not exist`);
    }
  }
}

// -- 8. Section size (## through ### children) ------------------------------

for (const docPath of SOURCE_DOCS) {
  const lines = readLines(join(REPO, docPath));
  if (!lines) continue;
  const sections = [];
  for (let i = 0; i < lines.length; i++) if (/^## /.test(lines[i])) sections.push(i);
  for (let i = 0; i < sections.length; i++) {
    const a = sections[i], b = i + 1 < sections.length ? sections[i + 1] : lines.length;
    const size = b - a;
    if (size > 150) warn(`${docPath}: section "${lines[a].trim()}" is ${size} lines (>150) — consider splitting`);
  }
}

// -- 9. `docs/old` mentions outside sanctioned places ------------------------

// Files that may legitimately mention `docs/old` — the banner lives here on purpose.
// Path comparison uses the OS path separator, so cover both.
const DOCS_OLD_SANCTIONED = new Set([
  "AGENTS.md",
  "docs/Overview.md",
  "docs\\Overview.md",
  ".gitignore",
  "scripts/check-docs.mjs",
  "scripts\\check-docs.mjs",
]);

for (const p of walk(join(REPO, "docs")).concat(join(REPO, "AGENTS.md"), join(REPO, "CLAUDE.md"))) {
  if (!existsSync(p)) continue;
  const relPath = relative(REPO, p);
  if (!relPath.endsWith(".md")) continue;
  if (DOCS_OLD_SANCTIONED.has(relPath)) continue;
  const text = readText(p);
  if (!text) continue;
  if (/docs\/old\b/.test(text)) {
    warn(`${relPath}: mentions "docs/old" outside the sanctioned list`);
  }
}

// -- 10. OPEN decisions ------------------------------------------------------

for (let i = 0; i < decisionsLines.length; i++) {
  const line = decisionsLines[i];
  const m = line.match(/^\*\*Decided:\*\*\s*\S+\s*·\s*\*\*Status:\*\*\s*(.+?)\s*$/);
  if (m && /OPEN/.test(m[1])) {
    // Find the nearest preceding `### D-...` heading.
    for (let j = i; j >= 0; j--) {
      const h = decisionsLines[j].match(/^### (D-\d{3})/);
      if (h) { warn(`docs/Decisions.md: ${h[1]} is OPEN — any section it owns is blocked`); break; }
    }
  }
}

// -- Report ------------------------------------------------------------------

for (const w of warnings) console.warn(`warning: ${w}`);
for (const e of errors)   console.error(`error:   ${e}`);

const failOnWarnings = warningsAreErrors && warnings.length > 0;
if (errors.length > 0 || failOnWarnings) {
  console.error(`\ncheck-docs: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(`check-docs: clean (${warnings.length} warning(s))`);
