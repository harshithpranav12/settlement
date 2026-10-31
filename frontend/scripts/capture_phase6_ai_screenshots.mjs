/**
 * TRACE AI — Phase 6 Visual Verification & Deliverables Script
 * Captures high-resolution forensic screenshots of all Phase 6 AI features using Headless Chrome CDP.
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
const deliverablesDir = 'C:\\Users\\AGASTYA\\TRACE-AI\\deliverables\\phase_6_ai_intelligence';

if (!fs.existsSync(deliverablesDir)) {
  fs.mkdirSync(deliverablesDir, { recursive: true });
}

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

const PORT = 4192;
server.listen(PORT, async () => {
  console.log(`Phase 6 Static Server listening on http://localhost:${PORT}`);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const debuggingPort = 9232;

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debuggingPort}`,
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `http://localhost:${PORT}`
  ]);

  console.log('Launched Headless Chrome on port', debuggingPort);
  await new Promise((r) => setTimeout(r, 2500));

  try {
    const targetsRes = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page');

    if (!pageTarget) {
      throw new Error('No page target found');
    }

    const WebSocket = globalThis.WebSocket;
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    let msgId = 1;
    const pending = new Map();

    function sendCmd(method, params = {}) {
      const id = msgId++;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.id && pending.has(msg.id)) {
        const resolve = pending.get(msg.id);
        pending.delete(msg.id);
        resolve(msg);
      }
    });

    await new Promise((resolve) => ws.addEventListener('open', resolve));

    // Enable Domains & Set High-Res Viewport
    await sendCmd('Page.enable');
    await sendCmd('Runtime.enable');
    await sendCmd('DOM.enable');
    await sendCmd('Emulation.setDeviceMetricsOverride', {
      width: 1680,
      height: 1050,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Waiting for application to load and stabilize...');
    await new Promise((r) => setTimeout(r, 3000));

    async function captureAndSave(filename) {
      const snap = await sendCmd('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(snap.result.data, 'base64');
      const delivPath = path.join(deliverablesDir, filename);
      const artifactPath = path.join(artifactDir, filename);
      fs.writeFileSync(delivPath, buf);
      fs.writeFileSync(artifactPath, buf);
      console.log(`Saved screenshot: ${filename} (${buf.length} bytes)`);
      return { delivPath, artifactPath, size: buf.length };
    }

    async function evalCode(expression) {
      return await sendCmd('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
      });
    }

    // -------------------------------------------------------------------------
    // 1. Capture AI Witness Statement Understanding & Event Extraction
    // -------------------------------------------------------------------------
    console.log('\n--- Capturing Feature 1: Witness Statement Extraction ---');
    await evalCode(`window.__setActiveTab('ai-intelligence');`);
    await new Promise((r) => setTimeout(r, 1500));

    // Select the Specification Test Statement (Prompt Example)
    await evalCode(`
      const testStmtBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Specification Test Statement') || b.textContent.includes('blue sedan'));
      if (testStmtBtn) testStmtBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 800));

    // Trigger AI Analysis
    await evalCode(`
      const analyzeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Analyze Statement & Extract Events'));
      if (analyzeBtn) analyzeBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 2200));

    // Correlate events with timeline
    await evalCode(`
      const corrBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Cross-Reference with Timeline'));
      if (corrBtns.length > 0) corrBtns[0].click();
      if (corrBtns.length > 1) corrBtns[1].click();
    `);
    await new Promise((r) => setTimeout(r, 1500));

    await captureAndSave('phase6_witness_statement_extraction.png');

    // -------------------------------------------------------------------------
    // 2. Capture AI Investigator Assistant Drawer
    // -------------------------------------------------------------------------
    console.log('\n--- Capturing Feature 2: AI Investigator Assistant ---');
    await evalCode(`window.__setIsAssistantDrawerOpen(true);`);
    await new Promise((r) => setTimeout(r, 1200));

    // Click recommended questions
    await evalCode(`
      const promptBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Which vehicles show braking activity?'));
      if (promptBtn) promptBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 2000));

    await evalCode(`
      const epochPromptBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('immediately before the reference epoch'));
      if (epochPromptBtn) epochPromptBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 2000));

    await captureAndSave('phase6_ai_investigator_assistant.png');

    // Close drawer
    await evalCode(`window.__setIsAssistantDrawerOpen(false);`);
    await new Promise((r) => setTimeout(r, 1000));

    // -------------------------------------------------------------------------
    // 3. Capture Contradiction Cross-Examination Analysis
    // -------------------------------------------------------------------------
    console.log('\n--- Capturing Feature 3: Contradiction Cross-Examination Analysis ---');
    await evalCode(`window.__setActiveTab('contradictions');`);
    await new Promise((r) => setTimeout(r, 2000));

    await evalCode(`
      const synthBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Synthesize AI'));
      if (synthBtn) synthBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 2000));

    await captureAndSave('phase6_contradiction_cross_examination.png');

    // -------------------------------------------------------------------------
    // 4. Capture AI-Assisted Narrative Investigation Summary in Report
    // -------------------------------------------------------------------------
    console.log('\n--- Capturing Feature 4: AI Narrative Summary in Report ---');
    await evalCode(`window.__setActiveTab('reports');`);
    await new Promise((r) => setTimeout(r, 2500));

    await evalCode(`
      const hSection = Array.from(document.querySelectorAll('h3, div, section')).find(el => el.textContent.includes('AI-Assisted Narrative Investigation Summary'));
      if (hSection) hSection.scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise((r) => setTimeout(r, 1200));

    await captureAndSave('phase6_ai_narrative_summary_report.png');

    console.log('\n>>> ALL 4 PHASE 6 SCREENSHOTS CAPTURED SUCCESSFULLY! <<<\n');

    ws.close();
    chromeProc.kill();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('Fatal screenshot capture error:', err);
    chromeProc.kill();
    server.close();
    process.exit(1);
  }
});
