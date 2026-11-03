// 素描质感：白模 + 铅笔排线（暗处叠交叉线）+ 深灰描边
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

export const INK = "#3b3a36";
export const SERIF = '"Noto Serif CJK SC", "Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif';
export const HAND = '"WenKai", "LXGW WenKai", "Kaiti SC", "KaiTi", serif';

// 显现：0 = 只有描边的白线稿，1 = 排线、明暗都上齐。翻到新的一页时引擎把它从 0 推到 1（装置像是先画出来再上色）
export const REVEAL = { value: 1 };

// mode: "world" 按世界坐标三向投影排线（方的东西）；"uv" 按贴图坐标排线（球、圆柱，线跟着表面走）
export function hatchMat({ color = "#f3efe6", map = null, freq = 230, amt = 0.62, base = 0.2, flat = 0.62, ref = 0.95, angle = 0.8, mode = "world", uvScale = [1, 1], rough = 0.92, metal = 0, side = THREE.FrontSide } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, map, roughness: rough, metalness: metal, side, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const u = {
    uFreq: { value: freq }, uAmt: { value: amt }, uBase: { value: base }, uFlat: { value: flat }, uRef: { value: ref },
    uAng: { value: angle }, uInk: { value: new THREE.Color(INK) }, uBaseCol: { value: new THREE.Color(color) }, uUvScale: { value: new THREE.Vector2(...uvScale) },
    uReveal: map ? { value: 1 } : REVEAL,
  };
  if (mode === "uv") m.defines = { HATCH_UV: "", USE_UV: "" };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWN;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vWPos;
varying vec3 vWN;
uniform float uFreq, uAmt, uBase, uFlat, uRef, uAng, uReveal;
uniform vec3 uInk, uBaseCol;
uniform vec2 uUvScale;
float hl(float c, float w) { float d = abs(fract(c + 0.5) - 0.5); float aa = fwidth(c) * 0.8; return 1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, d); }`)
      .replace("#include <tonemapping_fragment>", `{
  vec3 lit = gl_FragColor.rgb;
  float lum = dot(lit, vec3(0.299, 0.587, 0.114));
  float lb = max(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 1e-3);
  float dark = clamp(1.0 - lum / (lb * uRef), 0.0, 1.0);
  vec2 p;
#ifdef HATCH_UV
  p = vUv * uUvScale;
#else
  vec3 n = abs(normalize(vWN));
  p = (n.y >= n.x && n.y >= n.z) ? vWPos.xz : ((n.x >= n.z) ? vWPos.zy : vWPos.xy);
#endif
  float ca = cos(uAng), sa = sin(uAng);
  float c1 = dot(p, vec2(ca, sa)) * uFreq;
  float c2 = dot(p, vec2(-sa, ca)) * uFreq;
  float c3 = dot(p, vec2(ca, -sa)) * uFreq * 1.41;
  float h = hl(c1, mix(0.10, 0.45, smoothstep(0.0, 0.75, dark))) * (uBase + (1.0 - uBase) * smoothstep(0.03, 0.5, dark));
  h = max(h, hl(c2, mix(0.12, 0.36, smoothstep(0.45, 0.95, dark))) * smoothstep(0.42, 0.72, dark));
  h = max(h, hl(c3, 0.3) * smoothstep(0.72, 0.98, dark));
  vec3 flatc = diffuseColor.rgb * mix(0.78, 1.03, clamp(lum / lb, 0.0, 1.0));
  vec3 col = mix(lit, flatc, uFlat);
  gl_FragColor.rgb = mix(col, uInk, clamp(h * uAmt, 0.0, 1.0));
  gl_FragColor.rgb = mix(vec3(0.985, 0.975, 0.955), gl_FragColor.rgb, smoothstep(0.0, 1.0, uReveal));
}
#include <tonemapping_fragment>`);
  };
  m.customProgramCacheKey = () => "hatch-" + mode;
  m.userData.hatch = u;
  return m;
}

