// 按镜头表逐帧录一段（带假鼠标）：node tools/rec.mjs shots/a.json
// 镜头表：{
//   lesson, out, dur, fps?(30), w?(1920), h?(1080),
//   setup: [[动作, ...参数], ...]                       一开始先做的（["show", 0]、["set", "push", 1] ...）
//   cams: [{ t, cam: "镜头名" | { pos, tgt }, hold? }]     镜头关键帧，中间平滑过渡
//   events: [{ t, act: [动作, ...参数] }]                到时间就做（["start"]、["flipTo", 1]、["flap", true] ...）
//   cursor: [{ t, p?: [x,y,z] 书上的点 | sel?: "底部按钮选择器" | xy?: [x,y], mode?: "arrow" | "grab" | "hide",
//              drag?: "start" | "move" | "end", name?: 拖哪个, click?: true }]
//   speeds?: [[t, 倍速], ...]                           从 t 起物理按几倍速走（配音快、动作慢时用；不写就是 1）
// }
// 拖：从 drag:"start" 的关键帧开始，到 drag:"end" 的关键帧松手，中间每帧把鼠标所在的书上点交给 onMove
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { serve } from "../serve.mjs";

const SHOT = JSON.parse(readFileSync(process.argv[2], "utf8"));
const FPS = SHOT.fps ?? 30, W = SHOT.w ?? 1920, H = SHOT.h ?? 1080, N = Math.round(SHOT.dur * FPS);
const OUT = resolve(SHOT.out), DIR = OUT.replace(/\.mp4$/, "") + "-frames";
const CHROME = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium", "/snap/bin/chromium"].filter(Boolean).find((p) => existsSync(p));
const { srv, port } = await serve(0);
const args = ["--no-sandbox", "--ignore-gpu-blocklist", "--enable-webgl", "--hide-scrollbars"];
if (process.platform === "linux" && !process.env.USE_GPU) args.push("--use-angle=swiftshader", "--enable-unsafe-swiftshader");
if (!CHROME) { console.error("找不到 Chrome / Edge，设一下环境变量 CHROME_PATH"); process.exit(1); }
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("[页面报错]", e.message));
await page.setViewport({ width: W, height: H });
await page.goto(`http://127.0.0.1:${port}/index.html?capture=1&lesson=${SHOT.lesson}`, { waitUntil: "load" });
await page.waitForFunction("window.APP && window.APP.ready === true", { timeout: 120000 });
for (const a of SHOT.setup ?? []) await page.evaluate((a) => APP.act(...a), a);
const CAMS = await page.evaluate(() => APP.cams());

const sm = (k) => k * k * (3 - 2 * k);
const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const cams = (SHOT.cams ?? []).map((c) => ({ ...c, c: typeof c.cam === "string" ? CAMS[c.cam] : c.cam }));
function camAt(t) {
  if (!cams.length) return null;
  let i = cams.findIndex((c) => c.t > t); if (i < 0) return cams[cams.length - 1].c; if (i === 0) return cams[0].c;
  const a = cams[i - 1], b = cams[i]; if (b.hold) return a.c;
  const k = sm(Math.min(1, (t - a.t) / Math.max(1e-6, b.t - a.t)));
  return { pos: lerp(a.c.pos, b.c.pos, k), tgt: lerp(a.c.tgt, b.c.tgt, k) };
}
const keys = SHOT.cursor ?? [];
async function spot(k) {                                     // 关键帧在屏幕上的位置；书上的点要按当前镜头投影
  if (k.p) return { xy: await page.evaluate((p) => APP.project(p), k.p), p: k.p };
  if (k.sel) return { xy: await page.evaluate((s) => APP.rect(s), k.sel) };
  if (k.flap) return { xy: await page.evaluate(() => APP.project(APP.flapPoint())) };
  return { xy: k.xy ?? [W / 2, H / 2] };
}
const events = [...(SHOT.events ?? [])].sort((a, b) => a.t - b.t);
const speeds = [...(SHOT.speeds ?? [])].sort((a, b) => a[0] - b[0]);
const speedAt = (t) => speeds.filter(([s]) => s <= t + 1e-6).pop()?.[1] ?? 1;
let ei = 0, kiDone = -1, dragging = null;
rmSync(DIR, { recursive: true, force: true }); mkdirSync(DIR, { recursive: true });
const t0 = Date.now();
for (let n = 0; n < N; n++) {
  const t = n / FPS;
  while (ei < events.length && events[ei].t <= t + 1e-6) { await page.evaluate((a) => APP.act(...a), events[ei].act); ei++; }
  const c = camAt(t); if (c) await page.evaluate((c) => APP.act("cam", c), c);
  // 经过的关键帧：拖的开始 / 结束
  while (kiDone + 1 < keys.length && keys[kiDone + 1].t <= t + 1e-6) {
    const k = keys[++kiDone];
    if (k.drag === "start") { dragging = k.name; await page.evaluate((nm, p) => APP.act("dragStart", nm, p), k.name, k.p); }
    if (k.drag === "end" && dragging) { await page.evaluate((nm, p) => { APP.act("dragMove", nm, p); APP.act("dragEnd", nm); }, dragging, k.p); dragging = null; }
  }
  // 鼠标在两个关键帧之间平滑移动
  let cur = { x: W / 2, y: H / 2, mode: "hide", click: 0 };
  if (keys.length) {
    const i = kiDone, a = keys[Math.max(0, i)], b = keys[i + 1];
    const A = await spot(a);
    let xy = A.xy, p = a.p;
    if (b && i >= 0) {
      const B = await spot(b), k = sm(Math.min(1, (t - a.t) / Math.max(1e-6, b.t - a.t)));
      xy = lerp(A.xy, B.xy, k); if (a.p && b.p) p = lerp(a.p, b.p, k);
    }
    if (i < 0) xy = A.xy;
    const ck = keys.slice(0, i + 1).reverse().find((k) => k.click);
    const click = ck && t - ck.t < 0.35 ? (t - ck.t) / 0.35 : 0;
    cur = { x: xy[0], y: xy[1], mode: (i >= 0 ? a.mode : keys[0].mode) ?? "arrow", click };
    if (dragging && p) await page.evaluate((nm, p) => APP.act("dragMove", nm, p), dragging, p);
  }
  await page.evaluate((o) => { APP.cursor(o); APP.render(); }, cur);
  await page.screenshot({ path: join(DIR, `f${String(n).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
  await page.evaluate((dt) => APP.act("advance", dt), speedAt(t) / FPS);
  if (n % 30 === 29) console.log(`${SHOT.out}：${n + 1}/${N} 帧，每帧 ${((Date.now() - t0) / (n + 1) / 1000).toFixed(1)} 秒`);
}
await browser.close(); srv.close();
mkdirSync(dirname(OUT), { recursive: true });
const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-framerate", String(FPS), "-i", join(DIR, "f%04d.jpg"), "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", OUT], { stdio: "inherit" });
console.log(r.status === 0 ? `视频 → ${OUT}（${SHOT.dur} 秒）` : "ffmpeg 合成失败");
