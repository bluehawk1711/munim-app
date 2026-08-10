/**
 * Metro config for the pnpm monorepo: watch the repo root so @munim/core
 * (a workspace package) is picked up, and resolve node_modules at both the
 * app level and the workspace root.
 * @format
 */

const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const config = {
  watchFolders: [path.resolve(__dirname, '../../')],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname, '../../node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
