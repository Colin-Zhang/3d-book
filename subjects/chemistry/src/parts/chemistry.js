// 化学器材库：玻璃器皿（烧杯、锥形瓶、试管）、橡胶塞、电子天平、酒精灯、铁架台、气泡、冒气、粉末、铁钉
// 用法见 subjects/chemistry/guide.md。所有器材都是 THREE.Group，原点在底面中心，放到书页上用 position.set(x, FLAT, z)
import * as THREE from "three";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { INK, hatchMat, edges, hull, polyline, lineMat, canvasTex } from "../hatch.js";

// 常见物质的颜色（溶液按真实颜色，无色的画成很淡的蓝，方便看出液面）
export const CHEM = {
  water: "#c9e3ef", hcl: "#c4e2ef", cuso4: "#2f86d6", feso4: "#a9d39b", fecl3: "#c98a2b", kmno4: "#7a2a8c",
  phenolBase: "#e45a9a", litmusAcid: "#d9464e", litmusBase: "#4a63c9", limewater: "#e8eef0", milky: "#f1f1ec",
  na2co3: "#ebe7dc", caco3: "#ece8df", copper: "#c0603a", iron: "#8f979e", rubber: "#8c3b2e",
};

const glassMat = () => new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.14, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide });

// ———— 玻璃器皿：wall = 外壁轮廓 [[半径, 高度], ...]（从底边到瓶口） ————
export function glassVessel(wall, { segments = 56, t = 0.002 } = {}) {
  const g = new THREE.Group();
  const pts = [new THREE.Vector2(0, 0), ...wall.map(([r, y]) => new THREE.Vector2(r, y))];
  const glass = new THREE.Mesh(new THREE.LatheGeometry(pts, segments), glassMat());
  glass.renderOrder = 2; g.add(glass);
  const top = wall[wall.length - 1][1];
  const rAt = (y) => {                                        // 这个高度的内壁半径
    for (let i = 1; i < wall.length; i++) {
      const [r0, y0] = wall[i - 1], [r1, y1] = wall[i];
      if (y <= y1) return Math.max(0, (y1 === y0 ? r1 : r0 + (r1 - r0) * (y - y0) / (y1 - y0)) - t);
    }
    return wall[wall.length - 1][0] - t;
  };
  const ring = (y, r, w = 1.2) => { const p = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; p.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); } g.add(polyline(p, { width: w })); };
  ring(top, wall[wall.length - 1][0]);
  ring(0.001, wall[0][0], 1.1);
  const sil = new LineSegments2(new LineSegmentsGeometry(), lineMat(INK, 1.3)); g.add(sil);
  // 液体（液面画一圈线，看得出是平的）
  let liq = null, lvl = -1, surf = null;
  const liqMat = new THREE.MeshStandardMaterial({ color: CHEM.water, transparent: true, opacity: 0.85, roughness: 0.3, emissive: CHEM.water, emissiveIntensity: 0.15 });
  function setLiquid(level, color) {
    if (color) { liqMat.color.set(color); liqMat.emissive.set(color); }
    level = Math.max(0, Math.min(top - 0.004, level));
    if (Math.abs(level - lvl) < 0.0008) return;
    lvl = level;
    if (liq) { g.remove(liq); liq.geometry.dispose(); liq = null; }
    if (surf) { g.remove(surf); surf = null; }
    if (level < 0.002) return;
    { const rr = rAt(level) * 0.995, q = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; q.push(new THREE.Vector3(Math.cos(a) * rr, level, Math.sin(a) * rr)); } surf = polyline(q, { width: 1.4, color: "#3f5d70", opacity: 0.85 }); g.add(surf); }
    const p = [new THREE.Vector2(0, 0.0025)];
    for (const [, y] of wall) if (y > 0.0025 && y < level) p.push(new THREE.Vector2(rAt(y), y));
    p.splice(1, 0, new THREE.Vector2(rAt(0.0025), 0.0025));
    p.push(new THREE.Vector2(rAt(level), level), new THREE.Vector2(0, level));
    liq = new THREE.Mesh(new THREE.LatheGeometry(p, segments), liqMat);
    liq.renderOrder = 1; g.add(liq);
  }
  function mixColor(a, b, k) { const c = new THREE.Color(a).lerp(new THREE.Color(b), k); liqMat.color.copy(c); liqMat.emissive.copy(c); }
  const wp = new THREE.Vector3();
  function frame(camera) {                                     // 每帧：两侧轮廓线朝着镜头
    g.getWorldPosition(wp);
    const d = new THREE.Vector3().subVectors(camera.position, wp); d.y = 0; d.normalize();
    const inv = new THREE.Quaternion(); g.getWorldQuaternion(inv); inv.invert(); d.applyQuaternion(inv);
    const px = -d.z, pz = d.x, pos = [];
    for (const s of [1, -1]) for (let i = 1; i < wall.length; i++) {
      const [r0, y0] = wall[i - 1], [r1, y1] = wall[i];
      pos.push(s * px * r0, y0, s * pz * r0, s * px * r1, y1, s * pz * r1);
    }
    sil.geometry.dispose(); sil.geometry = new LineSegmentsGeometry().setPositions(pos);
  }
  g.userData = { top, rAt, setLiquid, mixColor, frame, liqMat, level: () => lvl };
  return g;
}
export function beaker({ r = 0.07, h = 0.15 } = {}) { return glassVessel([[r, 0], [r, h], [r + 0.004, h + 0.003]]); }
export function flask({ r = 0.085, h = 0.21, neck = 0.024, neckH = 0.06 } = {}) {
  return glassVessel([[r * 0.97, 0], [r, 0.008], [neck, h - neckH], [neck, h], [neck + 0.004, h + 0.002]]);
}
export function testTube({ r = 0.016, h = 0.13 } = {}) {
  const w = []; for (let i = 1; i <= 8; i++) { const a = i / 8 * Math.PI / 2; w.push([r * Math.sin(a), r * (1 - Math.cos(a))]); }
  return glassVessel([...w, [r, h], [r + 0.002, h + 0.002]], { segments: 32 });
}

