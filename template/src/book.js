// 书桌、垫板、摊开的书。书页上的字由每一课的 meta.pages 决定（见 references/api.md）
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { INK, SERIF, HAND, hatchMat, edges, polyline, canvasTex, wrap, paperGrain } from "./hatch.js";

export const PW = 1.0, PH = 1.38;          // 单页宽（x）、页高（z）。右页 x∈[0,1]，左页 x∈[-1,0]，z 朝镜头为正
export const BOARD = 0.016, T = 0.044;      // 封面板厚、书页厚
const R = 0.065;                             // 书脊处的弧度
export const pageY = (x) => BOARD + T * (1 - Math.exp(-Math.abs(x) / R));   // 书页表面高度（书的本地坐标）
export const FLAT = BOARD + T;               // 离书脊远的地方，书页表面高度：装置放在 y = FLAT 上
export const CW = 1536, CH = Math.round(CW * PH / PW);   // 每页画布像素
const M = 150, TW = CW - 2 * M;              // 页边距、正文宽
const GRAY = "#8a857a", MID = "#5f5a51";

export function makeDesk(scene) {
  const wood = canvasTex(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = "#e9e2d5"; ctx.fillRect(0, 0, w, h);
    let s = 11; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) {
      const y = rnd() * h, a = 0.025 + rnd() * 0.045;
      ctx.strokeStyle = `rgba(150,120,80,${a})`; ctx.lineWidth = 1 + rnd() * 3;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 64) ctx.lineTo(x, y + Math.sin(x / 140 + i) * 6 + (rnd() - 0.5) * 3);
      ctx.stroke();
    }
    paperGrain(ctx, w, h, { n: 14000, alpha: 0.04 });
  });
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(2.5, 2.5);
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.9 }));
  desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true;
  scene.add(desk);
  // 窗户透进来的斜光
  const streak = canvasTex(1024, 1024, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2); ctx.rotate(-0.62); ctx.translate(-w / 2, -h / 2);
    for (const [y, t] of [[300, 70], [430, 30], [500, 18]]) {
      const gr = ctx.createLinearGradient(0, y - t, 0, y + t);
      gr.addColorStop(0, "rgba(255,248,232,0)"); gr.addColorStop(0.5, "rgba(255,248,232,0.5)"); gr.addColorStop(1, "rgba(255,248,232,0)");
      ctx.fillStyle = gr; ctx.fillRect(-400, y - t, w + 800, t * 2);
    }
  });
  const light = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5), new THREE.MeshBasicMaterial({ map: streak, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3 }));
  light.rotation.x = -Math.PI / 2; light.position.set(-1.3, 0.0008, -1.2);
  scene.add(light);
  const mat = new THREE.Mesh(new RoundedBoxGeometry(2.95, 0.012, 2.08, 2, 0.03), new THREE.MeshStandardMaterial({ color: "#9cb2a9", roughness: 0.96 }));
  mat.position.set(0.04, 0.006, 0.02); mat.rotation.y = -0.035; mat.receiveShadow = true; mat.castShadow = true;
  scene.add(mat);
  return { desk, mat, top: 0.012 };
}

