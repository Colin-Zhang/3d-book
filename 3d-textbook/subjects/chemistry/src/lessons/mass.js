// 化学范例课：质量守恒定律——锥形瓶放在电子天平上，反应完读数变不变？
// 两个反应对比：铁钉 + 硫酸铜溶液（没有气体）、碳酸钠 + 稀盐酸（放出二氧化碳）；容器可以敞口或塞紧
import * as THREE from "three";
import { tagCard, label } from "../hatch.js";
import { FLAT } from "../book.js";
import { CHEM, flask, testTube, stopper, electronicBalance, bubbles, gasPuffs, powder, nail, wire } from "../parts/chemistry.js";

export const meta = {
  barTitle: "第 1 课 · 读数变了吗",
  goLabel: "开始反应 ▶",
  pages: {
    chapter: "化学 · 质量守恒定律", lessonNo: "第 1 课",
    title: "读数变了吗", subtitle: "反应前后，质量变不变？",
    body: "把铁钉放进蓝色的硫酸铜溶液，铁钉表面慢慢变红，溶液变成浅绿色——生成了新物质。东西都变了，放在天平上的总质量会不会跟着变？",
    predict: { q: "铁钉和硫酸铜反应完，天平的读数会——", options: ["变大", "不变", "变小"] },
    try: "先做铁钉，再换成碳酸钠和盐酸；敞口、塞紧各试一次，记下读数怎么变。",
    answer: { text: "不变。参加反应的物质总质量，等于生成物的总质量。碳酸钠和盐酸敞口时，二氧化碳跑进空气，读数才变小。", extra: "Fe + CuSO₄ = FeSO₄ + Cu" },
    pageNo: [112, 113],
    right: {
      header: ["质量守恒定律", "读数变了吗"],
      caption: "图 1-1　在电子天平上做化学反应",
      hint: "点“开始反应”或者点锥形瓶；拖动画面可以转着看。",
      figure(ctx, o) {
        ctx.translate(o.x + 380, o.y + 40); ctx.strokeStyle = "rgba(59,58,54,0.55)"; ctx.lineWidth = 3; ctx.lineJoin = "round";
        ctx.strokeRect(-150, 230, 300, 50); ctx.strokeRect(-60, 245, 90, 22);                // 天平、显示屏
        ctx.beginPath(); ctx.moveTo(-90, 228); ctx.lineTo(90, 228); ctx.stroke();            // 秤盘
        ctx.beginPath(); ctx.moveTo(-70, 226); ctx.lineTo(-18, 60); ctx.lineTo(-18, 10); ctx.moveTo(18, 10); ctx.lineTo(18, 60); ctx.lineTo(70, 226); ctx.stroke();   // 锥形瓶
        ctx.beginPath(); ctx.moveTo(-58, 190); ctx.lineTo(58, 190); ctx.stroke();            // 液面
      },
    },
  },
};

export const controls = [
  { key: "rx", label: "反应", options: [["铁钉+硫酸铜", "fe"], ["碳酸钠+盐酸", "co3"]] },
  { key: "seal", label: "容器", options: [["敞口", "open"], ["塞紧", "sealed"]] },
];
export const cams = {
  rig: { pos: [0.56, 1.04, 1.48], tgt: [0.5, 0.24, 0.12] },
  rigWide: { pos: [0.45, 1.35, 1.8], tgt: [0.46, 0.16, 0.06] },
};
export const clip = { set: { rx: "co3", seal: "open" }, pick: 1, from: "rigWide", to: "rig", push: 1.6, startAt: 1.4, dur: 8 };

const BX = 0.5, BZ = 0.1, SCALE = 1.5;         // 天平放在右页这里，器材按 1.5 倍放大
const M0 = { fe: 125.0, co3: 118.6 }, CO2 = 0.88;   // 起始读数（克）；2.12 g 碳酸钠完全反应放出 0.88 g 二氧化碳
const T_ACT = 1.0, T_REACT = 5.0;