// 描边：棱角处画线（方的东西）
const LINE_MATS = [];
export function lineMat(color = INK, width = 1.4, opacity = 1) {
  const m = new LineMaterial({ color, linewidth: width, transparent: opacity < 1, opacity, worldUnits: false });
  m.resolution.set(innerWidth, innerHeight);
  LINE_MATS.push(m);
  return m;
}
export function setLineRes(w, h) { for (const m of LINE_MATS) m.resolution.set(w, h); }
export function edges(mesh, { thresh = 25, color = INK, width = 1.3 } = {}) {
  const g = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(mesh.geometry, thresh));
  const l = new LineSegments2(g, lineMat(color, width));
  mesh.add(l);
  return l;
}
// 外轮廓：反面放大一圈的深色壳（球、圆柱这种圆的东西）
export function hull(mesh, { scale = 1.035, color = INK } = {}) {
  const h = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }));
  h.scale.setScalar(scale);
  h.raycast = () => {};
  mesh.add(h);
  return h;
}
// 一条折线（铅笔线、刻度）
export function polyline(points, { color = INK, width = 1.3, opacity = 1 } = {}) {
  const pos = [];
  for (let i = 0; i < points.length - 1; i++) pos.push(...points[i].toArray(), ...points[i + 1].toArray());
  const g = new LineSegmentsGeometry().setPositions(pos);
  return new LineSegments2(g, lineMat(color, width, opacity));
}

// 画布贴图
export function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.userData.redraw = (fn) => { ctx.clearRect(0, 0, w, h); (fn ?? draw)(ctx, w, h); t.needsUpdate = true; };
  return t;
}

// 中文按字换行（标点不放行首）
export function wrap(ctx, text, maxW) {
  const lines = []; let line = "";
  const noStart = "，。、；：？！）》」』”’";
  for (const ch of text) {
    if (ch === "\n") { lines.push(line); line = ""; continue; }
    const t = line + ch;
    if (ctx.measureText(t).width > maxW && line && !noStart.includes(ch)) { lines.push(line); line = ch; }
    else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
export function para(ctx, text, x, y, maxW, lh) {
  const ls = wrap(ctx, text, maxW);
  ls.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  return y + ls.length * lh;
}

// 纸面颗粒
export function paperGrain(ctx, w, h, { alpha = 0.035, n = 9000, seed = 7 } = {}) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `rgba(90,80,60,${alpha * rnd()})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

// 手写标签卡（立在桌上的小纸片）
export function tagCard({ lines = [], w = 0.16, h = 0.08, px = 640, bg = "#f8f3e6", tilt = -0.32, sizes = [] } = {}) {
  const ph = Math.round(px * h / w);
  const tex = canvasTex(px, ph, (ctx) => drawTag(ctx, px, ph, lines, bg, sizes));
  const geo = new THREE.BoxGeometry(w, h, 0.002);
  const side = new THREE.MeshStandardMaterial({ color: bg, roughness: 0.95 });
  const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.4 });
  const m = new THREE.Mesh(geo, [side, side, side, side, front, side]);
  m.castShadow = true;
  edges(m, { width: 1.1 });
  const g = new THREE.Group();
  m.position.y = h / 2;
  g.add(m);
  g.rotation.x = tilt;
  g.userData.set = (ls, sz) => tex.userData.redraw((ctx) => drawTag(ctx, px, ph, ls, bg, sz ?? sizes));
  return g;
}
function drawTag(ctx, w, h, lines, bg, sizes) {
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  paperGrain(ctx, w, h, { n: 1200, alpha: 0.05 });
  ctx.strokeStyle = "rgba(59,58,54,0.25)"; ctx.lineWidth = 3; ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.fillStyle = INK; ctx.textBaseline = "middle";
  const n = lines.length, total = h * 0.82;
  lines.forEach((l, i) => {
    const size = sizes[i] ?? (i === 0 ? h * 0.3 : h * 0.4);
    ctx.font = `${size}px ${HAND}`;
    ctx.textAlign = "left";
    ctx.fillText(l, w * 0.09, h * 0.09 + total * (i + 0.5) / n + h * 0.02);
  });
}

// 透明底的手写字（配合 billboard 面向镜头）
export function label(text, { color = INK, px = 512, h = 128 } = {}) {
  const draw = (ctx, w, hh, t = text) => { ctx.clearRect(0, 0, w, hh); ctx.fillStyle = color; ctx.font = `${hh * 0.62}px ${HAND}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(t, w / 2, hh / 2); };
  const tex = canvasTex(px, h, draw);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, h / px), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  let last = text;
  m.userData.set = (t) => { if (t !== last) { last = t; tex.userData.redraw((ctx, w, hh) => draw(ctx, w, hh, t)); } };
  return m;
}
