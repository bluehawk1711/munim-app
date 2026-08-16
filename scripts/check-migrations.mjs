// Lists applied Drizzle migrations from the Neon database using the
// SQL-over-HTTP endpoint (no driver needed — same transport the apps use).
// Usage: node scripts/check-migrations.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const envPath = join(root, "packages", "core", ".env");
const env = readFileSync(envPath, "utf8");
const match = env.match(/^DATABASE_URL=(.+)$/m);
if (!match) {
  console.error("No DATABASE_URL in packages/core/.env");
  process.exit(1);
}
const url = match[1].trim().replace(/^['"]|['"]$/g, "");const hostMatch = url.match(/^postgres(?:ql)?:\/\/[^@]+@([^/]+)\//);
if (!hostMatch) {
  console.error("Could not parse host from DATABASE_URL");
  process.exit(1);
}

// Neon's SQL-over-HTTP endpoint authenticates via the full connection string
// in the neon-connection-string header (basic-auth + db headers are rejected).
const res = await fetch(`https://${hostMatch[1]}/sql`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "neon-connection-string": url,
  },
  body: JSON.stringify({
    query:
      "select hash, created_at from drizzle.__drizzle_migrations order by created_at",
  }),
});
const body = await res.text();
try {
  // Neon returns Postgres-wire JSON: { fields: [...], rows: [...] }.
  const parsed = JSON.parse(body);
  const rows = Array.isArray(parsed) ? parsed : parsed.rows ?? [];
  console.log("APPLIED MIGRATIONS:", rows.length);
  for (const r of rows) {
    console.log(
      "  -",
      String(r.hash).slice(0, 16),
      new Date(Number(r.created_at)).toISOString().slice(0, 16),
    );
  }
} catch {
  console.log("RAW:", body.slice(0, 400));
}
