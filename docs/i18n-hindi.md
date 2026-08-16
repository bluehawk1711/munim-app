# Hindi Language Support — Plan

> **Status:** Planned (not shipped) · **Target:** `hi-IN` (Devanagari) + English.
> Follows the monorepo's established patterns: **shared logic in `packages/core`,
> shared UI in `@munim/ui`, and sync via the shared `settings` row** — except
> appearance (theme + dark/light mode), which is deliberately **device-local**
> (see `docs/ARCHITECTURE.md` ADR-011b); a language preference should be handled
> the same per-device way.

---

## Goal

Let a shop owner run Munim entirely in **Hindi** (Devanagari script) on all three
apps, with English as the default and a one-tap language switch in Settings. The
language choice **syncs across web, desktop and mobile** through the shared
database (like theme/mode), falls back to a device-local preference before the
DB is configured, and — because it is **100% JS** — requires **no mobile dev
build rebuild** (see ADR-013).

## Non-goals

- **No RTL.** Hindi is LTR; no direction handling needed.
- **No transliteration.** We translate UI strings; we do not transliterate typed
  input (a product named in Latin script stays as typed).
- **No locale URL routing** on web (the app already keeps its view in `?view=…`;
  the language lives in Settings + the DB row, not the URL).
- **Bills/letters stay English by default** — invoices in India are conventionally
  English (amount-in-words legally in English/Latin). Hindi document templates are
  an opt-in Phase D extension, never the default.

---

## Design

### 1. A new shared package: `packages/i18n` (`@munim/i18n`)

Mirrors the `packages/theme` pattern (a dedicated shared package consumed by all
three apps), so the message dictionaries and locale helpers live **once**:

```
packages/i18n/
├── src/
│   ├── types.ts        # Locale = "en" | "hi"; MessageKey = keyof typeof en
│   ├── en.ts           # English dictionary (THE key source — typed)
│   ├── hi.ts           # Hindi dictionary — must satisfy Record<MessageKey, string>
│   ├── index.ts        # t(locale, key, params?), dictionaries, messages getter
│   ├── format.ts       # formatNumber / formatDate / formatCurrency for a locale
│   │                   #   (Indian digit grouping 12,34,567 + optional Devanagari
│   │                   #   numerals १२,३४,५६७ — NO reliance on Intl for hi)
│   └── react.tsx       # I18nProvider + useT() hook (platform-agnostic React;
│                       #   web, desktop AND mobile all consume this one provider)
└── package.json        # name @munim/i18n, no runtime deps
```

**Type safety is the core rule:** `MessageKey = keyof typeof en`. `hi.ts` is
declared as `Record<MessageKey, string>`, so a missing Hindi translation is a
**compile error**, not a runtime blank. The no-`any`/no-`unknown` rule from
`AGENTS.md` applies here like everywhere else.

### 2. Locale storage & cross-app sync (mirrors ADR-011)

- Add a `language` column to the `settings` table: `text not null default 'en'`.
  → new Drizzle migration `0003_*.sql` via `pnpm db:generate`, committed; the
  `db-migrate.yml` drift-check enforces it.
- `getSettings`/`updateSettings` in core gain `language` (same shape as the
  existing `theme`/`mode`).
- **Sync rule (copy the theme/mode logic):** each app reads the DB `language` on
  startup; if the row is the untouched default, the device-local preference
  (localStorage `munim.lang` / AsyncStorage `munim.lang`) wins. When the user
  changes language in Settings, the app writes BOTH the DB row and the local
  value → instant sync across devices + instant fallback when the DB isn't
  configured yet (first launch of desktop/mobile).
- Web additionally stores the language in the session cookie used by the PIN
  gate, so the login screen renders in the chosen language.

### 3. Shared React provider

`packages/i18n/react.tsx` exports `I18nProvider({ locale, children })` and
`useT()`. Because web, desktop and mobile are all React (React DOM / React
Native), they share the **same provider and hook** — only the persistence
adapter differs (localStorage vs AsyncStorage), passed in as a prop:

```tsx
// apps/web + apps/desktop
<I18nProvider locale={lang} persist={localStoragePersist}>
// apps/mobile
<I18nProvider locale={lang} persist={asyncStoragePersist}>
```

`useT()` returns `(key, params?) => string` plus the current locale. A tiny
`<T key="..." />`-style helper or `t("nav.products")` in code — no template
libraries (no next-intl, no i18next — keep it dependency-free like the rest of
the stack).

### 4. Indian number formatting (the tricky part)

