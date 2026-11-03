// 能量量筒：每种能量一只量筒，液面高度 = 这种能量有多少；管子里有颜色在流 = 能量正在从一种变成另一种
import * as THREE from "three";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { INK, hatchMat, edges, polyline, lineMat, tagCard } from "./hatch.js";
import { FLAT } from "./book.js";

export const ENERGY_COLORS = { pe: "#3d7cf2", ke: "#f0782a", q: "#e0475a", ee: "#2fae6b", ch: "#8d5bd6" };   // 重力势能、动能、内能、弹性势能、化学能

// kinds: [{ key, name, color? }]；pipes: [[从第几只, 到第几只]]；max：量筒装满时是多少焦
export function makeEnergy(parent, { kinds, pipes = [], max = 1, x0 = 0.52, dx = 0.18, z = -0.2, stand = 0.07, r = 0.055, h = 0.25, unit = "J", digits = 2 } = {}) {
  const g = new THREE.Group(); parent.add(g);
  const wood = hatchMat({ color: "#efe6d5", freq: 260 }), wood2 = hatchMat({ color: "#e8d6b4", freq: 300, angle: -0.6 });
  const top = FLAT + stand, x1 = x0 + dx * (kinds.length - 1);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.18, 0.018, 0.15), wood);
  shelf.position.set((x0 + x1) / 2, top - 0.009, z); shelf.castShadow = shelf.receiveShadow = true; edges(shelf); g.add(shelf);
  for (const lx of [x0 - 0.09 + 0.01, x1 + 0.09 - 0.01]) for (const lz of [-0.06, 0.06]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.014, stand - 0.018, 0.014), wood2);
    leg.position.set(lx, FLAT + (stand - 0.018) / 2, z + lz); leg.castShadow = true; edges(leg, { width: 1 }); g.add(leg);
  }
  const glass = new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.16, roughness: 0.15, depthWrite: false, side: THREE.DoubleSide });
  const K = kinds.map((k, i) => ({ ...k, color: k.color ?? ENERGY_COLORS[k.key] ?? "#888888", x: x0 + dx * i, last: "" }));
  const sil = [];
  for (const k of K) {
    const cg = new THREE.Group(); cg.position.set(k.x, top, z); g.add(cg);
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, 1, 48), new THREE.MeshStandardMaterial({ color: k.color, roughness: 0.45, emissive: k.color, emissiveIntensity: 0.22 }));
    liq.castShadow = true; cg.add(liq); k.liq = liq;
    const glow = new THREE.PointLight(k.color, 0, 0.45, 2); glow.position.set(0, h * 0.45, 0.02); cg.add(glow); k.glow = glow;   // 液体的颜色映到周围
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 48, 1, true), glass);
    cyl.position.y = h / 2; cg.add(cyl);
    for (const y of [0.001, h]) { const pts = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); } cg.add(polyline(pts, { width: 1.3 })); }
    for (let i = 1; i <= 4; i++) { const y = h * 0.92 * i / 4; cg.add(polyline([new THREE.Vector3(-0.012, y, r + 0.001), new THREE.Vector3(0.012, y, r + 0.001)], { width: 1.1, opacity: 0.7 })); }
    const s = new LineSegments2(new LineSegmentsGeometry(), lineMat(INK, 1.3)); cg.add(s); sil.push({ s, cg });
    // 量筒挨得近时卡片跟着变窄，不然相邻两张叠在一起、字被盖住
    const tag = tagCard({ lines: [k.name, `0.00 ${unit}`], w: Math.min(0.17, dx * 0.94), h: 0.085, sizes: [k.name.length > 5 ? 30 : 38, 58], px: 512 });
    tag.position.set(k.x, FLAT, z + 0.115); g.add(tag); k.tag = tag;
  }
  const tubes = pipes.map(([a, b]) => {
    const A = K[a], B = K[b], t = top + h;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(A.x, t - 0.03, z), new THREE.Vector3(A.x + Math.sign(B.x - A.x) * 0.004, t + 0.035, z),
      new THREE.Vector3((A.x + B.x) / 2, t + 0.075 + 0.02 * Math.abs(b - a - 1), z), new THREE.Vector3(B.x - Math.sign(B.x - A.x) * 0.004, t + 0.035, z), new THREE.Vector3(B.x, t - 0.03, z),
    ]);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uFrom: { value: new THREE.Color(A.color) }, uTo: { value: new THREE.Color(B.color) }, uFlow: { value: 0 }, uTime: { value: 0 }, uDir: { value: 1 }, uInk: { value: new THREE.Color(INK) } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uFrom, uTo, uInk; uniform float uFlow, uTime, uDir; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){
          float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
          float edge = smoothstep(0.78, 0.93, rim);
          float u = uDir > 0.0 ? vUv.x : 1.0 - vUv.x;
          float blob = smoothstep(0.35, 0.65, fract(u * 9.0 - uTime * 1.6));
          float fill = uFlow * mix(0.55, 1.0, blob);
          vec3 c = uDir > 0.0 ? mix(uFrom, uTo, smoothstep(0.2, 0.8, vUv.x)) : mix(uTo, uFrom, smoothstep(0.2, 0.8, 1.0 - vUv.x));
          vec3 col = mix(vec3(1.0), c, fill);
          gl_FragColor = vec4(mix(col, uInk, edge), max(0.2 + fill * 0.8, edge));
          #include <colorspace_fragment>
        }`,
    });
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.011, 14), mat));
    return mat;
  });
  return {
    group: g,
    // values：{ pe: 0.29, ke: 0.1, ... }（焦）
    set(values) {
      for (const k of K) {
        const v = values[k.key] ?? 0, lv = Math.max(0.0005, Math.min(1, v / max)) * h * 0.92;
        k.liq.scale.y = lv; k.liq.position.y = lv / 2;
        k.glow.intensity = 0.35 * Math.min(1, v / max); k.glow.position.y = lv * 0.6;
        const txt = `${v.toFixed(digits)} ${unit}`;
        if (txt !== k.last) { k.last = txt; k.tag.userData.set([k.name, txt]); }
      }
    },
    // 第 i 根管子的流量 0–1；dir = -1 表示倒着流（比如动能变回势能）
    flow(i, v, dir = 1) { if (tubes[i]) { tubes[i].uniforms.uFlow.value = v; tubes[i].uniforms.uDir.value = dir; } },
    time(t) { for (const m of tubes) m.uniforms.uTime.value = t; },
    updateSilhouettes(camera) {
      const cp = new THREE.Vector3();
      for (const { s, cg } of sil) {
        cg.getWorldPosition(cp);
        const d = new THREE.Vector3().subVectors(camera.position, cp); d.y = 0; d.normalize();
        const p = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(r);
        s.geometry.dispose();
        s.geometry = new LineSegmentsGeometry().setPositions([p.x, 0, p.z, p.x, h, p.z, -p.x, 0, -p.z, -p.x, h, -p.z]);
      }
    },
  };
}
