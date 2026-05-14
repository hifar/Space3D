/**
 * copy-babylon.js
 * Copies BabylonJS UMD bundles from node_modules into renderer/babylon/
 * Run once after npm install: node copy-babylon.js
 */
const fs   = require('fs');
const path = require('path');

const nm   = path.join(__dirname, 'node_modules');
const dest = path.join(__dirname, 'renderer', 'babylon');
if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

// Each entry: [source relative to node_modules, destination filename]
const files = [
  ['babylonjs/babylon.max.js',             'babylon.js'],
  ['babylonjs-loaders/babylonjs.loaders.js','babylonjs.loaders.js'],
  ['babylonjs-materials/babylonjs.materials.js','babylonjs.materials.js'],
];

let ok = true;
for (const [src, dstName] of files) {
  const srcPath = path.join(nm, src);
  if (!fs.existsSync(srcPath)) {
    console.warn(`⚠  Not found: ${srcPath}`);
    ok = false;
    continue;
  }
  const dstPath = path.join(dest, dstName);
  fs.copyFileSync(srcPath, dstPath);
  const kb = Math.round(fs.statSync(dstPath).size / 1024);
  console.log(`✓  ${dstName}  (${kb} KB)`);
}

if (ok) {
  console.log('\nAll BabylonJS files copied to renderer/babylon/');
} else {
  console.error('\nMissing files. Run: npm install babylonjs babylonjs-loaders babylonjs-materials');
  process.exit(1);
}
