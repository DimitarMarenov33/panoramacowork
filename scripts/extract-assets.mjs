#!/usr/bin/env node
// Extracts the four embedded photos (logo, desk, interior, promenade) from the
// original beta HTML file — the one with the big base64 ASSETS object — and
// writes them to img/*.jpg, where index.html expects them.
//
// Usage:  node scripts/extract-assets.mjs /path/to/original-beta.html

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/extract-assets.mjs /path/to/original-beta.html');
  process.exit(1);
}

const html = readFileSync(src, 'utf8');
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'img');
mkdirSync(outDir, { recursive: true });

const re = /(logo|desk|interior|promenade)\s*:\s*"data:image\/(jpeg|jpg|png);base64,([^"]+)"/g;
let match;
let found = 0;
while ((match = re.exec(html)) !== null) {
  const [, name, type, b64] = match;
  const ext = type === 'png' ? 'png' : 'jpg';
  const file = join(outDir, `${name}.${ext}`);
  writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log(`✓ ${name}.${ext} (${Math.round(b64.length * 0.75 / 1024)} KB)`);
  found++;
}

if (found === 0) {
  console.error('No embedded images found — is this the original beta HTML with the ASSETS object?');
  process.exit(1);
}
console.log(`\nDone — ${found} image(s) written to img/. Commit them and redeploy.`);
