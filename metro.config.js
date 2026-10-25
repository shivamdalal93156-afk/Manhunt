// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Limit parallel workers on Windows to prevent memory exhaustion / V8 crashes
config.maxWorkers = 2;

module.exports = config;
