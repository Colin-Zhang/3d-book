// 录一段视频：node tools/clip.mjs --lesson kinetic --out shots/clip.mp4 [--fps 30]
// 怎么录由课里的 export const clip 决定：{ set: {参数: 值}, pick, from: 镜头, to: 镜头, push: 推镜秒数, startAt: 几秒开始, dur: 总秒数 }
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { serve } from "../serve.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const LESSON = arg("lesson", "kinetic"), OUT = arg("out", `shots/${LESSON}.mp4`), FPS = Number(arg("fps", 30));
const CHROME = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium", "/snap/bin/chromium"].filter(Boolean).find((p) => existsSync(p));
const { srv, port } = await serve(0);
const args = ["--no-sandbox", "--ignore-gpu-blocklist", "--enable-webgl", "--hide-scrollbars"];
if (process.platform === "linux" && !process.env.USE_GPU) args.push("--use-angle=swiftshader", "--enable-unsafe-swiftshader");
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("[页面报错]", e.message));
await page.setViewport({ width: 1920, height: 1080 });
await page.goto(`http://127.0.0.1:${port}/index.html?capture=1&lesson=${LESSON}`, { waitUntil: "load" });
await page.waitForFunction("window.APP && window.APP.ready === true", { timeout: 120000 });
const C = await page.evaluate(() => window.APP.clip);
if (!C) { console.error("这一课没有 export const clip（录屏参数）"); process.exit(1); }
await page.evaluate((C) => { for (const [k, v] of Object.entries(C.set ?? {})) APP.act("set", k, v); if (C.pick !== undefined) APP.act("pick", C.pick); }, C);
const dir = join(dirname(OUT), "frames"); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const N = Math.round((C.dur ?? 6) * FPS), t0 = Date.now();
for (let n = 0; n < N; n++) {
  await page.evaluate((t, dt, C) => {
    APP.act("camMix", C.from ?? "overview", C.to ?? C.from ?? "overview", Math.min(1, t / (C.push ?? 1.5)));
    if (Math.abs(t - (C.startAt ?? 1)) < dt / 2) APP.act("start");
    APP.act("advance", dt);
    APP.render();
  }, n / FPS, 1 / FPS, C);
  await page.screenshot({ path: join(dir, `f${String(n).padStart(4, "0")}.jpg`), type: "jpeg", quality: 90 });
  if (n % 30 === 29) console.log(`${n + 1}/${N} 帧，每帧 ${((Date.now() - t0) / (n + 1) / 1000).toFixed(1)} 秒`);
}
await browser.close(); srv.close();
const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-framerate", String(FPS), "-i", join(dir, "f%04d.jpg"), "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", OUT], { stdio: "inherit" });
console.log(r.status === 0 ? `视频 → ${OUT}` : `ffmpeg 合成失败（装了 ffmpeg 吗？），帧在 ${dir}`);
