# Munim Mobile (React Native)

On-the-go shop management for Android & iOS: dashboard, stock, quick sales,
billing (shared bill generation), khata (advances given/taken), reports and
settings. Built with **Expo SDK 57** (bare workflow, React Native 0.86 +
TypeScript) on top of the
[`react-native-community/template`](https://github.com/react-native-community/template),
and wired to `@munim/core` — the app connects **directly** to the shared Neon
database. There is no API server.

## Quick start — the QR dev-build workflow

The app is an **Expo development client** (`expo-dev-client`): you install the
dev build **once**, then connect it to your computer's Metro server via a QR
code. Code changes **hot reload** instantly.

### 1. Install the development build (one time)

**Option A — EAS Build (recommended, builds in the cloud):**

```bash
npx eas-cli login
cd apps/mobile
npx eas-cli build --platform android --profile development
# when it finishes, install the APK on your phone:
npx eas-cli install
```

**Option B — local native build (requires Android SDK / Xcode):**

```bash
cd apps/mobile
pnpm android    # or: pnpm ios   (compiles, installs on a device/simulator, starts Metro)
```

### Build an APK locally (no EAS, no device needed)

```bash
cd apps/mobile
pnpm build:android          # debug APK  → android/app/build/outputs/apk/debug/app-debug.apk
pnpm build:android:release  # release APK → android/app/build/outputs/apk/release/app-release.apk
```

These run `scripts/build-android.mjs`, which rebuilds `@munim/core` +
`@munim/theme` first and then runs the Gradle wrapper (works on Windows,
macOS and Linux). Install the APK with `adb install -r <path>`. The debug
APK is the dev client — start `pnpm start` and connect it to Metro as
below. (From the repo root you can also use `pnpm build:mobile:android`.)
For an iOS build you need macOS + Xcode: `pnpm build:ios`.

### 2. Start Metro and scan

```bash
cd apps/mobile
npx expo start        # starts the Metro bundler, shows a QR code
```

- Make sure your **phone and computer are on the same Wi-Fi network**.
- Open the **Munim** app (it launches into the dev-client launcher).
- Tap **"Enter URL manually"** / scan the QR from the terminal — or, if the
  dev launcher doesn't auto-detect, use the `exp://<your-computer-ip>:8081`
  URL shown by `expo start`.
- The app connects and **hot reloads** on every save. ⚡

> First launch in the app: open **Settings** and paste your Neon connection
> string (`postgresql://user:pass@host/db?sslmode=require`). It is stored
> on-device with AsyncStorage.

### Troubleshooting

- **"Unable to load script / connect to Metro"** — phone isn't on the same
  network as the PC, or Metro isn't running. Run `npx expo start` and scan
  again.
- **Changed network?** Restart `expo start` and re-scan — the dev client
  remembers servers, but a fresh URL is safest.
- **Pulled new native code** (new expo module / gradle change)? Rebuild and
  reinstall the dev client — JS-only changes don't need a rebuild.

## Camera scanning (barcode) — requires a rebuild once

Barcode scanning uses **`expo-camera`** (a native module). The current dev
build predates it, so **rebuild the dev client once** (EAS `--profile
development` or `pnpm android`) before the camera scan button on the Products
screen works. The label PDF export (`expo-print`), barcode display
(`react-native-svg`) and everything else in this release are JS-only and hot
reload normally. See `docs/features.md` rows 22–25 for the full feature set.

## Android builds via EAS Build

`eas.json` profiles:

| Profile | Output | Use |
|---|---|---|
| `development` | **dev-client** APK (`developmentClient: true`) | QR / hot-reload workflow above |
| `preview` | release APK | internal testers |
| `release` | AAB | Play Store |

```bash
npx eas-cli build --platform android --profile preview   # release APK
npx eas-cli build --platform android --profile release   # store AAB
```

CI: `.github/workflows/mobile-build.yml` (manual) builds the APK directly
with Gradle — no EAS required. Choose `debug` (dev-client shell, loads JS from
Metro) or `release` (bundled JS, debug-signed) and grab the APK from the
Actions artifact. Needs JDK 17 + Android SDK on the runner (both set up by the
workflow).

## Monorepo notes

- `@munim/core` — all business logic + the shared Neon client (fetch-based,
  works on Hermes).
- `@munim/theme` — shared design tokens (colors/radius); mobile consumes
  `mobileColors`. See `docs/theme.md`.
- `metro.config.js` adds the workspace root to `watchFolders` and
  `nodeModulesPaths` so the workspace packages resolve through pnpm.
- The Android package is `com.munim`; the JS entry registers the `Munim` app
  (see `app.json` + `MainActivity.kt`).
- Native projects (`android/`, `ios/`) are committed and regenerated with
  `npx expo prebuild` when app config changes (non-CNG workflow).
