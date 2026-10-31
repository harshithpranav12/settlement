// capture_refined_screenshot.mjs
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

// Find asset filenames
const assetsDir = path.join(distDir, 'assets');
const assetFiles = fs.readdirSync(assetsDir);
const jsFile = assetFiles.find(f => f.startsWith('index-') && f.endsWith('.js'));
const cssFile = assetFiles.find(f => f.startsWith('index-') && f.endsWith('.css'));

if (!jsFile || !cssFile) {
  console.error('Could not locate built assets in dist/assets');
  process.exit(1);
}

console.log(`Using JS bundle: ${jsFile}`);
console.log(`Using CSS bundle: ${cssFile}`);

const verifyHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TRACE AI — Phase 5.2.1 Browser Verification</title>
    <link rel="stylesheet" crossorigin href="./assets/${cssFile}">
    <script>
      window.__CONSOLE_ERRORS__ = [];
      window.__CONSOLE_LOGS__ = [];
      const origErr = console.error;
      console.error = function(...args) {
        window.__CONSOLE_ERRORS__.push(args.join(' '));
        origErr.apply(console, args);
      };
      const origLog = console.log;
      console.log = function(...args) {
        window.__CONSOLE_LOGS__.push(args.join(' '));
        origLog.apply(console, args);
      };
      window.addEventListener('error', (e) => {
        window.__CONSOLE_ERRORS__.push(e.message || String(e));
      });
    </script>
    <script type="module" crossorigin src="./assets/${jsFile}"></script>
  </head>
  <body class="bg-[#F5F4EF] text-[#25364A] antialiased">
    <div id="root"></div>

    <script>
      (async function runAutomatedVerification() {
        const results = {
          timestamp: new Date().toISOString(),
          tests: [],
          errors: [],
          logsCount: 0
        };

        function recordTest(name, passed, detail) {
          results.tests.push({ name, status: passed ? 'PASS' : 'FAIL', detail: detail || '' });
        }

        // Wait for React to mount
        await new Promise(r => setTimeout(r, 1200));

        try {
          const root = document.getElementById('root');
          recordTest('DOM Mount', !!root && root.children.length > 0, \`Root children: \${root?.children.length}\`);

          // Find 3D Reconstruction navigation button
          const buttons = Array.from(document.querySelectorAll('button, a'));
          const reconTabBtn = buttons.find(b => b.innerText.trim().includes('3D Reconstruction'));
          
          if (reconTabBtn) {
            reconTabBtn.click();
            recordTest('Navigation to 3D Reconstruction', true, 'Clicked 3D Reconstruction button');
          } else {
            recordTest('Navigation to 3D Reconstruction', false, '3D Reconstruction button not found');
          }

          // Wait 2.0s for Three.js canvas & models to mount and render
          await new Promise(r => setTimeout(r, 2000));

          // Check canvas element
          const canvas = document.querySelector('canvas');
          recordTest('Three.js Canvas Initialization', !!canvas, canvas ? \`Canvas size: \${canvas.width}x\${canvas.height}\` : 'Canvas not found');

          // Check for Vehicle Telemetry inspector & Source Record Reference (handle CSS uppercase)
          const bodyText = document.body.innerText;
          const hasSourceRecordRef = bodyText.toUpperCase().includes('SOURCE RECORD REFERENCE');
          recordTest('Source Record Reference Terminology', hasSourceRecordRef, 'Source Record Reference verified');

          // Check that old Chain-of-Custody is NOT in inspector
          const hasOldChainOfCustody = bodyText.includes('Chain-of-Custody Reference');
          recordTest('Old Chain-of-Custody Removed', !hasOldChainOfCustody, 'Old Chain-of-Custody successfully removed');

          // Check for Simulated consistency in Sidebar
          const hasSimulatedConsistency = bodyText.includes('Simulated consistency');
          recordTest('Audited Simulated Consistency Label', hasSimulatedConsistency, 'Simulated consistency verified in sidebar');

          // Check for Vehicle Badges (V1, V2, V3)
          const hasV1 = bodyText.includes('V1');
          const hasV2 = bodyText.includes('V2');
          const hasV3 = bodyText.includes('V3');
          recordTest('All 3 Vehicles Present', hasV1 && hasV2 && hasV3, 'V1, V2, V3 detected in inspector');

          // Switch to Collision & Evidence Tab
          const evidenceTabBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Collision & Evidence'));
          if (evidenceTabBtn) {
            evidenceTabBtn.click();
          }

          await new Promise(r => setTimeout(r, 600));

          // Check for Provisional Reference Origin label
          const afterTabSwitchText = document.body.innerText;
          const originLabel = afterTabSwitchText.includes('Provisional Reference Origin') || afterTabSwitchText.includes('PROVISIONAL') || afterTabSwitchText.includes('37.541565');
          recordTest('Provisional Reference Origin Render', originLabel, 'Provisional reference origin (37.541565, -77.437165) verified');

          // Check for 5-channel Collision Assessment
          const collisionIndeterminate = afterTabSwitchText.includes('INDETERMINATE');
          recordTest('Collision Status INDETERMINATE', collisionIndeterminate, 'GPS contact status INDETERMINATE verified');

          // Switch back to Vehicle tab for screenshot
          const vehTabBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Vehicle Telemetry'));
          if (vehTabBtn) {
            vehTabBtn.click();
          }
          await new Promise(r => setTimeout(r, 600));

          // Check for Zero Errors
          recordTest('Browser Console Errors', window.__CONSOLE_ERRORS__.length === 0, \`Errors: \${window.__CONSOLE_ERRORS__.join('; ') || 'None'}\`);

        } catch (err) {
          recordTest('Automated Test Execution', false, err.message);
        }

        results.errors = window.__CONSOLE_ERRORS__;
        results.logsCount = window.__CONSOLE_LOGS__.length;

        const pre = document.createElement('pre');
        pre.id = 'BROWSER_VERIFICATION_RESULTS';
        pre.style.display = 'none';
        pre.textContent = JSON.stringify(results, null, 2);
        document.body.appendChild(pre);
      })();
    </script>
  </body>
</html>`;

const verifyHtmlPath = path.join(distDir, 'index_verify.html');
fs.writeFileSync(verifyHtmlPath, verifyHtml, 'utf8');
console.log(`Generated verification harness at: ${verifyHtmlPath}`);
