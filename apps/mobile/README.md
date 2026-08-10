# Munim Mobile (React Native)

On-the-go shop management for Android & iOS: dashboard, stock, quick sales,
billing (shared bill generation), khata (advances given/taken) and settings.
Scaffolded from the official
[`react-native-community/template`](https://github.com/react-native-community/template)
(stable tag `0.86.2`, bare React Native + TypeScript) and wired to
`@munim/core` — the app connects **directly** to the shared Neon database.

## Development

```bash
pnpm install
cd apps/mobile
pnpm start          # Metro
pnpm android        # or: pnpm ios
```

On first launch, open **Settings** and paste your Neon connection string
(`postgresql://user:pass@host/db?sslmode=require`). It is stored on-device
with AsyncStorage.

## Android dev build via EAS Build

EAS Build builds the bare-RN project from its `android/` directory (no `expo`
package needed).

```bash
# one-time: login + configure
npx eas-cli login
npx eas-cli build:configure      # reads eas.json

# development build = debug APK (:app:assembleDebug)
npx eas-cli build --platform android --profile development

# install on a device / emulator
npx eas-cli install
```

`eas.json` profiles:

| Profile | Output |
|---|---|
| `development` | debug APK (`:app:assembleDebug`) — for development |
| `preview` | release APK for internal testers |
| `release` | AAB for the Play Store |

CI: `.github/workflows/mobile-eas-build.yml` runs `eas build --platform android
--profile development` on push/manual and needs the `EXPO_TOKEN` secret.

## Monorepo notes

- `metro.config.js` adds the workspace root to `watchFolders` and
  `nodeModulesPaths` so `@munim/core` resolves through pnpm.
- The Android package is `com.munim`; the JS entry registers the `Munim` app
  (see `app.json` + `MainActivity.kt`).
