// 页面上的小部件：拨动开关（立在书页上，点一下就切换）
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { INK, HAND, hatchMat, edges, hull, canvasTex } from "./hatch.js";

export function pageSwitch({ label = "开关", on = false, onChange = () => {}, accent = "#f07a2a" } = {}) {
  const g = new THREE.Group();
  const W = 0.16, D = 0.05;
  const base = new THREE.Mesh(new RoundedBoxGeometry(W, 0.008, D, 2, 0.004), hatchMat({ color: "#f3ecdc", freq: 320 }));
  base.position.y = 0.004; base.castShadow = base.receiveShadow = true; edges(base, { width: 1.1 }); g.add(base);
  const draw = (ctx, w, h, v) => {
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = INK; ctx.font = `${h * 0.42}px ${HAND}`; ctx.textBaseline = "middle";
    ctx.fillText(label, 14, h * 0.5);
    ctx.font = `${h * 0.34}px ${HAND}`; ctx.fillStyle = v ? "#c2551f" : "#8a857a"; ctx.textAlign = "right"; ctx.fillText(v ? "开" : "关", w - 10, h * 0.52);
  };
  const tex = canvasTex(512, 160, (ctx, w, h) => draw(ctx, w, h, on));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.62, D * 0.8), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  face.rotation.x = -Math.PI / 2; face.position.set(-W * 0.17, 0.0085, 0); g.add(face);
  const track = new THREE.Mesh(new RoundedBoxGeometry(0.046, 0.004, 0.018, 2, 0.008), new THREE.MeshStandardMaterial({ color: "#d9d2c3", roughness: 0.8 }));
  track.position.set(W * 0.33, 0.0095, 0); edges(track, { width: 1 }); g.add(track);
  const knobMat = new THREE.MeshStandardMaterial({ color: on ? accent : "#bdb7ab", roughness: 0.5 });
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 0.012, 24), knobMat);
  knob.castShadow = true; hull(knob, { scale: 1.12 }); g.add(knob);
  let v = on, k = on ? 1 : 0;
  const place = () => knob.position.set(W * 0.33 + (k - 0.5) * 0.026, 0.017, 0);
  place();
  const api = {
    group: g, hit: base, get: () => v,
    set(x, silent) { v = !!x; knobMat.color.set(v ? accent : "#bdb7ab"); tex.userData.redraw((ctx, w, h) => draw(ctx, w, h, v)); if (!silent) onChange(v); },
    toggle() { api.set(!v); },
    step(dt) { k += ((v ? 1 : 0) - k) * Math.min(1, dt * 14); place(); },
  };
  for (const m of [base, face, track, knob]) m.userData.widget = api;
  return api;
}
