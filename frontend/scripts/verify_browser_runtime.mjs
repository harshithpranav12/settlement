// verify_browser_runtime.mjs
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.csv': 'text/csv'
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

const PORT = 4174;
server.listen(PORT, async () => {
  console.log(`Static preview server listening on http://localhost:${PORT}`);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const debuggingPort = 9223;

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debuggingPort}`,
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}`
  ]);

  console.log('Launched Headless Chrome on debugging port', debuggingPort);

  // Wait 2.5s for Chrome to initialize
  await new Promise(r => setTimeout(r, 2500));

  try {
    // Query Chrome DevTools Protocol targets
    const versionRes = await fetch(`http://127.0.0.1:${debuggingPort}/json/version`);
    const versionData = await versionRes.json();
    console.log('Chrome Browser Version:', versionData.Browser);

    const targetsRes = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find(t => t.type === 'page');

    if (!pageTarget) {
      console.error('No page target found');
      cleanup(1);
      return;
    }

    console.log('Page Target URL:', pageTarget.url);

    // Connect WebSocket
    const wsUrl = pageTarget.webSocketDebuggerUrl;
    const WebSocket = (await import('ws')).default || globalThis.WebSocket;
    
    // If ws package is not available, we can read console logs via CDP HTTP or a simple evaluation
    console.log('Testing page title and console via CDP...');

    const ws = new WebSocket(wsUrl);
    const consoleLogs = [];
    const runtimeErrors = [];

    let msgId = 1;
    const pending = new Map();

    function sendCmd(method, params = {}) {
      const id = msgId++;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    ws.on('open', async () => {
      console.log('CDP WebSocket connected');
      await sendCmd('Runtime.enable');
      await sendCmd('Log.enable');

      // Wait 3 seconds to let React mount and initialize
      await new Promise(r => setTimeout(r, 3000));

      // Evaluate document title and root HTML
      const evalRes = await sendCmd('Runtime.evaluate', {
        expression: '({ title: document.title, rootContent: document.getElementById("root")?.innerText.slice(0, 100) })',
        returnByValue: true
      });

      console.log('Page Evaluation Result:', evalRes.result?.value);

      // Check for navigation links
      const navRes = await sendCmd('Runtime.evaluate', {
        expression: 'Array.from(document.querySelectorAll("button, a")).map(el => el.innerText.trim()).filter(Boolean)',
        returnByValue: true
      });
      console.log('Navigation items found:', navRes.result?.value?.slice(0, 8));

      console.log('\n--- BROWSER CONSOLE REPORT ---');
      console.log(`Total console messages: ${consoleLogs.length}`);
      console.log(`Total runtime errors: ${runtimeErrors.length}`);

      if (runtimeErrors.length > 0) {
        console.error('Runtime Errors:', runtimeErrors);
        cleanup(1);
      } else {
        console.log('✅ ZERO RUNTIME ERRORS DETECTED IN BROWSER CONSOLE');
        cleanup(0);
      }
    });

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

    ws.on('error', (err) => {
      console.error('WebSocket error:', err.message);
      cleanup(1);
    });

  } catch (err) {
    console.error('Browser check error:', err.message);
    cleanup(1);
  }

  function cleanup(code) {
    try { chromeProc.kill(); } catch (e) {}
    server.close(() => {
      process.exit(code);
    });
  }
});
