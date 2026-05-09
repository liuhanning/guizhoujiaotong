import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = resolve('.');
const OUTPUT = join(ROOT, 'data', 'guizhou_expressway_pois.json');
const PORT = 8123;
const DEBUG_PORT = 9223;
const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function findChrome() {
  const found = CHROME_CANDIDATES.find(path => existsSync(path));
  if (!found) throw new Error('未找到 Chrome 或 Edge');
  return found;
}

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
      const requested = url.pathname === '/' ? '/tools/amap_poi_collect.html' : decodeURIComponent(url.pathname);
      const filePath = normalize(join(ROOT, requested));
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      const body = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
  return new Promise(resolveServer => {
    server.listen(PORT, '127.0.0.1', () => resolveServer(server));
  });
}

function wait(ms) {
  return new Promise(resolveWait => setTimeout(resolveWait, ms));
}

async function waitJson(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      // keep polling until Chrome starts DevTools
    }
    await wait(300);
  }
  throw new Error(`等待超时：${url}`);
}

function cdpConnect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();

  socket.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { resolve: resolvePending, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
    else resolvePending(msg.result);
  });

  return new Promise((resolveSocket, rejectSocket) => {
    socket.addEventListener('open', () => {
      resolveSocket({
        send(method, params = {}) {
          const id = ++seq;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((resolvePending, reject) => {
            pending.set(id, { resolve: resolvePending, reject });
          });
        },
        close() {
          socket.close();
        }
      });
    }, { once: true });
    socket.addEventListener('error', rejectSocket, { once: true });
  });
}

async function main() {
  const server = await startServer();
  const chromePath = findChrome();
  const userDataDir = join(process.env.TEMP || 'C:\\tmp', 'guizhojiaotong-amap-profile');
  const url = `http://127.0.0.1:${PORT}/tools/amap_poi_collect.html`;
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    url
  ], { stdio: 'ignore' });

  try {
    const targets = await waitJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const page = targets.find(target => target.type === 'page') || targets[0];
    if (!page?.webSocketDebuggerUrl) throw new Error('未找到可调试页面');
    const cdp = await cdpConnect(page.webSocketDebuggerUrl);

    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    for (let i = 0; i < 120; i += 1) {
      const ready = await cdp.send('Runtime.evaluate', {
        expression: 'typeof window.collectGuizhouExpresswayPois === "function"',
        returnByValue: true
      });
      if (ready.result?.value === true) break;
      await wait(500);
      if (i === 119) throw new Error('点位数据获取函数加载超时');
    }

    const result = await cdp.send('Runtime.evaluate', {
      expression: `window.collectGuizhouExpresswayPois({
        delayMs: 350,
        pageSize: 25,
        maxPagesByType: {
          highway_service_area: 12,
          service_area: 12,
          gas_station: 4,
          rest_area: 8,
          toll_station: 8
        }
      })`,
      awaitPromise: true,
      returnByValue: true
    });

    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || '页面点位数据获取异常');
    }

    const payload = result.result.value;
    await mkdir(join(ROOT, 'data'), { recursive: true });
    await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
    console.log(`Wrote ${payload.clean_count} clean POIs (${payload.raw_count} raw) to ${OUTPUT}`);
    if (payload.failed_count) console.log(`Failures: ${payload.failed_count}`);
    cdp.close();
  } finally {
    chrome.kill();
    server.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