// 橡胶塞
export function stopper({ r = 0.026, h = 0.03 } = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 0.86, h, 32), hatchMat({ color: CHEM.rubber, mode: "uv", uvScale: [16, 3], freq: 1, amt: 0.5 }));
  m.castShadow = true; hull(m, { scale: 1.05 });
  const g = new THREE.Group(); m.position.y = h / 2; g.add(m); return g;
}

// 电子天平：setReading(克数) 改液晶读数；plateY 是秤盘上表面高度
export function electronicBalance({ w = 0.3, d = 0.26 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, 0.055, d), hatchMat({ color: "#ecebe6", freq: 280 }));
  body.position.y = 0.0275; body.castShadow = body.receiveShadow = true; edges(body); g.add(body);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.008, 48), hatchMat({ color: "#d3d9de", mode: "uv", uvScale: [40, 2], freq: 1, metal: 0.2, rough: 0.4 }));
  plate.position.set(0, 0.059, -0.02); plate.castShadow = plate.receiveShadow = true; hull(plate, { scale: 1.02 }); g.add(plate);
  let last = "";
  const draw = (ctx, cw, ch, txt = "0.00") => {
    ctx.fillStyle = "#c9dbbd"; ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = "#5c6b55"; ctx.lineWidth = 6; ctx.strokeRect(3, 3, cw - 6, ch - 6);
    ctx.fillStyle = "#1e2a1d"; ctx.font = `700 ${ch * 0.62}px "DejaVu Sans Mono", "Consolas", "Menlo", monospace`; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText(txt, cw * 0.82, ch * 0.54);
    ctx.font = `700 ${ch * 0.36}px "DejaVu Sans Mono", monospace`; ctx.fillText("g", cw * 0.95, ch * 0.6);
  };
  const tex = canvasTex(640, 160, draw);
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.0425), new THREE.MeshBasicMaterial({ map: tex }));
  disp.position.set(-0.02, 0.031, d / 2 + 0.0008); g.add(disp);
  for (const [i, t] of [[0, "#e0662a"], [1, "#ecebe6"]].entries()) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.012, 0.004), new THREE.MeshStandardMaterial({ color: t[1] }));
    b.position.set(0.1 + i * 0.03, 0.03, d / 2 + 0.002); edges(b, { width: 1 }); g.add(b);
  }
  g.userData = { plateY: 0.063, plateZ: -0.02, setReading(grams) { const s = grams.toFixed(2); if (s !== last) { last = s; tex.userData.redraw((ctx, cw, ch) => draw(ctx, cw, ch, s)); } } };
  return g;
}

