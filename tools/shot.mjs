// Full-page screenshots through the Chrome DevTools Protocol (no npm deps).
// node tools/shot.mjs <url> <out.png> [width=1440] [height=900] [dpr=1] [mobile=0] [--eval=file.js]
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [url, out, w = '1440', h = '900', dpr = '1', mobile = '0', ...rest] = process.argv.slice(2);
if (!url || !out) { console.error('usage: node tools/shot.mjs <url> <out.png> [w] [h] [dpr] [mobile] [--eval=file.js] [--reduce]'); process.exit(1); }
const evalArg = rest.find((a) => a.startsWith('--eval='));
const reduce = rest.includes('--reduce');
const wait = Number((rest.find((a) => a.startsWith('--wait=')) || '--wait=2500').slice(7));

const candidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const bin = candidates.find((p) => existsSync(p));
if (!bin) { console.error('no chromium found'); process.exit(1); }

const port = 9300 + Math.floor(Math.random() * 500);
const args = [`--remote-debugging-port=${port}`, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  `--window-size=${w},${h}`, '--force-device-scale-factor=' + dpr, '--user-data-dir=' + process.env.TEMP + '\\shot-profile-' + port, 'about:blank'];
if (reduce) args.push('--force-prefers-reduced-motion');
const proc = spawn(bin, args, { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getTargets() {
  for (let i = 0; i < 60; i++) {
    try { const res = await fetch(`http://127.0.0.1:${port}/json`); return await res.json(); } catch { await sleep(250); }
  }
  throw new Error('devtools not reachable');
}

let id = 0; const pending = new Map();
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => resolve(ws); ws.onerror = reject;
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } };
  });
}
const send = (ws, method, params = {}) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej }); if (process.env.SHOT_DEBUG) console.error('>', method); ws.send(JSON.stringify({ id: mid, method, params })); });

try {
  const targets = await getTargets();
  const page = targets.find((t) => t.type === 'page');
  const ws = await connect(page.webSocketDebuggerUrl);
  await send(ws, 'Page.enable');
  await send(ws, 'Runtime.enable');
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: Number(w), height: Number(h), deviceScaleFactor: Number(dpr), mobile: mobile === '1' });
  if (mobile === '1') await send(ws, 'Emulation.setTouchEmulationEnabled', { enabled: true });
  await send(ws, 'Page.navigate', { url });
  await sleep(600);
  await send(ws, 'Runtime.evaluate', { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true });
  await send(ws, 'Runtime.evaluate', { expression: `(async () => {
    document.querySelectorAll('img[loading="lazy"], iframe[loading="lazy"]').forEach((el) => { el.loading = 'eager'; });
    const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
    await Promise.race([
      Promise.all([...document.images].map((i) => i.complete ? null : new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
    return true; })()`, awaitPromise: true });
  await sleep(wait);
  if (evalArg) {
    const src = readFileSync(evalArg.slice(7), 'utf8');
    const r = await send(ws, 'Runtime.evaluate', { expression: src, awaitPromise: true, returnByValue: true });
    console.log(JSON.stringify(r.result.value, null, 1));
  }
  const { result } = await send(ws, 'Runtime.evaluate', { expression: 'JSON.stringify({w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, vw: innerWidth})', returnByValue: true });
  const dims = JSON.parse(result.value);
  const shot = await send(ws, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: Number(w), height: dims.h, scale: 1 } });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(`saved ${out} (${w}x${dims.h}, scrollWidth ${dims.w}, innerWidth ${dims.vw})`);
  ws.close();
} finally {
  proc.kill();
}
