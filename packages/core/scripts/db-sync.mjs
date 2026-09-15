#!/usr/bin/env node
/**
 * db-sync — backup and restore Munim Postgres databases.
 *
 * Usage:
 *   node scripts/db-sync.mjs backup  [--out backup.json]
 *   node scripts/db-sync.mjs restore [--file backup.json]
 *   node scripts/db-sync.mjs migrate [--from SOURCE_URL] [--to TARGET_URL]
 *
 * Environment variables:
 *   DATABASE_URL            — used by backup/restore when --from/--to not set
 *   DB_BACKUP_SOURCE_URL    — backup source (fallback: DATABASE_URL)
 *   DB_BACKUP_TARGET_URL    — restore target (fallback: DATABASE_URL)
 *
 * "backup"  → reads all rows from the source DB, writes a timestamped JSON file.
 * "restore" → reads a JSON file, truncates + inserts into the target DB.
 * "migrate" → backup source → restore target in one shot (for DB moves).
 */

import { Pool } from "pg";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

/* ── Table order (parents first, children last) ────────────────────────── */
const TABLES = [
  "colors",
  "sizes",
  "categories",
  "products",
  "stock_movements",
  "parties",
  "advances",
  "invoices",
  "invoice_items",
  "payments",
  "job_letters",
  "settings",
  "activity_logs",
];

/* ── CLI args ──────────────────────────────────────────────────────────── */
const args = process.argv.slice(2);
const cmd = args[0];

function flag(name) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
}

const sourceUrl = flag("--from") || process.env.DB_BACKUP_SOURCE_URL || process.env.DATABASE_URL;
const targetUrl = flag("--to") || process.env.DB_BACKUP_TARGET_URL || process.env.DATABASE_URL;
const outFile = flag("--out");
const inFile = flag("--file");