// 酒精灯：lit(true/false)；step(dt) 让火苗跳
export function alcoholLamp() {
  const g = new THREE.Group();
  const body = glassVessel([[0.045, 0], [0.05, 0.02], [0.045, 0.05], [0.016, 0.07], [0.016, 0.08]]);
  body.userData.setLiquid(0.035, "#eef3f6"); g.add(body);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.02, 12), new THREE.MeshStandardMaterial({ color: "#efe8d6" }));
  wick.position.y = 0.09; g.add(wick);
  const flameMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uT: { value: 0 } },
    vertexShader: `varying vec2 vUv; uniform float uT; void main(){ vUv = uv; vec3 p = position; p.x += sin(uT*9.0 + p.y*60.0) * 0.002 * vUv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
    fragmentShader: `varying vec2 vUv; void main(){ float a = smoothstep(1.0, 0.55, vUv.y) * 0.95; vec3 c = mix(vec3(0.35,0.55,1.0), vec3(1.0,0.62,0.18), smoothstep(0.08, 0.35, vUv.y)); c = mix(c, vec3(1.0,0.9,0.5), smoothstep(0.45, 0.9, vUv.y)*0.6); gl_FragColor = vec4(c, a); }`,
  });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.055, 24, 6, true), flameMat);
  flame.position.y = 0.127; flame.visible = false; g.add(flame);
  g.userData = { lit(on) { flame.visible = on; }, step(dt) { flameMat.uniforms.uT.value += dt; flame.scale.y = 1 + Math.sin(flameMat.uniforms.uT.value * 7) * 0.06; }, frame: body.userData.frame };
  return g;
}

// 铁架台：底座 + 立杆 + 一个铁圈（ringY 高度）
export function ironStand({ h = 0.42, ringY = 0.2, ringR = 0.05 } = {}) {
  const g = new THREE.Group(), steel = hatchMat({ color: "#c9ced3", mode: "uv", uvScale: [12, 20], freq: 1, metal: 0.2, rough: 0.5 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.014, 0.13), hatchMat({ color: "#d6d2c8", freq: 300 }));
  base.position.y = 0.007; base.castShadow = true; edges(base); g.add(base);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, h, 16), steel);
  rod.position.set(-0.07, h / 2, -0.03); rod.castShadow = true; hull(rod, { scale: 1.2 }); g.add(rod);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR, 0.003, 8, 48), steel);
  ring.rotation.x = Math.PI / 2; ring.position.set(0, ringY, -0.03); ring.castShadow = true; g.add(ring);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.07 - ringR, 8), steel);
  arm.rotation.z = Math.PI / 2; arm.position.set(-0.07 + (0.07 - ringR) / 2, ringY, -0.03); g.add(arm);
  g.userData = { ringTop: ringY + 0.003, ringZ: -0.03 };
  return g;
}

// 气泡：在容器里冒，碰到液面就破。emit(个数, 出生点函数)；step(dt, 液面高度)
export function bubbles(parent, { max = 90, size = 0.006 } = {}) {
  const geo = new THREE.SphereGeometry(1, 10, 8);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.2, emissive: "#ffffff", emissiveIntensity: 0.45 }), max);
  const rim = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: "#5d6f7a", side: THREE.BackSide }), max);   // 一圈深色边，浅色液体里也看得见
  mesh.count = rim.count = max; parent.add(rim, mesh); mesh.renderOrder = rim.renderOrder = 3;
  const B = Array.from({ length: max }, () => ({ on: false, p: new THREE.Vector3(), v: 0, s: 0, ph: Math.random() * 6 }));
  const m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < max; i++) { mesh.setMatrixAt(i, zero); rim.setMatrixAt(i, zero); }
  return {
    emit(n, at) { for (const b of B) { if (n <= 0) break; if (b.on) continue; b.on = true; b.p.copy(at()); b.v = 0.05 + Math.random() * 0.07; b.s = size * (0.6 + Math.random() * 0.8); n--; } },
    step(dt, surface) {
      B.forEach((b, i) => {
        if (b.on) { b.p.y += b.v * dt; b.ph += dt * 9; b.p.x += Math.sin(b.ph) * 0.0004; if (b.p.y > surface) b.on = false; }
        mesh.setMatrixAt(i, b.on ? m4.compose(b.p, new THREE.Quaternion(), new THREE.Vector3(b.s, b.s, b.s)) : zero);
        rim.setMatrixAt(i, b.on ? m4.compose(b.p, new THREE.Quaternion(), new THREE.Vector3(b.s * 1.3, b.s * 1.3, b.s * 1.3)) : zero);
      });
      mesh.instanceMatrix.needsUpdate = true; rim.instanceMatrix.needsUpdate = true;
    },
    clear() { for (const b of B) b.on = false; },
  };
}

// 冒出来的气体：从瓶口飘出、变大、变淡。emit(个数, 出生点)；step(dt)
export function gasPuffs(parent, { max = 40, color = "#aeb9c0" } = {}) {
  const tex = canvasTex(128, 128, (ctx) => { const gr = ctx.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128); });
  const P = Array.from({ length: max }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; parent.add(s); return { s, age: 9, life: 2.4, v: new THREE.Vector3() }; });
  return {
    emit(n, at) { for (const p of P) { if (n <= 0) break; if (p.age < p.life) continue; p.age = 0; p.s.position.copy(at); p.v.set((Math.random() - 0.5) * 0.02, 0.05 + Math.random() * 0.03, (Math.random() - 0.5) * 0.02); p.s.visible = true; n--; } },
    step(dt) { for (const p of P) { if (p.age >= p.life) { p.s.visible = false; continue; } p.age += dt; p.s.position.addScaledVector(p.v, dt); const k = p.age / p.life; p.s.scale.setScalar(0.03 + k * 0.08); p.s.material.opacity = 0.8 * (1 - k * k); } },
    clear() { for (const p of P) { p.age = 9; p.s.visible = false; } },
  };
}

// 一小堆粉末（setAmount(0–1) 反应时变少）
export function powder({ r = 0.045, h = 0.02, color = CHEM.na2co3 } = {}) {
  const p = []; for (let i = 0; i <= 12; i++) { const t = i / 12; p.push(new THREE.Vector2(r * (1 - t), h * Math.sin((1 - t) * Math.PI / 2) ** 0.6 * (t < 1 ? 1 : 0) + (t === 1 ? h : 0))); }
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(r, 0), ...p.slice(1)];
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), hatchMat({ color, freq: 600, amt: 0.55, base: 0.45 }));
  m.castShadow = true; hull(m, { scale: 1.06 });
  const g = new THREE.Group(); g.add(m);
  g.userData = { setAmount(k) { m.visible = k > 0.02; m.scale.set(Math.sqrt(k), k, Math.sqrt(k)); } };
  return g;
}

// 铁钉（原点在钉帽，往 -y 方向）：setCopper(0–1) 表面变红
export function nail({ L = 0.075 } = {}) {
  const mat = hatchMat({ color: CHEM.iron, mode: "uv", uvScale: [10, 24], freq: 1, metal: 0.3, rough: 0.45, base: 0.3 });
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.003, 24), mat); head.position.y = -0.0015;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, L, 16), mat); shaft.position.y = -0.003 - L / 2;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0035, 0.012, 16), mat); tip.rotation.x = Math.PI; tip.position.y = -0.003 - L - 0.006;
  for (const m of [head, shaft, tip]) { m.castShadow = true; hull(m, { scale: 1.15 }); g.add(m); }
  const iron = new THREE.Color(CHEM.iron), cu = new THREE.Color(CHEM.copper);
  g.userData = { length: L + 0.015, setCopper(k) { const c = iron.clone().lerp(cu, k); mat.color.copy(c); mat.userData.hatch.uBaseCol.value.copy(c); } };
  return g;
}

// 一根会变的线（吊绳、导管）：set([Vector3...])
export function wire(parent, { color = INK, width = 1.3 } = {}) {
  const l = new LineSegments2(new LineSegmentsGeometry(), lineMat(color, width)); parent.add(l);
  return { line: l, set(pts) { const pos = []; for (let i = 0; i < pts.length - 1; i++) pos.push(...pts[i].toArray(), ...pts[i + 1].toArray()); l.geometry.dispose(); l.geometry = new LineSegmentsGeometry().setPositions(pos); } };
}