- **Do NOT rely on `Intl.NumberFormat("hi-IN")`** — Hermes' Intl support is
  partial and inconsistent across platforms. Hand-roll in `packages/i18n/format.ts`:
  - **Indian digit grouping:** last 3 digits, then groups of 2
    (`1234567.5` → `12,34,567.5`).
  - **Devanagari numerals (optional toggle):** map `0-9` → `०१२३४५६७८९`
    (`12,34,567` → `१२,३४,५६७`). Off by default even in Hindi mode (most
    Indian businesses use Latin numerals), exposed as a Settings toggle.
- **Currency:** keep the `₹` symbol (already used everywhere); only grouping +
  numerals change.
- **Dates:** extend core's date formatting with a `locale` parameter
  (Hindi month/day names: जनवरी, फ़रवरी…, सोमवार…). The mobile `DateField`
  friendly display (`12 Aug 2026`) becomes locale-aware.

### 5. Hindi amount-in-words → `packages/core`

Business logic lives in core: add `numberToWordsHindi(num)` next to the existing
`numberToWords` in `packages/core/src/utils/numberToWords.ts` (करोड़ / लाख /
हज़ार / सौ, Indian grouping — `1234567` → "बारह लाख चौंतीस हज़ार पाँच सौ
सड़सठ"). Export from core. Used only when a Hindi bill template is selected
(Phase D); the English default is untouched.

### 6. Where the strings live today

Every label in all three apps is hardcoded English. The conversion order is by
blast radius:

| Surface | Where | How |
|---|---|---|
| Web screens + dialogs + toasts | `apps/web/src/**` (views, components, hooks) | swap literals for `t("…")` |
| Desktop screens + dialogs | `apps/desktop/src/**` | same keys — shared `@munim/ui` components are converted ONCE |
| Shared UI kit | `packages/ui/src/components/*` | convert once; both apps inherit |
| PIN gate / login | `packages/ui` (PinGate) + `apps/mobile` (PinLockScreen) | convert — needs to work pre-DB |
| Mobile screens | `apps/mobile/src/screens/*` + `components/ui.tsx` (labels) | same keys as web/desktop |
| Bills & job letters | `packages/core/src/billing/*` renderers | optional `lang` param (Phase D) |
| Reports + CSV | `reportToCsv` headers, report titles | locale-aware (Phase D) |

---

## Translation guide — dukaan-style Hindi (v1)

> The audience is a **dukaan-dār** (shopkeeper) who speaks everyday bazaar Hindi,
> not textbook Hindi. The rule of thumb: **write the word the shopkeeper already
> says out loud.** When in doubt, prefer the shorter, spoken word over the formal
> one, and keep the English loanwords that are already part of bazaar Hindi.

### Review of the strings already in this plan

| String in the plan | Verdict | Note |
|---|---|---|
| बारह लाख चौंतीस हज़ार पाँच सौ सड़सठ (`1234567`) | ✅ correct | 67 = सड़सठ, 34 = चौंतीस — spot on Indian grouping |
| करोड़ / लाख / हज़ार / सौ | ✅ correct | exact spoken units |
| जनवरी, फ़रवरी…, सोमवार… | ✅ correct (minor) | drop the nukta: write **फरवरी** (many device fonts misrender फ़) |
| जॉब लेटर | ✅ fine | loanword; नौकरी पत्र only for formal print |

### The 10 golden words of dukaan Hindi

| Word | Meaning | Use instead of |
|---|---|---|
| **बकाया** | unpaid / outstanding | शेष राशि, अवशेष |
| **उधार** | credit (buy now, pay later) | ऋण |
| **हिसाब** | account / ledger / settlement | लेखा, बहीखाता (formal) |
| **एडवांस** | advance money | अग्रिम (formal) |
| **दाम** | price | मूल्य (formal) |
| **कमाई** | revenue / earnings | आय, राजस्व |
| **मुनाफ़ा** | profit | लाभ (acceptable, but मुनाफ़ा is spoken) |
| **ग्राहक** | customer | उपभोक्ता (formal) |
| **स्टॉक** | stock | माल-भंडार (formal) |
| **बिल** | bill / invoice | चालान (only for delivery notes) |

### Style rules (write these into the dictionaries)

1. **Verb-first imperatives** for actions — जोड़ें, बदलें, हटाएं, सेव करें,
   रद्द करें, खोजें, बेचें, दर्ज करें. Never noun-phrases like "जोड़ने की क्रिया".
2. **Keep the loanwords** — बिल, स्टॉक, सेल, रिपोर्ट, पेमेंट, डिस्काउंट,
   कैटलॉग, साइज़, प्रोडक्ट, पार्टी, एडवांस, डेटाबेस. They are already Hindi.
3. **Money direction is always लेना/देना** — "whom I gave money" is the core
   of this app: हमें लेना है (they owe us) vs हमें देना है (we owe them).
4. **One term per concept, everywhere** — pick बिल for invoices and never mix
   in बिक्री/सेल or ग्राहक/कस्टमर. Consistency beats elegance.
5. **Avoid Sanskrit-heavy words** no shopkeeper says: मूल्य → दाम,
   उपभोक्ता → ग्राहक, राजस्व → कमाई, अवशेष → बकाया, भुगतान → पैसा/पेमेंट
   (भुगतान stays only on printed bills as a legal word).
6. **Latin digits by default** — `₹12,34,567` reads fine in Hindi mode.
   Devanagari numerals (१२,३४,५६७) are the optional toggle, never the default.

### Glossary — navigation & modules (the nav is the same in all 3 apps)

| English (exact string) | Dukaan Hindi | Mobile-tab short form |
|---|---|---|
| Dashboard | डैशबोर्ड | होम |
| Products | प्रोडक्ट | प्रोडक्ट |
| Stock | स्टॉक | — |
| Catalog | कैटलॉग (रंग और साइज़) | कैटलॉग |
| Sales | सेल / बिक्री | सेल |
| Billing / New Bill | नया बिल | बिल |
| Invoices | बिल (इनवॉइस) | बिल |
| Parties | पार्टी | पार्टी |
| Khata | खाता | — |
| Advances | एडवांस | एडवांस |
| Job Letters | जॉब लेटर | लेटर |
| Reports | रिपोर्ट | रिपोर्ट |
| Settings | सेटिंग्स | सेटिंग्स |
| More | और | और |

### Glossary — actions & buttons

| English | Dukaan Hindi |
|---|---|
| Add / Create | जोड़ें / बनाएं |
| Edit / Rename | बदलें / नाम बदलें |
| Delete / Remove | हटाएं |
| Save | सेव करें |
| Cancel / Close | रद्द करें / बंद करें |
| Search | खोजें |
| Sell | बेचें |
| Record / Record payment | दर्ज करें / पेमेंट दर्ज करें |
| Settle | हिसाब करें |
| Confirm | पक्का करें |
| Update | अपडेट करें |
| Generate (report) | रिपोर्ट बनाएं |
| Export / Download / Print / Share | एक्सपोर्ट / डाउनलोड / प्रिंट / शेयर करें |
| Back / Next | वापस / आगे |
| Loading… | लोड हो रहा है… |

### Glossary — khata & money (the soul of Munim)

| English (exact string) | Dukaan Hindi |
|---|---|
| We are owed (udhaar) | हमें लेना है (उधार) |
| We owe (payable) | हमें देना है |
| Net position | नेट हिसाब |
| Advance given | एडवांस दिया |
| Advance taken | एडवांस लिया |
| Paid | पैसा मिला |
| Partially paid | आधा पैसा मिला |
| Unpaid / Outstanding | बकाया |
| Given / Taken | दिया / लिया |
| Paid us / We paid | पैसा मिला / हमने दिया |
| Settled | हिसाब बराबर |
| Balance / Total | बैलेंस / कुल |
| Amount / Amount in words | राशि / राशि (शब्दों में) |
| Discount / Delivery charge | छूट / डिलीवरी चार्ज |
| Profit / Revenue | मुनाफ़ा / कमाई |

### Glossary — forms & fields

| English | Dukaan Hindi |
|---|---|
| Name / Phone / Address | नाम / फोन / पता |
| Date / Notes | तारीख / नोट |
| Reason | कारण |
| Qty / Price | मात्रा / दाम |
| Buy price / Sell price | खरीद दाम / बिक्री दाम |
| Customer / Supplier / Worker | ग्राहक / सप्लायर / कर्मचारी |
| Item / Walk-in | सामान / वॉक-इन (keep as-is) |
| Employee name | कर्मचारी का नाम |
| Shop profile | दुकान की जानकारी |
| Dark mode / Haptics | डार्क मोड / वाइब्रेशन |

### Dates, money & numerals (Phase C reference)

| English format | Hindi format |
|---|---|
| 12 Aug 2026 | 12 अगस्त 2026 (Latin digits) / १२ अगस्त २०२६ (Devanagari) |
| ₹12,34,567.50 | ₹12,34,567.50 → ₹१२,३४,५६७.५० (toggle) |
| One hundred twenty rupees | एक सौ बीस रुपये (rupees → रुपये, paise → पैसे) |

Months: जनवरी, फरवरी, मार्च, अप्रैल, मई, जून, जुलाई, अगस्त, सितंबर,
अक्टूबर, नवंबर, दिसंबर · Days: सोमवार, मंगलवार, बुधवार, गुरुवार,
शुक्रवार, शनिवार, रविवार.

> **Layout warning (Phase E):** Hindi is ~20–40% longer than English. The mobile
> tab bar and buttons are the tightest spots — the "mobile-tab short form"
> column above is the escape hatch (होम, सेल, बिल, लेटर).

---

## Phases

### Phase A — Infrastructure (no UI changes)
1. Scaffold `packages/i18n` (`en.ts` key source, `hi.ts`, `t()`, `format.ts`,
   `react.tsx` provider). Export from the package index; wire into the
   workspace (`pnpm-workspace.yaml` picks it up automatically).
2. Core: add `language` to the settings schema + service; generate migration
   `0003_*.sql`; extend the smoke test (`packages/core` smoke covers
   `updateSettings` round-trip).
3. Settings UI (all 3 apps): a **Language row** — web/desktop share a new
   `LanguageSelect` in `@munim/ui` (compact, like `ThemeSelect`); mobile gets a
   native row in the Settings card (English / हिन्दी). Sync logic copied from
   the theme/mode handler.
4. Per-app bootstrap: web reads the DB `settings.language` (+ cookie fallback),
   desktop/mobile read DB + AsyncStorage; wrap the app in `I18nProvider`.
5. **Acceptance:** changing language in any app flips the other two on reload;
   a fresh device before DB config shows the local choice; tsc clean everywhere
   (proves the dictionaries typecheck).

### Phase B — Static UI strings (the bulk)
6. Convert **shared `@munim/ui` components first** (SettingsShell, dialogs,
   badges, bill options, PIN gate, theme select) — web + desktop inherit.
7. Convert **web + desktop screens** per module: nav/sidebar, dashboard,
   products, catalog, sales, billing, invoices, parties, advances, job letters,
   reports, settings. Same keys everywhere.
8. Convert **mobile screens** to the same keys (nav tabs, all 12 screens,
   `components/ui.tsx` labels, More tab).
9. Empty states, toasts (sonner on web/desktop, Alert on mobile), validation
   messages, skeletons' aria-labels.
10. **Acceptance:** `browser-act` walkthrough of every web view in Hindi;
    grep audit that no user-facing literal remains in app code (except
    dictionary files); mobile tsc clean; no native changes.

### Phase C — Dynamic content
11. `packages/i18n/format.ts`: Indian grouping + Devanagari numeral toggle;
    swap money/date/quantity displays in all 3 apps through the shared helpers
    (web/desktop via `@munim/ui` presentational bits; mobile via its formatters).
12. Settings → Appearance gains the **Devanagari numerals** toggle (device-local
    or DB-synced — decide with the user; default DB-synced like language).
13. **Acceptance:** reports totals, dashboard tiles, invoice amounts render
    `12,34,567` style in Hindi mode; toggle switches to `१२,३४,५६७`.

### Phase D — Documents & exports
14. Core: `numberToWordsHindi` + `renderBillHtml(bill, { lang: "hi" })` /
    `renderJobLetterHtml(data, { lang: "hi" })` — Hindi labels + Hindi
    amount-in-words. Default stays English.
15. Billing screen (all 3 apps): optional **"Bill language: English / हिन्दी"**
    per document (snapshot in `template_settings`, like template/color/2-in-1),
    defaulting to the app language.
16. `reportToCsv` + report titles localized; web Excel/PDF reports too.
17. **Acceptance:** print/export a Hindi bill on all 3 apps → identical output
    from the shared renderer; CSV opens with Hindi headers.

### Phase E — Hardening
18. Dictionary completeness check (a script that walks `keyof typeof en` and
    fails if `hi` misses keys — same idea as the drift-check job).
19. Long-string/overflow pass (Hindi is ~20–40% longer than English): buttons,
    table headers, mobile tab labels (e.g. "जॉब लेटर" vs "Job Letters").
20. `browser-act` Hindi flows (login → sell → bill → report) + tsc/lint across
    the repo + smoke tests. Document in `docs/features.md` as a new row
    (Language — ✅ all 3 apps).

---

## Key decisions (to confirm with the user)

1. **Dictionary package vs core** — plan puts dictionaries in a new
   `packages/i18n` (mirrors `packages/theme`); number-to-words stays in core.
2. **Devanagari numerals default** — plan: **off** even in Hindi mode
   (toggle in Settings). Most Indian shops use Latin digits.
3. **Bill language** — English by default, Hindi opt-in per document.
4. **Which strings first** — plan converts shared `@munim/ui` before any app,
   so web/desktop get the whole surface at once.

## Risks & mitigations

- **Hermes Intl inconsistency** → hand-rolled grouping/numerals (no `Intl` for hi).
- **Key drift** → `MessageKey` derives from `en`; the completeness check fails CI.
- **Long strings breaking layouts** → Phase E overflow pass; keep keys short,
  allow params.
- **Pre-DB first launch** (desktop/mobile) → device-local fallback, same rule as
  theme/mode today.
- **Scope creep** → each phase has an acceptance gate; bills/letters (D) are
  explicitly optional.
