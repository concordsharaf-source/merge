import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const target = process.argv[2] || "http://localhost:3000/";
const widths = [320, 360, 375, 390, 412, 430];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function inspectWidth(width, port) {
  const profile = await mkdtemp(join(tmpdir(), `hesabi-viewport-${width}-`));
  const chrome = spawn("chromium", ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},800`, target], { stdio: "ignore" });
  try {
    let pages = [];
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try { pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json()); } catch { /* Browser still starting. */ }
      if (pages.length) break;
      await sleep(150);
    }
    const page = pages.find((item) => item.type === "page");
    if (!page?.webSocketDebuggerUrl) throw new Error(`تعذر فتح صفحة القياس لعرض ${width}.`);
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    let commandId = 0;
    const command = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++commandId;
      const timer = setTimeout(() => reject(new Error(`انتهت مهلة ${method} لعرض ${width}.`)), 8_000);
      const onMessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        socket.removeEventListener("message", onMessage);
        clearTimeout(timer);
        if (message.error) { reject(new Error(message.error.message)); return; }
        if (message.result?.exceptionDetails) { reject(new Error(message.result.exceptionDetails.text)); return; }
        resolve(message.result);
      };
      socket.addEventListener("message", onMessage);
      socket.send(JSON.stringify({ id, method, params }));
    });
    await command("Emulation.setDeviceMetricsOverride", { width, height: 800, deviceScaleFactor: 1, mobile: true });
    const evaluation = await command("Runtime.evaluate", { returnByValue: true, awaitPromise: true, expression: "new Promise(resolve => setTimeout(() => resolve({ viewport: window.innerWidth, scrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0), ready: document.readyState }), 700))" });
    const result = evaluation.result?.value;
    if (!result) throw new Error(`رد قياس غير صالح لعرض ${width}.`);
    socket.close();
    return { width, ...result, passes: result.scrollWidth <= result.viewport };
  } finally {
    chrome.kill("SIGTERM");
    await new Promise((resolve) => chrome.once("exit", resolve));
    await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
  }
}

const results = [];
for (const [index, width] of widths.entries()) results.push(await inspectWidth(width, 9230 + index));
console.table(results);
if (results.some((result) => !result.passes)) process.exitCode = 1;
