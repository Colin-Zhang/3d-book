// 截图：node tools/shot.mjs --lesson kinetic --out shots/overview.png [--steps '[["cam","overview"],["set","h",2],["start"],["advance",1.0]]']
// 常用 steps：["cam", 镜头名]、["set", 参数, 值]、["start"]、["advance", 秒]、["run"]（一直跑到结束）、["pick", 选项序号]、["flap", true]
// 服务器没显卡时走 SwiftShader 软件渲染（慢，但画面一样）；有显卡设 USE_GPU=1
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { serve } from "../serve.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const LESSON = arg("lesson", "kinetic"), OUT = arg("out", `shots/${LESSON}.png`), W = Number(arg("w", 1920)), H = Number(arg("h", 1080));
const STEPS = JSON.parse(arg("steps", "[]"));
export const CHROME = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium", "/snap/bin/chromium"].filter(Boolean).find((p) => existsSync(p));
if (!CHROME) { console.error("找不到 Chrome / Edge，设一下环境变量 CHROME_PATH"); process.exit(1); }
const { srv, port } = await serve(0);
const args = ["--no-sandbox", "--ignore-gpu-blocklist", "--enable-webgl", "--hide-scrollbars"];
if (process.platform === "linux" && !process.env.USE_GPU) args.push("--use-angle=swiftshader", "--enable-unsafe-swiftshader");
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args });
const page = await browser.newPage();
const problems = [];
page.on("console", (m) => { if (["error", "warn"].includes(m.type()) && !m.text().includes("404")) { problems.push(m.text()); console.error(`[页面 ${m.type()}]`, m.text()); } });
page.on("pageerror", (e) => { problems.push(e.message); console.error("[页面报错]", e.message); });
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/index.html?capture=1&lesson=${LESSON}`, { waitUntil: "load" });
await page.waitForFunction("window.APP && window.APP.ready === true", { timeout: 120000 }).catch(() => { console.error("页面没加载起来（看上面的报错）"); process.exit(1); });
for (const [k, ...a] of STEPS) await page.evaluate((k, a) => window.APP.act(k, ...a), k, a);
await page.evaluate(() => window.APP.render());
mkdirSync(dirname(OUT), { recursive: true });
await page.screenshot({ path: OUT, type: OUT.endsWith(".jpg") ? "jpeg" : "png" });
await browser.close(); srv.close();
console.log(`${OUT}（${((Date.now() - t0) / 1000).toFixed(1)} 秒）${problems.length ? `，有 ${problems.length} 条报错 / 警告` : ""}`);