// 一侧书页的“书块”：上面是带字的弧面，前后、外侧是一层层的纸边
function pageBlock(side, pageTex, edgeTex) {
  const g = new THREE.Group();
  const N = 72, xs = [];
  for (let i = 0; i <= N; i++) { const t = i / N; xs.push(side * (t * t * 0.35 + t * 0.65) * PW); }
  const top = new THREE.BufferGeometry(), pos = [], uv = [], idx = [];
  xs.forEach((x, i) => {
    for (const z of [PH / 2, -PH / 2]) { pos.push(x, pageY(x), z); uv.push(side > 0 ? x / PW : (x + PW) / PW, (PH / 2 - z) / PH); }
    if (i < N) { const a = i * 2; idx.push(...(side > 0 ? [a, a + 2, a + 1, a + 1, a + 2, a + 3] : [a, a + 1, a + 2, a + 1, a + 3, a + 2])); }
  });
  top.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  top.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  top.setIndex(idx); top.computeVertexNormals();
  const topMesh = new THREE.Mesh(top, hatchMat({ map: pageTex, color: "#ffffff", freq: 330, amt: 0.5, base: 0, flat: 0.2, ref: 0.97, angle: 0.95, rough: 0.97 }));
  topMesh.receiveShadow = true; topMesh.castShadow = true;
  topMesh.name = side > 0 ? "pageR" : "pageL";
  g.add(topMesh);
  const sp = [], su = [];
  const quad = (a, b, c, d, ua, ub, uc, ud) => { sp.push(...a, ...b, ...c, ...a, ...c, ...d); su.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud); };
  for (let i = 0; i < N; i++) {
    const x0 = xs[i], x1 = xs[i + 1], y0 = pageY(x0), y1 = pageY(x1);
    const v = (y) => (y - BOARD) / T;
    for (const z of [PH / 2, -PH / 2]) {
      const A = [x0, BOARD, z], B = [x1, BOARD, z], C = [x1, y1, z], D = [x0, y0, z];
      if ((z > 0) === (side > 0)) quad(A, B, C, D, [x0, 0], [x1, 0], [x1, v(y1)], [x0, v(y0)]);
      else quad(B, A, D, C, [x1, 0], [x0, 0], [x0, v(y0)], [x1, v(y1)]);
    }
  }
  const xo = side * PW, yo = pageY(xo);
  const A = [xo, BOARD, PH / 2], B = [xo, BOARD, -PH / 2], C = [xo, yo, -PH / 2], D = [xo, yo, PH / 2];
  if (side > 0) quad(A, B, C, D, [0, 0], [PH, 0], [PH, 1], [0, 1]); else quad(B, A, D, C, [PH, 0], [0, 0], [0, 1], [PH, 1]);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  sg.setAttribute("uv", new THREE.Float32BufferAttribute(su, 2));
  sg.computeVertexNormals();
  const sideMesh = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ map: edgeTex, roughness: 0.95 }));
  sideMesh.castShadow = true; sideMesh.receiveShadow = true;
  g.add(sideMesh);
  for (const z of [PH / 2, -PH / 2]) g.add(polyline(xs.map((x) => new THREE.Vector3(x, pageY(x) + 0.0008, z)), { width: 1.2 }));
  g.add(polyline([new THREE.Vector3(xo, yo + 0.0008, PH / 2), new THREE.Vector3(xo, yo + 0.0008, -PH / 2)], { width: 1.2 }));
  g.add(polyline([new THREE.Vector3(xo, BOARD, PH / 2), new THREE.Vector3(xo, yo, PH / 2)], { width: 1.0, opacity: 0.8 }));
  return g;
}

