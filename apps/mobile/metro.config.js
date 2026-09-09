/**
 * Metro config for the Expo SDK 57 + pnpm monorepo.
 *
 * In pnpm workspaces the virtual store (.pnpm) isolates each package's deps,
 * so when expo (resolved from .pnpm) imports expo-asset, Metro can't find it.
 * We fix this by:
 *   1. Watching the monorepo root so @munim/* workspace packages are found
 *   2. Using extraNodeModules to redirect bare imports to the app's own
 *      node_modules (where pnpm installs direct deps), which Metro resolves
 *      before falling back to hierarchical lookup
 *   3. Keeping nodeModulesPaths for workspace package resolution
 *
 * @format
 */

const path = require('path');
const {getDefaultConfig} = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const appNodeModules = path.resolve(projectRoot, 'node_modules');
const rootNodeModules = path.resolve(monorepoRoot, 'node_modules');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [appNodeModules, rootNodeModules];

config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => {
      const strs = typeof name === 'string' ? name : String(name);
      for (const dir of [appNodeModules, rootNodeModules]) {
        try {
          require('fs').statSync(path.join(dir, strs));
          return dir;
        } catch {}
      }
      return appNodeModules;
    },
  },
);

module.exports = config;