export function build(book, { billboard, sfx }) {
  const g = new THREE.Group(); book.add(g);
  const rig = new THREE.Group(); rig.position.set(BX, FLAT, BZ); rig.scale.setScalar(SCALE); g.add(rig);   // 天平 + 锥形瓶整体放大
  const bal = electronicBalance(); rig.add(bal);
  const F = flask(); F.position.set(0, bal.userData.plateY, bal.userData.plateZ); rig.add(F);
  const top = F.userData.top;
  const plug = stopper(); plug.position.set(0, top - 0.014, 0); F.add(plug);
  // 铁钉 + 吊绳
  const N = nail(); F.add(N);
  const thread = wire(F, { width: 1.1 });
  // 碳酸钠粉末 + 装稀盐酸的小试管
  const P = powder(); P.position.set(0.012, 0.003, 0); F.add(P);
  const tubePivot = new THREE.Group(); tubePivot.position.set(-0.036, 0.004, 0); F.add(tubePivot);
  const tube = testTube({ r: 0.014, h: 0.11 }); tubePivot.add(tube);
  const bub = bubbles(F), puff = gasPuffs(g);
  const co2 = billboard(label("CO₂", { color: "#5f5a51" }), 0.09); g.add(co2);
  const what = tagCard({ lines: ["瓶里装的", "硫酸铜溶液 + 铁钉"], w: 0.3, h: 0.1, sizes: [34, 46], px: 640 });
  what.position.set(0.19, FLAT, 0.43); g.add(what);
  const record = tagCard({ lines: ["记录", "—", "", ""], w: 0.28, h: 0.17, sizes: [34, 38, 38, 38], px: 640, bg: "#fbefd9" });
  record.position.set(0.82, FLAT, 0.43); g.add(record);
  const rows = [];

  const st = { rx: "fe", seal: "open", phase: "ready", t: 0, p: 0, reading: M0.fe };
  const busy = () => st.phase === "act" || st.phase === "react";
  function layout() {
    const fe = st.rx === "fe", sealed = st.seal === "sealed";
    plug.visible = sealed;
    N.visible = fe; thread.line.visible = fe; P.visible = !fe; tubePivot.visible = !fe;
    what.userData.set(["瓶里装的", fe ? "硫酸铜溶液 + 铁钉" : "碳酸钠粉末 + 稀盐酸"]);
  }
  function reset() {
    sfx.loop("fizz").set(0); sfx.loop("pour").set(0);
    Object.assign(st, { phase: "ready", t: 0, p: 0, reading: M0[st.rx] });
    bub.clear(); puff.clear(); co2.visible = false;
    if (st.rx === "fe") { F.userData.setLiquid(0.07, CHEM.cuso4); F.userData.mixColor(CHEM.cuso4, CHEM.cuso4, 0); N.userData.setCopper(0); }
    else { F.userData.setLiquid(0, CHEM.hcl); tube.userData.setLiquid(0.07, CHEM.hcl); tubePivot.rotation.z = -0.2; P.userData.setAmount(1); }
    layout(); sync();
  }
  function sync() {
    const fe = st.rx === "fe";
    if (fe) {
      const k = st.phase === "ready" ? 0 : Math.min(1, st.t / T_ACT);
      const y = top - 0.035 - k * 0.075;                       // 钉帽高度：先吊在液面上，开始后放下去
      N.position.set(0, y, 0);
      thread.set([new THREE.Vector3(0, top + 0.002, 0), new THREE.Vector3(0, y, 0)]);
    }
    bal.userData.setReading(st.reading);
  }
  function finish() {
    const d = st.reading - M0[st.rx];
    const name = `${st.rx === "fe" ? "铁钉" : "碳酸钠"}·${st.seal === "open" ? "敞口" : "塞紧"}`;
    const txt = `${name}　${Math.abs(d) < 0.005 ? "不变" : `${d.toFixed(2)} g`}`;
    const i = rows.findIndex((r) => r.startsWith(name)); if (i >= 0) rows.splice(i, 1);
    rows.push(txt); if (rows.length > 3) rows.shift();
    record.userData.set(["记录", ...rows, "", ""].slice(0, 4));
  }
  function step(dt) {
    puff.step(dt);
    bub.step(dt, Math.max(0.004, F.userData.level()));
    if (!busy()) { sync(); return; }
    st.t += dt;
    const fe = st.rx === "fe", open = st.seal === "open";
    if (st.phase === "act") {
      if (fe && st.t >= T_ACT * 0.8 && st.t - dt < T_ACT * 0.8) sfx.pop();   // 铁钉碰到液面
      if (!fe) {                                                 // 小试管倒下，稀盐酸流进瓶底
        const k = Math.min(1, st.t / T_ACT), e = k * k * (3 - 2 * k);
        sfx.loop("pour").set(k > 0.3 && k < 0.95 ? 0.8 : 0);
        tubePivot.rotation.z = -0.2 - e * 1.1;
        tube.userData.setLiquid(0.07 * (1 - e), CHEM.hcl);
        F.userData.setLiquid(0.034 * e, CHEM.hcl);
      }
      if (st.t >= T_ACT) { st.phase = "react"; st.t = 0; sfx.loop("pour").set(0); }
    } else {
      st.p = 1 - Math.exp(-3.2 * st.t / T_REACT);
      const p = Math.min(1, st.p / (1 - Math.exp(-3.2)));
      if (fe) {
        F.userData.mixColor(CHEM.cuso4, CHEM.feso4, p * 0.9);
        N.userData.setCopper(p * 0.85);
      } else {
        const rate = (1 - p) * 70 * dt + (Math.random() < (1 - p) ? 1 : 0);
        bub.emit(Math.round(rate), () => new THREE.Vector3((Math.random() - 0.4) * 0.06, 0.006 + Math.random() * 0.01, (Math.random() - 0.5) * 0.06));
        P.userData.setAmount(1 - 0.85 * p);
        sfx.loop("fizz").set((1 - p) * 0.9);
        if (open) {
          const mouth = new THREE.Vector3(); F.localToWorld(mouth.set(0, top + 0.01, 0)); g.worldToLocal(mouth);
          if (Math.random() < (1 - p) * 0.9) puff.emit(1, mouth);
          co2.visible = p < 0.95; co2.position.copy(mouth).add(new THREE.Vector3(0.08, 0.08, 0));
          st.reading = M0.co3 - CO2 * p;
        }
      }
      if (st.t >= T_REACT) { st.phase = "done"; st.reading = fe || !open ? M0[st.rx] : M0.co3 - CO2; co2.visible = false; sfx.loop("fizz").set(0); sfx.beep(); finish(); }
    }
    sync();
  }
  reset();
  return {
    st, step, reset, busy,
    done: () => st.phase === "done",
    start() { if (st.phase === "done") reset(); if (st.phase === "ready") { st.phase = "act"; st.t = 0; sfx.ding(); } },
    get: (k) => st[k],
    set(k, v) { if (busy()) return; st[k] = v; reset(); },
    clickables: [F.children[0]],
    click() { this.start(); },
    frame(camera) { F.userData.frame(camera); tube.userData.frame(camera); },
  };
}
