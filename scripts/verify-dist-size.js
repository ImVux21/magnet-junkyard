import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function getDirectorySize(dirPath) {
  let total = 0;
  if (!fs.existsSync(dirPath)) {
    return 0;
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += getDirectorySize(fullPath);
    } else {
      total += fs.statSync(fullPath).size;
    }
  }
  return total;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let distPath = fs.existsSync('dist') ? fs.realpathSync(path.resolve('dist')) : path.resolve('dist');
if (!fs.existsSync(distPath)) {
  const fallback = path.resolve(__dirname, '../dist');
  distPath = fs.existsSync(fallback) ? fs.realpathSync(fallback) : fallback;
}
if (!fs.existsSync(distPath)) {
  console.error('[Error] dist/ directory not found. Please run "npm run build" first.');
  process.exit(1);
}

const totalBytes = getDirectorySize(distPath);
const maxBytes = 10 * 1024 * 1024; // 10MB = 10,485,760 bytes
const sizeMB = (totalBytes / (1024 * 1024)).toFixed(2);

console.log(`[Portal Compliance] Total uncompressed dist/ size: ${sizeMB} MB (${totalBytes.toLocaleString()} bytes / ${maxBytes.toLocaleString()} bytes max).`);

if (totalBytes >= maxBytes) {
  console.error(`[FAILED] dist/ size exceeds 10MB limit! (${totalBytes} >= ${maxBytes})`);
  process.exit(1);
}

console.log('[PASSED] dist/ size is strictly under 10MB.');
process.exit(0);
