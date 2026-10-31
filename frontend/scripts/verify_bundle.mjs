// verify_bundle.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, '../dist');
const htmlPath = path.join(distDir, 'index.html');

if (!fs.existsSync(htmlPath)) {
  console.error('dist/index.html not found!');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
console.log('dist/index.html exists, size:', html.length, 'bytes');

const scriptMatches = html.match(/src="([^"]+)"/g) || [];
const cssMatches = html.match(/href="([^"]+)"/g) || [];

console.log('Script tags found:', scriptMatches);
console.log('CSS links found:', cssMatches);

scriptMatches.forEach(tag => {
  const relPath = tag.replace('src="', '').replace('"', '');
  const fullPath = path.join(distDir, relPath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ Asset verified: ${relPath} (${fs.statSync(fullPath).size} bytes)`);
  } else {
    console.error(`❌ Asset missing: ${relPath}`);
  }
});
