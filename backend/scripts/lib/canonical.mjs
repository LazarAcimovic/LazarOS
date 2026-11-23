// canonical.mjs — the single definition of the data-preservation canonical form (DB §7.3).
//
// Every piece of the SQL Server → Postgres cutover shares this module so the three never drift:
//   - export-mssql-data.mjs   writes the CSVs and the native manifest
//   - remanifest-usec.mjs     regenerates an existing manifest at microsecond precision
//   - reconcile-postgres-data.mjs  recomputes the checksum from the loaded Postgres data
//
// Precision (D-017): timestamps are canonicalized to MICROSECONDS — the maximum PostgreSQL
// `timestamptz` holds and the maximum both engines share — rounded half-to-even on the 100-ns
// tick, which is byte-for-byte what a `timestamptz` cast produces. See DB §7.1, §7.3.

import { createHash } from "node:crypto";

// Fixed column order (DB §7.3). `timestamps` names columns canonicalized to microseconds via
// toMicros(); `dates` names date-only columns normalized to YYYY-MM-DD via canonicalDate().
export const TABLES = {
  profiles: {
    columns: ["id", "first_name", "last_name", "email", "password", "created_at"],
    timestamps: new Set(["created_at"]),
    dates: new Set(),
  },
  tasks: {
    columns: [
      "id", "user_id", "title", "description", "due_date", "priority",
      "status", "is_deleted", "completed_at", "created_at", "updated_at",
    ],
    timestamps: new Set(["completed_at", "created_at", "updated_at"]),
    dates: new Set(["due_date"]),
  },
};

// Normalize a date to the canonical YYYY-MM-DD (DB §7.3). Accepts the ISO form a clean export
// writes (CONVERT style 23) and the locale M/D/YYYY form an older/mssql-driver export produced,
// so the canonical value is engine- and DateStyle-independent either way. The real backup carries
// unambiguous US dates (day > 12 appears second), so M/D/YYYY is read month-first.
export function canonicalDate(raw) {
  const s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  throw new Error(`unrecognized date format (expected YYYY-MM-DD or M/D/YYYY): ${s}`);
}

// Round an ISO-8601 timestamp (UTC wall-clock, no offset) to microseconds exactly as a
// PostgreSQL `timestamptz` cast does: half-to-even on the 100-ns tick, carrying a .9999995+
// value up into the next second (and on into the minute/hour/day/month/year) via UTC date
// arithmetic. Idempotent: a value already at ≤6 fractional digits is returned unchanged.
export function toMicros(iso) {
  const m = String(iso).match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/
  );
  if (!m) throw new Error(`not an ISO-8601 (no-offset) timestamp: ${iso}`);
  const frac = ((m[7] ?? "") + "0000000").slice(0, 7); // pad/truncate to 7 ticks (100-ns units)
  const ticks = Number(frac); // 0 .. 9_999_999
  let micros = Math.floor(ticks / 10);
  const rem = ticks % 10;
  if (rem > 5) micros += 1;
  else if (rem === 5 && micros % 2 === 1) micros += 1; // half-to-even
  let baseMs = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]); // whole second, ms = 0
  if (micros === 1_000_000) {
    baseMs += 1000; // carry into the next second via Date arithmetic
    micros = 0;
  }
  const datePart = new Date(baseMs).toISOString().slice(0, 19); // YYYY-MM-DDTHH:MM:SS
  return `${datePart}.${String(micros).padStart(6, "0")}`;
}

// The canonical string for one column's value (DB §7.3). `null`/`undefined` stays null (the SQL
// NULL, encoded as the token 'N'); timestamp columns are rounded to microseconds; date columns
// are normalized to YYYY-MM-DD; everything else is the value verbatim (ids are rendered
// lowercased and bits as 0/1 before this point, or supplied already canonical).
export function canonicalValue(column, raw, spec) {
  if (raw === null || raw === undefined) return null;
  if (spec.timestamps.has(column)) return toMicros(String(raw));
  if (spec.dates?.has(column)) return canonicalDate(String(raw));
  return String(raw);
}

