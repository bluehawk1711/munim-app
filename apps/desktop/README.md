# Munim Desktop (Tauri v2)

Native desktop app for Munim — stock, sales, billing, khata and job letters
against the **shared Neon database** (no API server). Scaffolded from
[`kitlib/tauri-app-template`](https://github.com/kitlib/tauri-app-template)
(Vite + React 19 + Tailwind v4 + shadcn/ui + Tauri v2) and wired to
`@munim/core`.

## Screens

Dashboard · Products & Stock · Sales · Billing/Invoices (shared bill generation
+ jsPDF export) · Parties & Khata (advances given/taken, ledger) · Job Letters ·
Settings (shop profile + database connection)

## Development

```bash
pnpm install
cp .env.example .env        # set VITE_DATABASE_URL=postgresql://…
pnpm tauri:dev
```

The connection string can also be set at runtime in **Settings → Database**
(no rebuild needed).

## Build

```bash
pnpm build            # typecheck + vite build
pnpm tauri:build      # Windows NSIS installer in src-tauri/target/release/bundle/
```

CI builds the installer automatically via GitHub Actions (`tauri-action`,
`.github/workflows/desktop-build.yml`) and uploads the `.exe` artifact.

## Notes

- The DB client (`src/lib/core.ts`) connects **directly** to Neon's
  SQL-over-HTTP endpoint from the webview — same `@munim/core` package as the
  other apps, so bills, numbering and amount-in-words are identical everywhere.
- Requires Rust: <https://rustup.rs>
