#!/usr/bin/env node
/**
 * Local Android build — no EAS required.
 *
 *   pnpm build:android          → debug APK  (the dev client)
 *   pnpm build:android:release  → release APK
 *
 * Rebuilds @munim/core and @munim/theme first (the mobile JS bundles resolve
 * their dist output — same "dependsOn ^build" convention as turbo), then runs
 * the Gradle wrapper. Works on Windows (gradlew.bat), macOS and Linux.
 *
 * Prerequisites: JDK 17+ and the Android SDK (ANDROID_HOME or local.properties).
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const mobileDir = join(here, "..");
const repoRoot = join(here, "..", "..", "..");
const androidDir = join(mobileDir, "android");

const isRelease = process.argv.includes("--variant=release");
const variant = isRelease ? "release" : "debug";
const win32 = process.platform === "win32";

function run(cmd, args, cwd) {
  const res = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: win32 });
  if (res.error) {
    console.error(`\nFailed to run: ${cmd} ${args.join(" ")}`);
    console.error(res.error.message);
    process.exit(1);
  }
  return res.status ?? 1;
}

console.log(`→ Building shared packages (@munim/core, @munim/theme)…`);
for (const pkg of ["core", "theme"]) {
  const status = run("pnpm", ["--filter", `@munim/${pkg}`, "build"], repoRoot);
  if (status !== 0) process.exit(status);
}

if (!existsSync(androidDir)) {
  console.error(
    "\n✗ No android/ directory found at apps/mobile/android.\n" +
      "  Run `npx expo prebuild --platform android` to generate the native project first.",
  );
  process.exit(1);
}

const gradlew = win32 ? "gradlew.bat" : "./gradlew";
const task = isRelease ? ":app:assembleRelease" : ":app:assembleDebug";
console.log(`\n→ Running Gradle ${task} (first run downloads Gradle 9.3.1 + deps — be patient)…\n`);

// On Linux/macOS the Gradle wrapper needs the exec bit; git may not preserve
// it (checked out from Windows), which shows up in CI as `spawnSync ./gradlew
// EACCES`. Make it executable defensively before running.
if (!win32) {
  try {
    chmodSync(join(androidDir, "gradlew"), 0o755);
  } catch {
    // ignore — the file may already be executable
  }
}

const status = run(gradlew, [task], androidDir);
if (status !== 0) {
  console.error("\n✗ Android build failed — see the Gradle output above.");
  process.exit(status);
}

const apkName = isRelease ? "app-release.apk" : "app-debug.apk";
const apkPath = join(androidDir, "app", "build", "outputs", "apk", variant, apkName);
console.log(`\n✅ Android ${variant} build complete:`);
console.log(`   ${apkPath}`);
console.log("\nInstall on a connected device with:");
console.log(`   adb install -r "${apkPath}"`);
