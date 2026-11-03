// 范例课：人教版八年级下册 第十一章第 3 节《动能和势能》——钢球从斜面滚下撞木块
// 一课一个文件：meta（书页上的字）+ controls（底部按钮）+ cams（镜头）+ build（装置、物理、能量）
import * as THREE from "three";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { INK, HAND, hatchMat, edges, hull, lineMat, canvasTex, tagCard, label } from "../hatch.js";
import { FLAT } from "../book.js";
import { makeEnergy } from "../energy.js";

export const meta = {
  barTitle: "第 3 课 · 钢球撞木块",
  goLabel: "松手 ▶",
  pages: {
    chapter: "第十一章 · 功和机械能", lessonNo: "第 3 课",
    title: "钢球撞木块", subtitle: "动能跟什么有关？",
    body: "滚下来的钢球，能把木块推出去一段距离——它在对木块做功。物体因为运动而具有的能量，叫做动能。木块被推得越远，钢球撞上去时的动能就越大。",
    predict: { q: "把钢球从更高的地方放下，木块会——", options: ["被推得更远", "一样远", "更近"] },
    try: "在右页选 1、2、3 号高度，点钢球松手；再换成大钢球，比一比木块滑多远。",
    answer: { text: "高度越高，钢球滚到底时越快；钢球越重，撞得越狠。速度越大、质量越大，动能就越大。", extra: "高中会学：Eₖ = ½ m v²" },
    pageNo: [56, 57],
    right: {
      header: ["动能和势能", "钢球撞木块"],
      caption: "图 3-1　钢球从斜面滚下，撞击水平面上的木块",
      hint: "拖动画面可以转着看；点钢球就松手。",
      figure(ctx, o) {          // 印在书页上的侧视线描（o: 区域 x、y、w、h 和字体）
        ctx.translate(o.x + 100, o.y + 110); ctx.strokeStyle = "rgba(59,58,54,0.55)"; ctx.fillStyle = "rgba(59,58,54,0.55)"; ctx.lineWidth = 3; ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(0, 230); ctx.lineTo(1000, 230); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 230); ctx.lineTo(0, 20); ctx.lineTo(270, 230); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(62, 44, 26, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeRect(380, 175, 70, 55);
        ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.moveTo(-40, 70); ctx.lineTo(-40, 230); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = `40px ${o.HAND}`; ctx.fillText("h", -78, 165);
        ctx.beginPath(); ctx.moveTo(470, 150); ctx.lineTo(700, 150); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(700, 150); ctx.lineTo(680, 140); ctx.lineTo(680, 160); ctx.closePath(); ctx.fill();
        ctx.fillText("s", 575, 130);
      },
    },
  },
};

export const controls = [
  { key: "h", label: "高度", options: [["1", 0], ["2", 1], ["3", 2]] },
  { key: "ball", label: "钢球", options: [["小", "small"], ["大", "big"]] },
];

export const cams = {
  apparatus: { pos: [0.6, 1.02, 1.22], tgt: [0.56, 0.17, 0.02] },
  apparatusWide: { pos: [0.5, 1.45, 1.75], tgt: [0.48, 0.12, 0.0] },
  energy: { pos: [0.74, 0.92, 0.5], tgt: [0.7, 0.2, -0.24] },
};
// 录屏默认参数（tools/clip.mjs 用）：先设这些，再从 from 镜头推到 to 镜头，startAt 秒时开始
export const clip = { set: { h: 2, ball: "big" }, pick: 0, from: "apparatusWide", to: "apparatus", push: 1.6, startAt: 1.2, dur: 6 };