if (!cmd || !["backup", "restore", "migrate"].includes(cmd)) {
  console.error("Usage: node db-sync.mjs <backup|restore|migrate> [options]");
  console.error("  backup  [--out file.json]");
  console.error("  restore [--file file.json]");
  console.error("  migrate [--from SOURCE_URL] [--to TARGET_URL]");
  process.exit(1);
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

async function withPool(url, fn) {
  const pool = new Pool({ connectionString: url, max: 5, ssl: { rejectUnauthorized: false } });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

/** Fetch all rows from a table. Returns { table, rows }. */
async function fetchTable(pool, table) {
  const { rows } = await pool.query(`SELECT * FROM "${table}" ORDER BY 1`);
  return { table, rows, count: rows.length };
}

/** Truncate a table (cascade) and insert rows. */
async function loadTable(pool, table, rows) {
  if (rows.length === 0) {
    await pool.query(`TRUNCATE "${table}" CASCADE`);
    return { table, inserted: 0 };
  }

  // Build column list from first row keys
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(", ");

  // Use a transaction for atomicity
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`TRUNCATE "${table}" CASCADE`);

    // Batch inserts in chunks of 500 rows
    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const values = [];
      const placeholders = [];
      let paramIdx = 1;

      for (const row of batch) {
        const rowPlaceholders = cols.map(() => `$${paramIdx++}`);
        placeholders.push(`(${rowPlaceholders.join(",")})`);
        for (const col of cols) {
          let val = row[col];
          // pg driver handles JSON objects natively, but ensure dates are strings
          values.push(val);
        }
      }

      await client.query(
        `INSERT INTO "${table}" (${colList}) VALUES ${placeholders.join(",")}`,
        values,
      );
      inserted += batch.length;
    }

    await client.query("COMMIT");
    return { table, inserted };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/* ── Commands ──────────────────────────────────────────────────────────── */

async function backup() {
  if (!sourceUrl) {
    console.error("No source URL. Set DATABASE_URL or pass --from URL");
    process.exit(1);
  }

  console.log(`\n📦 Backing up from source...`);
  const host = new URL(sourceUrl).hostname;
  console.log(`   Host: ${host}`);

  const result = await withPool(sourceUrl, async (pool) => {
    const backup = { version: 1, createdAt: new Date().toISOString(), source: host, tables: {} };
    let totalRows = 0;

    for (const table of TABLES) {
      const { rows, count } = await fetchTable(pool, table);
      backup.tables[table] = rows;
      totalRows += count;
      console.log(`   ${table}: ${count} rows`);
    }

    backup.totalRows = totalRows;
    return backup;
  });

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = outFile || `backup-${ts}.json`;
  const filepath = join(process.cwd(), filename);
  writeFileSync(filepath, JSON.stringify(result, null, 2));
  console.log(`\n✅ Backup saved: ${filepath}`);
  console.log(`   ${result.totalRows} total rows across ${TABLES.length} tables\n`);
}

async function restore() {
  if (!targetUrl) {
    console.error("No target URL. Set DATABASE_URL or pass --to URL");
    process.exit(1);
  }

  const filepath = inFile
    ? (existsSync(inFile) ? inFile : join(process.cwd(), inFile))
    : (() => { console.error("No backup file. Pass --file backup.json"); process.exit(1); })();

  console.log(`\n📥 Restoring from backup...`);
  console.log(`   File: ${filepath}`);

  const backup = JSON.parse(readFileSync(filepath, "utf-8"));
  console.log(`   Created: ${backup.createdAt}`);
  console.log(`   Source: ${backup.source}`);
  console.log(`   Total rows: ${backup.totalRows}`);

  const host = new URL(targetUrl).hostname;
  console.log(`   Target: ${host}\n`);

  await withPool(targetUrl, async (pool) => {
    for (const table of TABLES) {
      const rows = backup.tables[table] || [];
      const { inserted } = await loadTable(pool, table, rows);
      console.log(`   ${table}: ${inserted} rows`);
    }
  });

  console.log(`\n✅ Restore complete!\n`);
}

async function migrate() {
  if (!sourceUrl) {
    console.error("No source URL. Pass --from URL or set DB_BACKUP_SOURCE_URL");
    process.exit(1);
  }
  if (!targetUrl) {
    console.error("No target URL. Pass --to URL or set DB_BACKUP_TARGET_URL");
    process.exit(1);
  }
  if (sourceUrl === targetUrl) {
    console.error("Source and target URLs are the same!");
    process.exit(1);
  }

  console.log(`\n🔄 Migrating database...`);
  console.log(`   From: ${new URL(sourceUrl).hostname}`);
  console.log(`   To:   ${new URL(targetUrl).hostname}\n`);

  // Step 1: Backup from source
  const backup = await withPool(sourceUrl, async (pool) => {
    const data = { version: 1, createdAt: new Date().toISOString(), source: new URL(sourceUrl).hostname, tables: {} };
    let totalRows = 0;
    for (const table of TABLES) {
      const { rows, count } = await fetchTable(pool, table);
      data.tables[table] = rows;
      totalRows += count;
      console.log(`   📦 ${table}: ${count} rows`);
    }
    data.totalRows = totalRows;
    return data;
  });

  console.log(`\n   Total: ${backup.totalRows} rows backed up\n`);

  // Step 2: Restore to target
  await withPool(targetUrl, async (pool) => {
    for (const table of TABLES) {
      const rows = backup.tables[table] || [];
      const { inserted } = await loadTable(pool, table, rows);
      console.log(`   📥 ${table}: ${inserted} rows`);
    }
  });

  console.log(`\n✅ Migration complete! ${backup.totalRows} rows transferred.\n`);
}

/* ── Run ───────────────────────────────────────────────────────────────── */
const commands = { backup, restore, migrate };
commands[cmd]().catch((err) => {
  console.error(`\n❌ ${cmd} failed:`, err.message);
  process.exit(1);
});
