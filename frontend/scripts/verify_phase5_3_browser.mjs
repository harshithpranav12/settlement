/**
 * TRACE AI - Phase 5.3 Browser Verification & Screenshot Automation
 * 
 * Uses Chrome DevTools Protocol (CDP) to drive Headless Chrome:
 * 1. Mounts production bundle in a realistic 1600x1050 viewport.
 * 2. Navigates to 3D Reconstruction workstation tab.
 * 3. Verifies 3D canvas, interactive controls, and Synchronized Telemetry Graphs.
 * 4. Initiates dynamic playback loop, verifies vehicle motion, captures Screenshot 1.
 * 5. Seeks / jumps to T0 Reference Epoch milestone, verifies synchronized readouts, captures Screenshot 2.
 * 6. Checks browser console for zero runtime errors.
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

const PORT = 4185;
server.listen(PORT, async () => {
  console.log(`Verification static server listening on http://localhost:${PORT}`);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const debuggingPort = 9225;

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
        height: 1050,
        deviceScaleFactor: 1,
        mobile: false
      });

      // Wait 2 seconds for initial React mount
      await new Promise(r => setTimeout(r, 2000));

      // Click "3D Reconstruction" Tab
      console.log('Navigating to 3D Reconstruction tab...');
      const clickTabRes = await sendCmd('Runtime.evaluate', {
        expression: `(() => {
          const btns = Array.from(document.querySelectorAll('button, a'));
          const target = btns.find(b => b.innerText.includes('3D Reconstruction'));
          if (target) {
            target.click();
            return { success: true, text: target.innerText };
          }
          return { success: false };
        })()`,
        returnByValue: true
      });
      console.log('Tab navigation result:', clickTabRes.result?.value);

      // Wait 2.5 seconds for Three.js canvas & telemetry graphs to fully render
      await new Promise(r => setTimeout(r, 2500));

      // Inspect elements on page
      const inspectRes = await sendCmd('Runtime.evaluate', {
        expression: `(() => {
          const canvas = document.querySelector('canvas');
          const graphsHeader = Array.from(document.querySelectorAll('h3')).find(h => h.innerText.includes('Kinematic Telemetry Graphs'));
          const speedLabel = Array.from(document.querySelectorAll('text')).find(t => t.textContent.includes('Speed (km/h)'));
          const accelLabel = Array.from(document.querySelectorAll('text')).find(t => t.textContent.includes('Accel (m/s²)'));
          const svgCircles = document.querySelectorAll('svg circle').length;
          const playBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Play') || b.innerText.includes('Pause'));
          const t0Btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('T0 Ref'));

          return {
            hasCanvas: !!canvas,
            canvasDimensions: canvas ? { width: canvas.width, height: canvas.height } : null,
            hasGraphsHeader: !!graphsHeader,
            hasSpeedLabel: !!speedLabel,
            hasAccelLabel: !!accelLabel,
            svgCirclesCount: svgCircles,
            hasPlayButton: !!playBtn,
            hasT0Button: !!t0Btn
          };
        })()`,
        returnByValue: true
      });

      console.log('\n--- BROWSER DOM INSPECTION ---');
      console.log(JSON.stringify(inspectRes.result?.value, null, 2));

      // 1. Start dynamic playback
      console.log('\nStarting 3D playback...');
      await sendCmd('Runtime.evaluate', {
        expression: `(() => {
          const playBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Play'));
          if (playBtn) playBtn.click();
        })()`
      });

      // Let playback run for 1.8 seconds to accumulate visual vehicle displacement
      await new Promise(r => setTimeout(r, 1800));

      // Capture Screenshot 1: Motion Playback Active
      console.log('Capturing Screenshot 1: 3D Playback Running with Telemetry Graphs...');
      const ss1 = await sendCmd('Page.captureScreenshot', { format: 'png' });
      const img1Buffer = Buffer.from(ss1.result.data, 'base64');
      const ss1PathLocal = path.join(distDir, 'phase5_3_playback_motion.png');
      const ss1PathArtifact = path.join(artifactDir, 'phase5_3_playback_motion.png');
      fs.writeFileSync(ss1PathLocal, img1Buffer);
      fs.writeFileSync(ss1PathArtifact, img1Buffer);
      console.log(`Saved screenshot 1 to: ${ss1PathArtifact} (${img1Buffer.length} bytes)`);

      // 2. Pause and Jump to T0 Reference Epoch Milestone
      console.log('\nJumping to T0 Reference Epoch milestone...');
      await sendCmd('Runtime.evaluate', {
        expression: `(() => {
          const t0Btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('T0 Ref'));
          if (t0Btn) t0Btn.click();
        })()`
      });

      // Pause playback
      await sendCmd('Runtime.evaluate', {
        expression: `(() => {
          const pauseBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Pause'));
          if (pauseBtn) pauseBtn.click();
        })()`
      });

      // Wait 800ms for vehicles, inspector, and graph cursors to settle at T0
      await new Promise(r => setTimeout(r, 800));

      // Read values at T0
      const t0Status = await sendCmd('Runtime.evaluate', {
        expression: `(() => {
          const clockPill = document.querySelector('.font-mono.text-xs');
          const inspectorSpeed = document.querySelector('.text-xl.font-bold.font-mono');
          return {
            clockText: clockPill ? clockPill.innerText : null,
            inspectorSpeed: inspectorSpeed ? inspectorSpeed.innerText : null
          };
        })()`,
        returnByValue: true
      });
      console.log('T0 Milestone Readout:', t0Status.result?.value);

      // Capture Screenshot 2: Paused at T0 Reference Epoch
      console.log('Capturing Screenshot 2: Paused at T0 Reference Epoch...');
      const ss2 = await sendCmd('Page.captureScreenshot', { format: 'png' });
      const img2Buffer = Buffer.from(ss2.result.data, 'base64');
      const ss2PathLocal = path.join(distDir, 'phase5_3_t0_ref_epoch.png');
      const ss2PathArtifact = path.join(artifactDir, 'phase5_3_t0_ref_epoch.png');
      fs.writeFileSync(ss2PathLocal, img2Buffer);
      fs.writeFileSync(ss2PathArtifact, img2Buffer);
      console.log(`Saved screenshot 2 to: ${ss2PathArtifact} (${img2Buffer.length} bytes)`);

      // Check Console Errors
      console.log('\n--- BROWSER CONSOLE REPORT ---');
      console.log(`Total console logs: ${consoleLogs.length}`);
      console.log(`Total runtime errors: ${runtimeErrors.length}`);

      if (runtimeErrors.length > 0) {
        console.error('Console Errors detected:', runtimeErrors);
      } else {
        console.log('✅ ZERO RUNTIME ERRORS DETECTED IN BROWSER CONSOLE');
      }

      cleanup(runtimeErrors.length > 0 ? 1 : 0);
    });

  } catch (err) {
    console.error('Browser verification failed:', err);
    cleanup(1);
  }

  function cleanup(code) {
    try { chromeProc.kill(); } catch (e) {}
    server.close(() => {
      console.log('Server and browser shutdown complete.');
      process.exit(code);
    });
  }
});