function edgeTexture() {
  const t = canvasTex(64, 256, (ctx, w, h) => {
    ctx.fillStyle = "#f1ebde"; ctx.fillRect(0, 0, w, h);
    for (let y = 2; y < h; y += 5) { ctx.fillStyle = `rgba(110,100,85,${0.16 + 0.1 * Math.sin(y * 1.7) ** 2})`; ctx.fillRect(0, y, w, 1.4); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ———— 左页排版：先量好每块的位置，画字、贴纸、点选都用同一份 ————
// 两种样式：默认（大标题 + ① 先猜一猜 ② 动手试 ③ 掀开看答案）；style: "textbook"（课本样式：蓝色小节标签、“问题”框、“想想做做”框）
const ACCENT = "#2f7fc6";
// ———— 按块排版（课本样式，照原书顺序排）：pages.blocks / right.blocks ————
// 块：{ q, options?, head? }“问题”框（head 换标题，比如“想一想”） · { p }正文段落（首行缩进两字） · { h }蓝色小标题 · { act: [条目] }“想想做做”框
//     { note }结论框 · { fig(ctx, o), h, caption }小插图 · { cap }单独一行的图注 · { flap: "标题" }答案贴纸（答案写在 pages.answer）
//     { p, w } 可以限定段落宽度（像素，整页正文宽 1236），给书页角落的小立体图腾地方
const BODY = 40, LH = 68, IND = 80;
function wrapIndent(ctx, text, w, ind) {
  const first = wrap(ctx, text, w - ind);
  if (first.length <= 1) return first;
  const rest = wrap(ctx, text.slice(first[0].length), w);
  return [first[0], ...rest];
}
function layoutBlocks(ctx, blocks, y, P, A) {
  const ops = [], out = { ops, opts: [], ans: null };
  for (const b of blocks) {
    if (b.q !== undefined) {
      const head = y + 40; ctx.font = `44px ${HAND}`;
      const lines = wrap(ctx, b.q, TW); const ty = head + 86;
      ops.push({ k: "q", head, lines, ty, title: b.head ?? "问  题" });
      y = ty + (lines.length - 1) * 68;
      if (b.options) {
        ctx.font = `${BODY}px ${SERIF}`;
        const row = b.options.every((o) => ctx.measureText(o).width < 300);
        b.options.forEach((t, i) => out.opts.push(row ? { t, x: M + i * 400, y: y + 30, w: 380, h: 64 } : { t, x: M, y: y + 30 + i * 76, w: TW, h: 64 }));
        y = out.opts[out.opts.length - 1].y + 64;
      }
      y += 34; ops.push({ k: "wavy", y }); y += 40;
    } else if (b.p !== undefined) {
      ctx.font = `${BODY}px ${SERIF}`;
      const lines = wrapIndent(ctx, b.p, b.w ?? TW, IND);
      ops.push({ k: "p", lines, y: y + 50 }); y += 50 + (lines.length - 1) * LH + 22;
    } else if (b.cap !== undefined) {
      ops.push({ k: "cap", text: b.cap, y: y + 46, x: b.x }); y += 70;
    } else if (b.h !== undefined && !b.fig) {             // 图块也用 h 表示高度，别当成小标题
      ops.push({ k: "h", text: b.h, y: y + 80 }); y += 108;
    } else if (b.act) {
      const head = y + 60; ctx.font = `${BODY}px ${SERIF}`;
      const items = b.act.map((t) => wrap(ctx, t, TW - 40));
      ops.push({ k: "act", head, items, y: head + 82 });
      y = head + 82 + items.reduce((n, l) => n + l.length, 0) * LH - LH + 30;
      ops[ops.length - 1].bottom = y; y += 20;
    } else if (b.note !== undefined) {
      ctx.font = `${BODY}px ${SERIF}`; const lines = wrap(ctx, b.note, TW - 60);
      ops.push({ k: "note", lines, y: y + 30, h: lines.length * LH + 44 }); y += 30 + lines.length * LH + 64;
    } else if (b.fig) {
      ops.push({ k: "fig", fig: b.fig, y: y + 20, h: b.h ?? 280, caption: b.caption }); y += 20 + (b.h ?? 280) + (b.caption ? 60 : 0);
    } else if (b.flap !== undefined) {
      ops.push({ k: "flapHead", text: b.flap, y: y + 70 });
      out.ans = { x0: M, y0: y + 100, x1: CW - 250, y1: Math.min(CH - 160, y + 100 + 330) };
      y = out.ans.y1;
    }
  }
  if (out.ans) {
    ctx.font = `42px ${SERIF}`;
    out.ansLines = wrap(ctx, P.answer?.text ?? "", out.ans.x1 - out.ans.x0 - 80);
  }
  out.end = y;
  return out;
}
function drawBlocks(ctx, L, st, A) {
  for (const o of L.ops) {
    if (o.k === "q") {
      icon(ctx, M + 38, o.head - 14, A, "?");
      ctx.fillStyle = A; ctx.font = `700 50px ${SERIF}`; ctx.fillText(o.title, M + 100, o.head + 4);
      wavy(ctx, M + 100 + ctx.measureText(o.title).width + 30, CW - M, o.head - 10, A);
      ctx.fillStyle = A; ctx.font = `44px ${HAND}`; o.lines.forEach((l, i) => ctx.fillText(l, M, o.ty + i * 68));
    } else if (o.k === "wavy") wavy(ctx, M, CW - M, o.y, A);
    else if (o.k === "p") { ctx.fillStyle = INK; ctx.font = `${BODY}px ${SERIF}`; o.lines.forEach((l, i) => ctx.fillText(l, M + (i === 0 ? IND : 0), o.y + i * LH)); }
    else if (o.k === "cap") { ctx.fillStyle = GRAY; ctx.font = `34px ${SERIF}`; ctx.textAlign = o.x === undefined ? "center" : "left"; ctx.fillText(o.text, o.x ?? CW / 2, o.y); ctx.textAlign = "left"; }
    else if (o.k === "h") { ctx.fillStyle = A; ctx.fillRect(M, o.y - 40, 14, 48); ctx.font = `700 46px ${SERIF}`; ctx.fillText(o.text, M + 34, o.y); }
    else if (o.k === "act") {
      icon(ctx, M + 38, o.head - 14, A, "wrench");
      ctx.fillStyle = A; ctx.font = `700 50px ${SERIF}`; ctx.fillText("想想做做", M + 100, o.head + 4);
      ctx.strokeStyle = A; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(M + 330, o.head - 10); ctx.lineTo(CW - M, o.head - 10); ctx.stroke();
      ctx.strokeStyle = "rgba(47,127,198,0.35)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(M + 10, o.head + 30); ctx.lineTo(M + 10, o.bottom); ctx.arcTo(M + 10, o.bottom + 20, M + 40, o.bottom + 20, 24); ctx.lineTo(CW - M, o.bottom + 20); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = `${BODY}px ${HAND}`; let yy = o.y;
      for (const lines of o.items) { lines.forEach((l, i) => ctx.fillText(l, M + 40, yy + i * LH)); yy += lines.length * LH; }
    } else if (o.k === "note") {
      ctx.fillStyle = "rgba(47,127,198,0.08)"; ctx.fillRect(M, o.y - 10, TW, o.h);
      ctx.fillStyle = A; ctx.fillRect(M, o.y - 10, 8, o.h);
      ctx.fillStyle = INK; ctx.font = `700 ${BODY}px ${SERIF}`; o.lines.forEach((l, i) => ctx.fillText(l, M + 36, o.y + 46 + i * LH));
    } else if (o.k === "fig") {
      ctx.save(); o.fig(ctx, { INK, HAND, SERIF, ACCENT: A, x: M, y: o.y, w: TW, h: o.h }); ctx.restore();
      if (o.caption) { ctx.fillStyle = GRAY; ctx.font = `34px ${SERIF}`; ctx.textAlign = "center"; ctx.fillText(o.caption, CW / 2, o.y + o.h + 44); ctx.textAlign = "left"; }
    } else if (o.k === "flapHead") { ctx.fillStyle = A; ctx.font = `700 44px ${SERIF}`; ctx.fillText(o.text, M, o.y); }
  }
  L.opts.forEach((b, i) => check(ctx, b, st.pick === i, A));
  if (L.ans) {
    ctx.fillStyle = INK; ctx.font = `42px ${SERIF}`; L.ansLines.forEach((l, i) => ctx.fillText(l, L.ans.x0 + 40, L.ans.y0 + 70 + i * 68));
  }
}

function layoutLeft(ctx, P) {
  if (P.blocks) {
    const A = P.accent ?? ACCENT, out = layoutBlocks(ctx, P.blocks, P.subtitle ? 470 : 420, P, A);
    if (out.end > CH - 150) console.warn(`[3d-textbook] 左页字太多，放不下（排到 ${Math.round(out.end)} 像素，页高 ${CH}）。挪一部分到右页（right.blocks）或者删短。`);
    return { blocks: true, tb: true, accent: A, ...out };
  }
  const L = { tb: P.style === "textbook", accent: P.accent ?? ACCENT };
  let y;
  const optRow = (yy) => {
    ctx.font = `44px ${SERIF}`;
    const row = P.predict.options.every((o) => ctx.measureText(o).width < 300);
    L.opts = P.predict.options.map((t, i) => row ? { t, x: M + i * 400, y: yy, w: 380, h: 70 } : { t, x: M, y: yy + i * 84, w: TW, h: 70 });
    return L.opts[L.opts.length - 1].y + 70;
  };
  if (L.tb) {
    L.qHead = 470;
    ctx.font = `46px ${HAND}`;
    const q = wrap(ctx, P.predict.q, TW);
    L.q = { lines: q, y: L.qHead + 92, lh: 72 };
    y = optRow(L.q.y + (q.length - 1) * 72 + 34);
    L.qEnd = y + 26;
    ctx.font = `44px ${SERIF}`;
    const body = wrap(ctx, P.body, TW);
    L.body = { lines: body, y: L.qEnd + 110 };
    y = L.body.y + (body.length - 1) * 78;
    L.h2 = y + 120;
    const tr = wrap(ctx, P.try, TW);
    L.try = { lines: tr, y: L.h2 + 92 };
    y = L.try.y + (tr.length - 1) * 78;
  } else {
    ctx.font = `44px ${SERIF}`;
    const body = wrap(ctx, P.body, TW);
    L.body = { lines: body, y: 540 };
    y = 540 + body.length * 78;
    L.h1 = y + 90;
    const q = wrap(ctx, P.predict.q, TW);
    L.q = { lines: q, y: L.h1 + 80, lh: 78 };
    y = optRow(L.q.y + (q.length - 1) * 78 + 40) - 70;
    y += 70;
    L.h2 = y + 110;
    const tr = wrap(ctx, P.try, TW);
    L.try = { lines: tr, y: L.h2 + 80 };
    y = L.try.y + (tr.length - 1) * 78;
  }
  L.h3 = y + 110;
  L.ans = { x0: M, y0: L.h3 + 40, x1: CW - 250, y1: Math.min(CH - 160, L.h3 + 400) };
  ctx.font = `42px ${SERIF}`;
  L.ansLines = wrap(ctx, P.answer.text, L.ans.x1 - L.ans.x0 - 80);
  const need = L.ans.y0 + 70 + L.ansLines.length * 68 + (P.answer.extra ? 60 : 0);
  if (need > L.ans.y1 + 10 || L.h3 + 40 > CH - 360) console.warn(`[3d-textbook] 左页字太多，放不下（需要到 ${Math.round(need)} 像素，页高 ${CH}）。删短 body / try / answer。`);
  return L;
}
function header(ctx, left, right) {
  ctx.fillStyle = GRAY; ctx.font = `34px ${SERIF}`; ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left"; ctx.fillText(left, M, 140);
  ctx.textAlign = "right"; ctx.fillText(right, CW - M, 140);
  ctx.textAlign = "left";
  ctx.strokeStyle = "rgba(59,58,54,0.25)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(M, 172); ctx.lineTo(CW - M, 172); ctx.stroke();
}
function paperBase(ctx, seed) { ctx.fillStyle = "#f8f5ee"; ctx.fillRect(0, 0, CW, CH); paperGrain(ctx, CW, CH, { n: 26000, alpha: 0.03, seed }); }
function wavy(ctx, x0, x1, y, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath();
  for (let x = x0; x <= x1; x += 4) { const yy = y + Math.sin((x - x0) / 7) * 3; x === x0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
  ctx.stroke();
}
function icon(ctx, x, y, color, kind) {          // 课本里的小图标：问号、扳手
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 38, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#fff";
  if (kind === "?") { ctx.font = `700 56px ${SERIF}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", x, y + 3); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; }
  else { ctx.save(); ctx.translate(x, y); ctx.rotate(-0.8); ctx.fillRect(-6, -2, 12, 30); ctx.beginPath(); ctx.arc(0, -10, 15, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = color; ctx.fillRect(-5, -32, 10, 18); ctx.restore(); }
}
function check(ctx, b, on, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 3.5; ctx.strokeRect(b.x, b.y + 10, 46, 46);
  ctx.fillStyle = INK; ctx.font = `44px ${SERIF}`; ctx.fillText(b.t, b.x + 66, b.y + 50);
  if (on) { ctx.strokeStyle = "#e0662a"; ctx.lineWidth = 9; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(b.x + 4, b.y + 30); ctx.lineTo(b.x + 22, b.y + 56); ctx.lineTo(b.x + 62, b.y - 6); ctx.stroke(); }
}

function drawLeft(ctx, st, P, L) {
  paperBase(ctx, 3);
  header(ctx, P.chapter, P.lessonNo);
  if (L.blocks) {
    const A = L.accent, sec = P.section ?? { no: P.lessonNo, title: P.title };
    ctx.fillStyle = A; ctx.beginPath(); ctx.moveTo(-10, 228); ctx.lineTo(320, 228); ctx.arc(320, 278, 50, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-10, 328); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = `700 66px ${SERIF}`; ctx.fillText(sec.no, 95, 302);
    ctx.fillStyle = INK; ctx.font = `700 90px ${SERIF}`; ctx.fillText(sec.title, 410, 310);
    if (P.subtitle) { ctx.fillStyle = MID; ctx.font = `44px ${SERIF}`; ctx.fillText(P.subtitle, 410, 384); }
    drawBlocks(ctx, L, st, A);
    if (P.answer?.extra && L.ans) { ctx.fillStyle = "#c2551f"; ctx.font = `44px ${HAND}`; ctx.fillText(P.answer.extra, L.ans.x0 + 40, L.ans.y0 + 70 + L.ansLines.length * 68 + 40); }
    ctx.fillStyle = GRAY; ctx.font = `32px ${SERIF}`; ctx.fillText(String(P.pageNo[0]), M, CH - 90);
    return;
  }
  if (L.tb) {
    const A = L.accent, sec = P.section ?? { no: P.lessonNo, title: P.title };
    ctx.fillStyle = A; ctx.beginPath(); ctx.moveTo(-10, 228); ctx.lineTo(320, 228); ctx.arc(320, 278, 50, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-10, 328); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = `700 66px ${SERIF}`; ctx.fillText(sec.no, 95, 302);
    ctx.fillStyle = INK; ctx.font = `700 90px ${SERIF}`; ctx.fillText(sec.title, 410, 310);
    if (P.subtitle) { ctx.fillStyle = MID; ctx.font = `44px ${SERIF}`; ctx.fillText(P.subtitle, 410, 384); }
    icon(ctx, M + 38, L.qHead - 14, A, "?");
    ctx.fillStyle = A; ctx.font = `700 50px ${SERIF}`; ctx.fillText("问  题", M + 100, L.qHead + 4);
    wavy(ctx, M + 270, CW - M, L.qHead - 10, A);
    ctx.fillStyle = A; ctx.font = `46px ${HAND}`; L.q.lines.forEach((l, i) => ctx.fillText(l, M, L.q.y + i * L.q.lh));
    L.opts.forEach((b, i) => check(ctx, b, st.pick === i, A));
    wavy(ctx, M, CW - M, L.qEnd, A);
    ctx.fillStyle = INK; ctx.font = `44px ${SERIF}`; L.body.lines.forEach((l, i) => ctx.fillText(l, M, L.body.y + i * 78));
    icon(ctx, M + 38, L.h2 - 14, A, "wrench");
    ctx.fillStyle = A; ctx.font = `700 50px ${SERIF}`; ctx.fillText("想想做做", M + 100, L.h2 + 4);
    ctx.strokeStyle = A; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(M + 330, L.h2 - 10); ctx.lineTo(CW - M, L.h2 - 10); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = `44px ${SERIF}`; L.try.lines.forEach((l, i) => ctx.fillText(l, M, L.try.y + i * 78));
    ctx.fillStyle = A; ctx.font = `700 46px ${SERIF}`; ctx.fillText("看看答案", M, L.h3);
  } else {
    ctx.fillStyle = INK; ctx.font = `700 104px ${SERIF}`; ctx.fillText(P.title, M, 330);
    ctx.fillStyle = MID; ctx.font = `50px ${SERIF}`; ctx.fillText(P.subtitle ?? "", M, 418);
    ctx.fillStyle = INK; ctx.font = `44px ${SERIF}`;
    L.body.lines.forEach((l, i) => ctx.fillText(l, M, L.body.y + i * 78));
    ctx.font = `700 48px ${SERIF}`; ctx.fillText("① 先猜一猜", M, L.h1);
    ctx.font = `44px ${SERIF}`; L.q.lines.forEach((l, i) => ctx.fillText(l, M, L.q.y + i * L.q.lh));
    L.opts.forEach((b, i) => check(ctx, b, st.pick === i, INK));
    ctx.fillStyle = INK; ctx.font = `700 48px ${SERIF}`; ctx.fillText("② 动手试", M, L.h2);
    ctx.font = `44px ${SERIF}`; L.try.lines.forEach((l, i) => ctx.fillText(l, M, L.try.y + i * 78));
    ctx.font = `700 48px ${SERIF}`; ctx.fillText("③ 掀开看答案", M, L.h3);
  }
  ctx.fillStyle = INK; ctx.font = `42px ${SERIF}`;
  L.ansLines.forEach((l, i) => ctx.fillText(l, L.ans.x0 + 40, L.ans.y0 + 70 + i * 68));
  if (P.answer.extra) { ctx.fillStyle = "#c2551f"; ctx.font = `44px ${HAND}`; ctx.fillText(P.answer.extra, L.ans.x0 + 40, L.ans.y0 + 70 + L.ansLines.length * 68 + 40); }
  ctx.fillStyle = GRAY; ctx.font = `32px ${SERIF}`; ctx.fillText(String(P.pageNo[0]), M, CH - 90);
}

function drawRight(ctx, P) {
  paperBase(ctx, 5);
  const R = P.right ?? {};
  header(ctx, ...(R.header ?? ["", ""]));
  if (R.blocks) {
    const A = P.accent ?? ACCENT, L = layoutBlocks(ctx, R.blocks, R.top ?? 1300, P, A);
    if (L.end > CH - 150) console.warn(`[3d-textbook] 右页字太多，放不下（排到 ${Math.round(L.end)} 像素）。`);
    drawBlocks(ctx, L, { pick: -1 }, A);
  }
  if (R.figure) { ctx.save(); R.figure(ctx, { INK, HAND, SERIF, ACCENT: P.accent ?? ACCENT, x: M, y: 1450, w: TW, h: 330 }); ctx.restore(); }
  ctx.fillStyle = GRAY; ctx.font = `36px ${SERIF}`; if (R.caption) ctx.fillText(R.caption, M, 1880);
  ctx.fillStyle = MID; ctx.font = `40px ${HAND}`; if (R.hint) ctx.fillText(R.hint, M, 1950);
  ctx.fillStyle = GRAY; ctx.font = `32px ${SERIF}`; ctx.textAlign = "right"; ctx.fillText(String(P.pageNo[1]), CW - M, CH - 90); ctx.textAlign = "left";
}

// 画布像素 → 书页上的点（书的本地坐标）
export function canvasToBook(side, px, py) {
  const u = px / CW, v = 1 - py / CH;
  const x = side > 0 ? u * PW : u * PW - PW;
  return new THREE.Vector3(x, pageY(x), PH / 2 - v * PH);
}

// 一个跨页：两张书页贴图 + 答案贴纸 + 预测选项
function makeSpread(book, P) {
  const st = { pick: -1 };
  const L = layoutLeft(document.createElement("canvas").getContext("2d"), P);
  const leftTex = canvasTex(CW, CH, (ctx) => drawLeft(ctx, st, P, L));
  const rightTex = canvasTex(CW, CH, (ctx) => drawRight(ctx, P));
  const ans = L.ans ?? { x0: M, y0: CH - 400, x1: CW - 250, y1: CH - 160 };
  const a = canvasToBook(-1, ans.x0, ans.y0), b = canvasToBook(-1, ans.x1, ans.y1);
  const fw = b.x - a.x, fd = b.z - a.z;
  const flapTex = canvasTex(1100, Math.round(1100 * fd / fw), (ctx, w, h) => {
    ctx.fillStyle = "#f5e7b8"; ctx.fillRect(0, 0, w, h);
    paperGrain(ctx, w, h, { n: 3000, alpha: 0.05, seed: 9 });
    ctx.setLineDash([16, 12]); ctx.strokeStyle = "rgba(59,58,54,0.45)"; ctx.lineWidth = 4; ctx.strokeRect(22, 22, w - 44, h - 44); ctx.setLineDash([]);
    ctx.fillStyle = INK; ctx.font = `76px ${HAND}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("掀开看答案", w / 2, h * 0.42);
    ctx.fillStyle = MID; ctx.font = `46px ${HAND}`; ctx.fillText("先猜、再动手，最后才掀 ↑", w / 2, h * 0.7);
  });
  const flapMesh = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.0025, fd), [0, 0, 1, 0, 0, 0].map((i) => i ? new THREE.MeshStandardMaterial({ map: flapTex, roughness: 0.9 }) : new THREE.MeshStandardMaterial({ color: "#e9d9a4", roughness: 0.9 })));
  flapMesh.position.set(0, 0.0013, fd / 2); flapMesh.castShadow = true; flapMesh.name = "flap";
  edges(flapMesh, { width: 1.1 });
  const flap = new THREE.Group();
  flap.position.set((a.x + b.x) / 2, FLAT + 0.001, a.z);
  flap.add(flapMesh); flap.visible = false;
  book.add(flap);
  if (!L.ans) { flapMesh.visible = false; flapMesh.raycast = () => {}; }      // 这一页没有答案贴纸
  return {
    P, L, st, leftTex, rightTex, flap, flapMesh, open: false, a: 0,
    pickAt(uv) {
      const px = uv.x * CW, py = (1 - uv.y) * CH;
      for (let i = 0; i < L.opts.length; i++) {
        const o = L.opts[i];
        if (px > o.x - 10 && px < o.x + o.w && py > o.y - 10 && py < o.y + o.h + 10) { st.pick = st.pick === i ? -1 : i; leftTex.userData.redraw(); return true; }
      }
      return false;
    },
    setPick(i) { st.pick = i; leftTex.userData.redraw(); },
  };
}

// 翻页用的那一张纸：从书脊处转过去，纸会弯
function makeSheet(book) {
  const N = 48, pos = new Float32Array((N + 1) * 2 * 3), uvF = [], uvB = [], idx = [];
  for (let i = 0; i <= N; i++) for (const v of [0, 1]) { uvF.push(i / N, v); uvB.push(1 - i / N, v); }
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const mk = (uvs, side) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, hatchMat({ color: "#ffffff", map: null, freq: 330, amt: 0.45, base: 0, flat: 0.2, ref: 0.97, side }));
    m.material.userData.hatch.uReveal = { value: 1 };          // 书页不参与“线稿显现”
    m.castShadow = true; m.frustumCulled = false; return m;
  };
  const front = mk(uvF, THREE.FrontSide), back = mk(uvB, THREE.BackSide);
  const g = new THREE.Group(); g.add(front, back); g.visible = false; book.add(g);
  function set(theta, dir) {                         // theta：0 平躺在右页，π 平躺在左页；dir：+1 往左翻、-1 往右翻
    const curl = -dir * 0.95 * Math.sin(theta), d = PW / N;
    let x = 0, y = FLAT + 0.003;
    for (let i = 0; i <= N; i++) {
      for (const [k, z] of [[0, PH / 2], [1, -PH / 2]]) { const o = (i * 2 + k) * 3; pos[o] = x; pos[o + 1] = y; pos[o + 2] = z; }
      const phi = theta + curl * Math.pow(i / N, 1.4);
      x += d * Math.cos(phi); y += d * Math.sin(phi);
    }
    for (const m of [front, back]) { m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere(); }
  }
  return {
    group: g, set,
    textures(frontTex, backTex) { front.material.map = frontTex; back.material.map = backTex; front.material.needsUpdate = back.material.needsUpdate = true; },
  };
}