// Deterministic content checksum (DB §7.3): rows ordered by the lowercased 36-char `id`; per
// column in fixed order emit 'N' for NULL else 'V' + utf8ByteLength + ':' + value; each row
// terminated by '\n'; SHA-256 over the whole byte stream; hex digest returned.
export function contentChecksum(spec, rows) {
  const { columns } = spec;
  const ordered = [...rows].sort((a, b) =>
    String(a.id).toLowerCase() < String(b.id).toLowerCase() ? -1
      : String(a.id).toLowerCase() > String(b.id).toLowerCase() ? 1 : 0
  );
  const h = createHash("sha256");
  for (const row of ordered) {
    for (const c of columns) {
      const v = canonicalValue(c, row[c], spec);
      if (v === null) {
        h.update("N");
      } else {
        const b = Buffer.from(v, "utf8");
        h.update(`V${b.length}:`);
        h.update(b);
      }
    }
    h.update("\n");
  }
  return h.digest("hex");
}

// overallChecksum = SHA-256 of 'profiles:<count>:<checksum>\ntasks:<count>:<checksum>\n' (DB §7.3).
export function overallChecksum(tables) {
  return createHash("sha256")
    .update(`profiles:${tables.profiles.rowCount}:${tables.profiles.checksum}\n`)
    .update(`tasks:${tables.tasks.rowCount}:${tables.tasks.checksum}\n`)
    .digest("hex");
}

// --- RFC-4180 CSV, matching export-mssql-data.mjs's convention -------------------------------
// A SQL NULL is an empty UNQUOTED field; an empty string is the quoted token "". Quotes inside a
// quoted field are doubled. Records are separated by CRLF; fields may contain embedded newlines
// when quoted (task descriptions do).

export function csvField(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s === "" || /[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(columns, rows) {
  const lines = [columns.map(csvField).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvField(row[c])).join(","));
  return lines.join("\r\n") + "\r\n";
}

// Parse CSV text into an array of records (each an array of string | null). A field is `null`
// only when it was an empty UNQUOTED field (SQL NULL); a quoted "" is the empty string "".
function parseRecords(text) {
  const records = [];
  let record = [];
  let field = "";
  let inQuotes = false;
  let quoted = false; // this field opened with a quote
  let started = false; // a character (or opening quote) has been seen for this field
  const pushField = () => {
    record.push(quoted ? field : field === "" ? null : field);
    field = "";
    quoted = false;
    started = false;
  };
  const pushRecord = () => {
    pushField();
    records.push(record);
    record = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && !started) { inQuotes = true; quoted = true; started = true; continue; }
    if (ch === ",") { pushField(); continue; }
    if (ch === "\r") { if (text[i + 1] === "\n") i++; pushRecord(); continue; }
    if (ch === "\n") { pushRecord(); continue; }
    field += ch;
    started = true;
  }
  if (started || quoted || field !== "" || record.length > 0) pushRecord();
  return records;
}

// Parse a table CSV into row objects keyed by `columns`, validating the header matches.
export function parseTableCsv(text, columns) {
  const records = parseRecords(text);
  if (records.length === 0) throw new Error("empty CSV (no header row)");
  const header = records[0].map((h) => (h === null ? "" : h));
  if (header.length !== columns.length || columns.some((c, i) => c !== header[i])) {
    throw new Error(`CSV header ${JSON.stringify(header)} ≠ expected ${JSON.stringify(columns)}`);
  }
  return records.slice(1).map((rec) => {
    if (rec.length !== columns.length) {
      throw new Error(`CSV row has ${rec.length} fields, expected ${columns.length}: ${JSON.stringify(rec)}`);
    }
    const row = {};
    columns.forEach((c, i) => { row[c] = rec[i]; });
    return row;
  });
}
