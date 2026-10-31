/**
 * TRACE AI — Phase 5.5 Browser Verification, PDF Generation & Screenshot Automation
 * 
 * Uses Chrome DevTools Protocol (CDP) to drive Headless Chrome:
 * 1. Mounts production build at 1600x1100 viewport.
 * 2. Navigates to Forensic Technical Investigation Report (Phase 5.5).
 * 3. Audits all required sections A through G in the live DOM.
 * 4. Captures high-res screenshots for visual verification:
 *    - phase5_5_forensic_report_overview.png
 *    - phase5_5_forensic_report_analysis.png
 * 5. Uses CDP Page.printToPDF to render the complete high-fidelity PDF report:
 *    - Forensic_Investigation_Report_INC-2026-0884.pdf
 * 6. Checks for zero runtime/console errors.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');
const artifactDir = 'C:\\Users\\AGASTYA\\.gemini\\antigravity\\brain\\4c1adea1-99b3-4d08-9c78-0374bb24ef5e';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.png': 'image/png'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  
  let filePath = path.join(distDir, reqPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(distDir, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Error loading file');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

const PORT = 4188;
server.listen(PORT, async () => {
  console.log(`Phase 5.5 Static server listening on http://localhost:${PORT}`);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const debuggingPort = 9228;

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debuggingPort}`,
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `http://localhost:${PORT}`
  ]);

  console.log('Launched Headless Chrome on debugging port', debuggingPort);

  // Wait 2.5s for Chrome to initialize
  await new Promise(r => setTimeout(r, 2500));

  try {
    const targetsRes = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find(t => t.type === 'page');

    if (!pageTarget) {
      throw new Error('No page target found');
    }

    const wsUrl = pageTarget.webSocketDebuggerUrl;
    const WebSocket = (await import('ws')).default || globalThis.WebSocket;
    const ws = new WebSocket(wsUrl);

    let msgId = 1;
    const pending = new Map();
    const consoleLogs = [];
    const runtimeErrors = [];

    function sendCmd(method, params = {}) {
      const id = msgId++;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && pending.has(msg.id)) {
        const resolve = pending.get(msg.id);
        pending.delete(msg.id);
        resolve(msg);
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const type = msg.params.type;
        const text = msg.params.args.map(a => a.value || a.description || '').join(' ');
        consoleLogs.push({ type, text });
        if (type === 'error') {
          runtimeErrors.push(text);
        }
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const desc = msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text;
        runtimeErrors.push(desc);
      }
    });

    ws.on('open', async () => {
      console.log('Connected to Chrome DevTools Protocol WebSocket');

      await sendCmd('Page.enable');
      await sendCmd('Runtime.enable');
      await sendCmd('Log.enable');

      // Set workstation high-res viewport
      await sendCmd('Emulation.setDeviceMetricsOverride', {
        width: 1600,
        height: 1100,
        deviceScaleFactor: 1,
        mobile: false
      });

      // Wait 1.5s for initial React mount
      await new Promise(r => setTimeout(r, 1500));

      // 1. Click "Investigation Reports" in Sidebar
      console.log('Navigating to Investigation Reports tab...');
      const clickReportsRes = await sendCmd('Runtime.evaluate', {
        expression: `(() => {
          const btns = Array.from(document.querySelectorAll('button, a'));
          const target = btns.find(b => b.innerText.includes('Investigation Reports') || b.innerText.includes('Reports'));
          if (target) {
            target.click();
            return { success: true, text: target.innerText };
          }
          return { success: false };
        })()`,
        returnByValue: true
      });
      console.log('Report tab navigation result:', clickReportsRes.result?.value);

      // Wait 1.5s for Report to render
      await new Promise(r => setTimeout(r, 1500));

      // 2. Audit DOM Elements of Forensic Investigation Report
      console.log('\nAuditing Forensic Investigation Report on-screen DOM elements...');
      const domAuditRes = await sendCmd('Runtime.evaluate', {
        expression: `(() => {
          const text = document.body.innerText;
          return {
            hasReportRef: text.includes('REP-2026-0884-FR1'),
            hasSimulatedDataBanner: text.includes('SIMULATED / DEMONSTRATION DATA'),
            hasSectionA: text.includes('A. Incident Overview & Reconstruction Scope'),
            hasSectionB: text.includes('B. Reconstructed Event Sequence'),
            hasSectionC: text.includes('C. Vehicle Kinematic Analysis & Trajectory Dynamics'),
            hasSectionD: text.includes('D. Evidentiary Contradiction & Cross-Examination Analysis'),
            hasSectionE: text.includes('E. Spatial Reconstruction & Bounding Geometry Assessment'),
            hasSectionF: text.includes('F. Evidence Quality, Provenance Taxonomy & Deficiency Manifest'),
            hasSectionG: text.includes('G. Investigator\'s Neutral Synthesis & Recommendations'),
            hasContactIndeterminate: text.includes('CONTACT INDETERMINATE'),
            hasObbGap: text.includes('0.309m') || text.includes('0.309'),
            hasExportPdfBtn: !!Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Export PDF Report')),
            hasExportDossierBtn: !!Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Export Dossier Data'))
          };
        })()`,
        returnByValue: true
      });
      console.log('DOM Audit Results:', domAuditRes.result?.value);

      // 3. Capture Screenshot 1: Overview & Top Sections
      console.log('\nCapturing Screenshot 1: Report Overview & Event Sequence...');
      const shot1Res = await sendCmd('Page.captureScreenshot', { format: 'png' });
      if (shot1Res.result?.data) {
        const shot1Path = path.join(artifactDir, 'phase5_5_forensic_report_overview.png');
        fs.writeFileSync(shot1Path, Buffer.from(shot1Res.result.data, 'base64'));
        console.log(`Saved screenshot 1 to: ${shot1Path}`);
      }

      // 4. Scroll down to Section D, E, F, G
      console.log('Scrolling down to Analysis, Spatial Assessment & Taxonomy sections...');
      await sendCmd('Runtime.evaluate', {
        expression: `(() => {
          const el = document.querySelector('main');
          if (el) el.scrollTop = 950;
          else window.scrollTo(0, 950);
        })()`
      });
      await new Promise(r => setTimeout(r, 800));

      // 5. Capture Screenshot 2: Kinematics, Contradictions, Spatial & Taxonomy
      console.log('Capturing Screenshot 2: Detailed Analysis & Findings...');
      const shot2Res = await sendCmd('Page.captureScreenshot', { format: 'png' });
      if (shot2Res.result?.data) {
        const shot2Path = path.join(artifactDir, 'phase5_5_forensic_report_analysis.png');
        fs.writeFileSync(shot2Path, Buffer.from(shot2Res.result.data, 'base64'));
        console.log(`Saved screenshot 2 to: ${shot2Path}`);
      }

      // 6. Generate the formal PDF Report using Page.printToPDF
      console.log('\nRendering high-fidelity PDF report via Page.printToPDF...');
      const pdfRes = await sendCmd('Page.printToPDF', {
        printBackground: true,
        paperWidth: 8.5,
        paperHeight: 11,
        marginTop: 0.35,
        marginBottom: 0.35,
        marginLeft: 0.35,
        marginRight: 0.35,
        preferCSSPageSize: true
      });

      if (pdfRes.result?.data) {
        const pdfDistPath = path.join(distDir, 'Forensic_Investigation_Report_INC-2026-0884.pdf');
        const pdfArtifactPath = path.join(artifactDir, 'Forensic_Investigation_Report_INC-2026-0884.pdf');
        const pdfBuffer = Buffer.from(pdfRes.result.data, 'base64');
        fs.writeFileSync(pdfDistPath, pdfBuffer);
        fs.writeFileSync(pdfArtifactPath, pdfBuffer);
        console.log(`Rendered PDF report (${pdfBuffer.length.toLocaleString()} bytes) to:`);
        console.log(`  - Dist: ${pdfDistPath}`);
        console.log(`  - Artifact: ${pdfArtifactPath}`);
      } else {
        console.error('Failed to generate PDF:', pdfRes);
      }

      // 7. Check for Zero Console Errors
      console.log('\nChecking for runtime errors...');
      console.log(`Runtime errors caught: ${runtimeErrors.length}`);
      if (runtimeErrors.length > 0) {
        console.error('Runtime Errors:', runtimeErrors);
      } else {
        console.log('Zero runtime errors confirmed.');
      }

      // Clean up
      ws.close();
      chromeProc.kill();
      server.close();
      console.log('\nVerification complete. Exiting cleanly.');
      process.exit(runtimeErrors.length > 0 ? 1 : 0);
    });

  } catch (err) {
    console.error('Verification script encountered error:', err);
    chromeProc.kill();
    server.close();
    process.exit(1);
  }
});
