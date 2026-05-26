const fs = require('fs');
const path = require('path');

/** Script to copy prebuilds for the current platform to build/Release directory. */

const prebuildsDir = path.join(__dirname, '../prebuilds', `${process.platform}-${process.arch}`);
const releaseDir = path.join(__dirname, '../build/Release');

if (!fs.existsSync(prebuildsDir)) {
  console.error('Prebuilds directory does not exist:', prebuildsDir);
  process.exit(1);
}

fs.mkdirSync(releaseDir, { recursive: true });
fs.cpSync(prebuildsDir, releaseDir, { recursive: true });