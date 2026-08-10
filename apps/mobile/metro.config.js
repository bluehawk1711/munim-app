/**
 * Metro config for the Expo SDK 57 + pnpm monorepo: watch the repo root so
 * @munim/core (a workspace package) is picked up, and resolve node_modules at
 * both the app level and the workspace root. Uses expo/metro-config so the
 * dev client and expo modules resolve correctly.
 * @format
 */

const path = require('path');
const {getDefaultConfig} = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