const G = 9.8, K = 1.0, SLOW = 0.3, MU = 0.68, M_BLOCK = 0.2;   // K：每米多少场景单位；SLOW：慢放倍数
const HEIGHTS = [0.1, 0.2, 0.3];                                  // 米
const BALLS = { small: { m: 0.1, r: 0.03, name: "小钢球 100 g" }, big: { m: 0.2, r: 0.038, name: "大钢球 200 g" } };
const YB = FLAT + 0.024;                     // 底板上表面
const X0 = 0.1, HT = 0.34, LR = 0.4, XR = X0 + LR;
const TH = Math.atan2(HT, LR), SIN = Math.sin(TH), COS = Math.cos(TH);
const ZC = 0.16;                             // 钢球、木块走的那条线
const BW = 0.075, BH = 0.055, BD = 0.08;
const BLOCK_BACK0 = XR + 0.08, RULER0 = BLOCK_BACK0 + BW, RULER_LEN = 0.33;

export function build(book, { billboard }) {
  const g = new THREE.Group(); book.add(g);
  const wood = hatchMat({ color: "#efe6d5", freq: 260 });
  const wood2 = hatchMat({ color: "#e8d6b4", freq: 300, angle: -0.6 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.91, 0.024, 0.2), wood);
  base.position.set(0.535, FLAT + 0.012, ZC); base.castShadow = base.receiveShadow = true; edges(base); g.add(base);
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, HT), new THREE.Vector2(LR, 0)]);
  const wedge = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false }), wood);
  wedge.position.set(X0, YB, ZC - 0.06); wedge.castShadow = wedge.receiveShadow = true; edges(wedge); g.add(wedge);
  const L = Math.hypot(HT, LR);
  for (const dz of [-0.057, 0.057]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.014, 0.007), wood2);
    rail.position.set(X0 + LR / 2 + 0.007 * SIN, YB + HT / 2 + 0.007 * COS, ZC + dz);
    rail.rotation.z = -TH; rail.castShadow = true; edges(rail, { width: 1.1 }); g.add(rail);
  }
  const block = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, BD), wood2);
  block.castShadow = block.receiveShadow = true; edges(block); g.add(block);

  // 刻度尺（木块原来的前沿是 0）
  const marks = [];
  const RPX = 2048, RPY = 180, pxPerCm = RPX / (RULER_LEN / K * 100);
  const rulerTex = canvasTex(RPX, RPY, (ctx, w, h) => {
    ctx.fillStyle = "#f7f0dc"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.fillStyle = INK; ctx.font = `44px ${HAND}`; ctx.textAlign = "center";
    for (let cm = 0; cm * pxPerCm < w - 4; cm++) {
      const x = 4 + cm * pxPerCm, len = cm % 10 === 0 ? 60 : cm % 5 === 0 ? 42 : 24;
      ctx.lineWidth = cm % 10 === 0 ? 3.5 : 2; ctx.beginPath(); ctx.moveTo(x, h - 4); ctx.lineTo(x, h - 4 - len); ctx.stroke();
      if (cm % 10 === 0 && cm > 0) ctx.fillText(String(cm), x, h - 80);
    }
    ctx.textAlign = "left"; ctx.font = `40px ${HAND}`; ctx.fillText("0  cm", 14, 52);
    for (const mk of marks) {
      const x = 4 + mk.cm * pxPerCm;
      ctx.strokeStyle = "#e0662a"; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x, h - 6); ctx.lineTo(x, 34); ctx.stroke();
      ctx.fillStyle = "#c2551f"; ctx.font = `38px ${HAND}`; ctx.textAlign = "center"; ctx.fillText(mk.label, x, 30); ctx.textAlign = "left";
    }
  });
  const ruler = new THREE.Mesh(new THREE.PlaneGeometry(RULER_LEN, 0.036), new THREE.MeshStandardMaterial({ map: rulerTex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
  ruler.rotation.x = -Math.PI / 2; ruler.position.set(RULER0 + RULER_LEN / 2, YB + 0.0006, ZC + 0.078); ruler.receiveShadow = true; g.add(ruler);

  // 1、2、3 号高度：斜面正面的小圆贴纸（能点）
  const contactAt = (s) => new THREE.Vector2(XR - s * COS, YB + s * SIN);
  const tabs = HEIGHTS.map((h, i) => {
    const draw = (ctx, on) => {
      ctx.clearRect(0, 0, 128, 128);
      ctx.beginPath(); ctx.arc(64, 64, 58, 0, Math.PI * 2); ctx.fillStyle = on ? "#f07a2a" : "#fbf6ea"; ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = on ? "#fff" : INK; ctx.font = `76px ${HAND}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(i + 1), 64, 68);
    };
    const tex = canvasTex(128, 128, (ctx) => draw(ctx, false));
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.018, 32), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    const c = contactAt(h * K / SIN);
    m.position.set(c.x - 0.042 * SIN, c.y - 0.042 * COS, ZC + 0.0605); m.userData.h = i;
    m.userData.set = (on) => tex.userData.redraw((ctx) => draw(ctx, on));
    g.add(m); return m;
  });

  const steel = hatchMat({ color: "#cdd5dc", mode: "uv", uvScale: [36, 18], freq: 1, flat: 0.35, rough: 0.35, metal: 0.25, base: 0.3 });
  const balls = {};
  for (const k of Object.keys(BALLS)) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(BALLS[k].r, 40, 24), steel);
    m.castShadow = true; hull(m, { scale: 1.06 }); m.visible = false; g.add(m); balls[k] = m;
  }
  const hLine = new LineSegments2(new LineSegmentsGeometry(), lineMat("#c2551f", 2)); g.add(hLine);
  const hLabel = billboard(label("h = 30 cm", { color: "#c2551f" }), 0.13); g.add(hLabel);
  const ballLabel = billboard(label("小钢球 100 g"), 0.15); g.add(ballLabel);

  const energy = makeEnergy(g, {
    kinds: [{ key: "pe", name: "重力势能" }, { key: "ke", name: "动能" }, { key: "q", name: "内能（摩擦生热）" }],
    pipes: [[0, 1], [1, 2]], max: 0.2 * G * 0.3, x0: 0.52, dx: 0.18, z: -0.2,
  });

  const readout = tagCard({ lines: ["木块滑了", "0.0 cm"], w: 0.17, h: 0.085, sizes: [34, 58], px: 512, bg: "#fbefd9" });
  readout.visible = false; g.add(readout);

  // ———— 状态和物理 ————
  const st = { h: 2, ball: "small", phase: "ready", s: 0, v: 0, xb: 0, rot: 0, xk: BLOCK_BACK0, vk: 0, v2: 0, E0: 0, flow: [0, 0], d: 0 };
  const B = () => BALLS[st.ball];
  function energies() {
    const m = B().m;
    if (st.phase === "ready") return { pe: st.E0, ke: 0, q: 0 };
    if (st.phase === "roll") { const pe = m * G * (st.s * SIN / K); return { pe, ke: st.E0 - pe, q: 0 }; }
    if (st.phase === "flat") return { pe: 0, ke: st.E0, q: 0 };
    const ke = 0.5 * m * st.v2 * st.v2 + 0.5 * M_BLOCK * st.vk * st.vk;
    return { pe: 0, ke, q: Math.max(0, st.E0 - ke) };
  }
  function sync() {
    for (const k in balls) balls[k].visible = k === st.ball;
    const b = balls[st.ball], r = B().r;
    if (st.phase === "ready" || st.phase === "roll") { const c = contactAt(st.s); b.position.set(c.x + r * SIN, c.y + r * COS, ZC); }
    else b.position.set(st.xb, YB + r, ZC);
    b.rotation.z = st.rot;
    block.position.set(st.xk + BW / 2, YB + BH / 2, ZC);
    energy.set(energies());
    energy.flow(0, st.flow[0]); energy.flow(1, st.flow[1]);
    const showH = st.phase === "ready";
    hLine.visible = hLabel.visible = ballLabel.visible = showH;
    if (showH) {
      const c = contactAt(st.s), x = c.x - 0.004, z = ZC + 0.08, pos = [];
      for (let y = YB; y < c.y; y += 0.012) pos.push(x, y, z, x, Math.min(y + 0.007, c.y), z);
      pos.push(x - 0.012, c.y, z, x + 0.012, c.y, z, x - 0.012, YB, z, x + 0.012, YB, z);
      hLine.geometry.dispose(); hLine.geometry = new LineSegmentsGeometry().setPositions(pos);
      hLabel.position.set(x + 0.07, YB + (c.y - YB) * 0.38, z + 0.01);
      hLabel.userData.set(`h = ${Math.round(HEIGHTS[st.h] * 100)} cm`);
      ballLabel.position.set(b.position.x + 0.115, b.position.y + r + 0.02, ZC);
      ballLabel.userData.set(B().name);
    }
    tabs.forEach((t, i) => t.userData.set(i === st.h));
  }
  function reset() {
    Object.assign(st, { phase: "ready", s: HEIGHTS[st.h] * K / SIN, v: 0, rot: 0, xk: BLOCK_BACK0, vk: 0, v2: 0, flow: [0, 0] });
    st.E0 = B().m * G * HEIGHTS[st.h];
    readout.visible = false;
    sync();
  }
  function finish() {
    st.d = (st.xk - BLOCK_BACK0) / K * 100;
    const tag = `${st.h + 1}号·${st.ball === "big" ? "大" : "小"}`;
    const i = marks.findIndex((mk) => mk.label === tag); if (i >= 0) marks.splice(i, 1);
    marks.push({ cm: st.d, label: tag }); if (marks.length > 4) marks.shift();
    rulerTex.userData.redraw();
    readout.userData.set(["木块滑了", `${st.d.toFixed(1)} cm`]);
    readout.position.set(Math.min(st.xk + BW / 2, 0.88), FLAT, ZC + 0.19);
    readout.visible = true;
  }
  const busy = () => ["roll", "flat", "slide"].includes(st.phase);
  function step(dtVis) {
    if (!busy()) { st.flow = st.flow.map((f) => f * 0.9); sync(); return; }
    const dt = dtVis * SLOW, m = B().m, r = B().r, n = Math.ceil(dt / (1 / 600)), h = dt / n;
    for (let i = 0; i < n; i++) {
      if (st.phase === "roll") {
        st.v += (5 / 7) * G * SIN * h; const ds = st.v * h * K; st.s -= ds; st.rot -= ds / r;
        if (st.s <= 0) { st.s = 0; st.phase = "flat"; st.xb = XR + r * SIN; }
      } else if (st.phase === "flat") {
        const dx = st.v * h * K; st.xb += dx; st.rot -= dx / r;
        if (st.xb + r >= st.xk) { st.xb = st.xk - r; st.vk = 2 * m / (m + M_BLOCK) * st.v; st.v2 = (m - M_BLOCK) / (m + M_BLOCK) * st.v; st.phase = "slide"; }
      } else if (st.phase === "slide") {
        st.vk = Math.max(0, st.vk - MU * G * h); st.xk += st.vk * h * K;
        const dec = 1.8 * h; st.v2 = Math.abs(st.v2) <= dec ? 0 : st.v2 - Math.sign(st.v2) * dec;
        const dx = st.v2 * h * K; st.xb += dx; st.rot -= dx / r;
        if (st.xb + r > st.xk) { st.xb = st.xk - r; st.v2 = Math.min(st.v2, st.vk); }
        if (st.vk === 0 && st.v2 === 0) { st.phase = "done"; finish(); break; }
      }
    }
    const vmax = Math.sqrt(10 / 7 * G * 0.3);
    st.flow[0] = st.phase === "roll" ? Math.min(1, 0.35 + st.v / vmax) : st.flow[0] * 0.92;
    st.flow[1] = st.phase === "slide" && st.vk > 0 ? 1 : st.flow[1] * 0.92;
    sync();
  }
  reset();
  return {
    st, step, reset, busy,
    done: () => st.phase === "done",
    start() { if (st.phase === "ready") st.phase = "roll"; },
    get: (k) => st[k],
    set(k, v) { if (busy()) return; st[k] = v; reset(); },
    clickables: [...Object.values(balls), ...tabs],
    click(o) { if (o.userData.h !== undefined) this.set("h", o.userData.h); else if (st.phase === "ready") this.start(); },
    energy,
  };
}