// 封面画：合着的时候朝上的那一面（书名 + 年级），lesson 里写 export const cover = { title, sub }
function drawCover(ctx, w, h, cover) {
  ctx.translate(w, h); ctx.rotate(Math.PI);                  // 贴在封皮底面、合上时转了半圈，先倒过来画
  ctx.fillStyle = "#d9a443"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 6; ctx.strokeRect(70, 70, w - 140, h - 140);
  ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `700 260px ${SERIF}`; ctx.fillText(cover.title ?? "3D 课本", w / 2, h * 0.36);
  ctx.font = `500 96px ${SERIF}`; ctx.fillText(cover.sub ?? "", w / 2, h * 0.53);
  ctx.fillRect(w / 2 - 160, h * 0.6, 320, 5);
  ctx.font = `500 64px ${SERIF}`; ctx.globalAlpha = 0.85; ctx.fillText(cover.foot ?? "3D 课本", w / 2, h * 0.86); ctx.globalAlpha = 1;
}

export function makeBook(scene, y0, pagesList, cover = {}) {
  const book = new THREE.Group();
  book.position.set(0, y0, 0.02);
  scene.add(book);
  const spreads = pagesList.map((P) => makeSpread(book, P));
  const edgeTex = edgeTexture();
  const L = pageBlock(-1, spreads[0].leftTex, edgeTex), R = pageBlock(1, spreads[0].rightTex, edgeTex);
  // 右半本（页块 + 右封皮 + 封面画）挂在书脊上：setOpen(0) 合上、setOpen(1) 摊开（默认摊开，和以前一样）
  const HINGE = FLAT + 0.003, front = new THREE.Group(); front.position.set(0, HINGE, 0);
  R.position.y = -HINGE; front.add(R);
  book.add(L, front);
  const pageL = L.getObjectByName("pageL"), pageR = R.getObjectByName("pageR");
  const coverMat = hatchMat({ color: "#d9a443", freq: 300, amt: 0.35, base: 0.12, flat: 0.4 });
  coverMat.userData.hatch.uReveal = { value: 1 };            // 封面不参与“线稿显现”
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new RoundedBoxGeometry(PW + 0.035, BOARD, PH + 0.05, 2, 0.006), coverMat);
    c.position.set(s * (PW / 2 + 0.012), BOARD / 2 - (s > 0 ? HINGE : 0), 0); c.castShadow = c.receiveShadow = true;
    edges(c, { width: 1.1 }); (s > 0 ? front : book).add(c);
  }
  const art = new THREE.Mesh(new THREE.PlaneGeometry(PW + 0.03, PH + 0.045), new THREE.MeshStandardMaterial({ map: canvasTex(1040, 1440, (ctx, w, h) => drawCover(ctx, w, h, cover)), roughness: 0.9 }));
  art.rotation.x = Math.PI / 2; art.position.set(PW / 2 + 0.012, -HINGE - 0.0006, 0); front.add(art);   // 贴在右封皮底面，合上时朝上
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.05, BOARD * 0.9, PH + 0.05), coverMat);
  spine.position.set(0, BOARD * 0.45, 0); book.add(spine);
  const sheet = makeSheet(book);
  const setMap = (mesh, tex) => { mesh.material.map = tex; mesh.material.needsUpdate = true; };
  let cur = 0;
  spreads[0].flap.visible = true;
  return {
    book, spreads, pageL, pageR, sheet,
    setOpen(k) { front.rotation.z = Math.PI * (1 - k); },
    get index() { return cur; },
    // 翻页的三个时刻：begin（纸抬起来之前）→ 每帧 sheet.set → end（纸落下以后）
    beginFlip(to) {
      const dir = to > cur ? 1 : -1, A = spreads[cur], Bs = spreads[to];
      if (dir > 0) { sheet.textures(A.rightTex, Bs.leftTex); setMap(pageR, Bs.rightTex); }      // 往后翻：左页先不动，答案贴纸也先留着
      else { sheet.textures(Bs.rightTex, A.leftTex); setMap(pageL, Bs.leftTex); A.flap.visible = false; Bs.flap.visible = true; }
      sheet.set(dir > 0 ? 0 : Math.PI, dir); sheet.group.visible = true;
      return dir;
    },
    // 纸快落到左页时换上新一页的答案贴纸（这时纸正好盖着，看不到答案）
    landFlap(to) { for (const s of spreads) s.flap.visible = false; spreads[to].flap.visible = true; },
    endFlip(to) {
      const Bs = spreads[to];
      setMap(pageL, Bs.leftTex); setMap(pageR, Bs.rightTex);
      sheet.group.visible = false; for (const s of spreads) s.flap.visible = s === Bs; cur = to;
    },
  };
}
