// 3D 课本引擎：桌子、书、灯、镜头、翻页、立体书弹起、拖拽、开关、音效、底部工具条、截图接口
// 每一课的内容在 src/lessons/<名字>.js：可以只有一个跨页（导出 meta / controls / cams / build），也可以导出 spreads: [跨页, 跨页, ...]
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { setLineRes, REVEAL, canvasTex } from "./hatch.js";
import { makeDesk, makeBook, FLAT } from "./book.js";
import { pageSwitch } from "./widgets.js";
import { sfx, unlock, setMuted, isMuted } from "./sfx.js";

const ease = (k) => k * k * (3 - 2 * k);
const easeIn = (k) => k * k;
const backOut = (k) => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

// start(L)：L 是一课的模块。开发时由 boot.js 按 ?lesson= 载入；打包成单个 HTML 时直接传进来
export async function start(L, NAME = "lesson") {
  const CAPTURE = new URLSearchParams(location.search).has("capture");
  for (const f of ['48px "WenKai"', '48px "Noto Serif CJK SC"', '700 48px "Noto Serif CJK SC"']) { try { await document.fonts.load(f); } catch {} }
  await document.fonts.ready;
  const SP = L.spreads ?? [L];
  document.title = `3D 课本 · ${L.title ?? SP[0].meta.pages.section?.title ?? SP[0].meta.pages.title}`;

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: CAPTURE });
  renderer.setPixelRatio(CAPTURE ? 1 : Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById("stage").appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e7e1d6");
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 30);

  // 灯：天光 + 正面补光 + 左后上方的弱太阳 + 主光“窗户”（带窗格图案的聚光灯，窗框的影子斜着压过书本，落在书页上变成排线）
  scene.add(new THREE.HemisphereLight("#fffaf0", "#cfc6b6", 1.25));
  const fill = new THREE.DirectionalLight("#fffdf8", 0.5); fill.position.set(0.4, 2.2, 3.2); scene.add(fill);
  const sun = new THREE.DirectionalLight("#fff6e8", 0.55); sun.position.set(-2.2, 3.4, -1.4); scene.add(sun);
  const cookie = canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
    ctx.filter = "blur(9px)"; ctx.fillStyle = "#fff";
    for (const [x, y] of [[40, 40], [262, 40], [40, 262], [262, 262]]) ctx.fillRect(x, y, 210, 210);   // 四格窗
    ctx.filter = "none";
  });
  const win = new THREE.SpotLight("#fff1d8", 1.8, 0, 0.46, 0.35, 0);
  win.position.set(-3.0, 4.4, -1.6); win.target.position.set(0.25, 0, 0.2);
  win.map = cookie; win.castShadow = true; win.shadow.mapSize.set(2048, 2048);
  win.shadow.bias = -0.0003; win.shadow.normalBias = 0.012; win.shadow.camera.near = 2.5; win.shadow.camera.far = 10;
  scene.add(win, win.target);

  const desk = makeDesk(scene);
  const B = makeBook(scene, desk.top, SP.map((s) => s.meta.pages), L.cover ?? { title: L.title ?? "3D 课本" });
  const billboards = [];

  // 每个跨页：装置放在一个“铰链”组里，翻页时折下去、到页时弹起来
  const S = SP.map((def, i) => {
    const pivot = new THREE.Group(); pivot.position.set(0, FLAT, def.hinge ?? 0); B.book.add(pivot);
    const content = new THREE.Group(); content.position.set(0, -FLAT, -(def.hinge ?? 0)); pivot.add(content);
    const drags = [], widgets = [];
    const ctx = {
      camera, sfx,
      billboard: (m, s) => { m.scale.setScalar(s); billboards.push(m); return m; },
      // draggable(网格, { name, plane: "xy" | "xz", onStart(点), onMove(点), onEnd() })：点都是书的本地坐标
      draggable(obj, h) { const d = { obj, plane: "xy", ...h }; drags.push(d); obj.traverse((o) => { o.userData.drag = d; }); return obj; },
      // pageSwitch({ label, on, onChange })：立在书页上的拨动开关，返回 { group, set, get, toggle }
      pageSwitch(opts) { const w = pageSwitch(opts); widgets.push(w); content.add(w.group); return w; },
    };
    const K = def.build(content, ctx);
    pivot.visible = i === 0;
    return { def, pivot, content, K, drags, widgets };
  });
  let cur = 0;
  const A = () => S[cur];

  // 镜头：overview（整本书）、page（左页）+ 每个跨页自己的
  const CAMS = { overview: { pos: [0.1, 2.32, 2.14], tgt: [0.1, 0.03, 0.02] }, page: { pos: [-0.5, 1.55, 1.25], tgt: [-0.5, 0.05, 0.12] } };
  const camOf = (n) => (typeof n === "string" ? (A().def.cams?.[n] ?? CAMS[n] ?? SP.map((s) => s.cams?.[n]).find(Boolean)) : n);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 0.5, maxDistance: 4.5, minPolarAngle: 0.25, maxPolarAngle: 1.3, enabled: !CAPTURE });
  function setCam(c) { c = camOf(c); camera.position.set(...c.pos); controls.target.set(...c.tgt); camera.lookAt(controls.target); controls.update(); }
  setCam(L.startCam ?? "overview");

  // ———— 翻页：折下 → 纸翻过去 → 新的一页弹起来（线稿先出来，再上排线和明暗） ————
  const flip = { phase: null, t: 0, to: 0, dir: 1 };
  function goTo(i) {
    if (flip.phase || i < 0 || i >= S.length || i === cur) return false;
    flip.to = i; flip.phase = "fold"; flip.t = 0; sfx.paper(); sfx.silence(); return true;
  }
  function popIn() { flip.phase = "pop"; flip.t = 0; A().pivot.visible = true; A().pivot.rotation.x = -1.5; REVEAL.value = 0; }
  function stepFlip(dt) {
    if (!flip.phase) return;
    flip.t += dt;
    if (flip.phase === "fold") {
      const k = Math.min(1, flip.t / 0.32); A().pivot.rotation.x = -1.5 * easeIn(k);
      if (k >= 1) { A().pivot.visible = false; flip.dir = B.beginFlip(flip.to); flip.phase = "turn"; flip.t = 0; sfx.page(); }
    } else if (flip.phase === "turn") {
      const k = Math.min(1, flip.t / 0.85), th = Math.PI * ease(k);
      B.sheet.set(flip.dir > 0 ? th : Math.PI - th, flip.dir);
      if (flip.dir > 0 && k > 0.82) B.landFlap(flip.to);
      if (k >= 1) { B.endFlip(flip.to); cur = flip.to; buildBar(); popIn(); }
    } else if (flip.phase === "pop") {
      const k = Math.min(1, flip.t / 0.75);
      A().pivot.rotation.x = -1.5 * (1 - backOut(k));
      REVEAL.value = Math.min(1, Math.max(0, (flip.t - 0.2) / 1.0));
      if (flip.t > 0.05 && flip.t - dt <= 0.05) sfx.thud(0.35);
      if (flip.t >= 1.2) { A().pivot.rotation.x = 0; REVEAL.value = 1; flip.phase = null; }
    }
  }

  // ———— 点、拖 ————
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null, dragging = null;
  const aim = (e) => { ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); };
  const pickables = () => [...A().drags.map((d) => d.obj), ...(A().K.clickables ?? []), ...A().widgets.flatMap((w) => [...w.group.children]), B.spreads[cur].flapMesh, B.pageL];
  const hitTest = () => ray.intersectObjects(pickables(), true).find((h) => { let o = h.object; while (o) { if (o.visible === false) return false; o = o.parent; } return true; });
  const toLocal = (p) => B.book.worldToLocal(p.clone());
  const el = renderer.domElement;
  el.addEventListener("pointerdown", (e) => {
    unlock(); down = [e.clientX, e.clientY];
    if (flip.phase) return;
    aim(e); const h = hitTest();
    if (h?.object.userData.drag && !(A().K.busy?.())) {
      const d = h.object.userData.drag;
      const n = d.plane === "xz" ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
      dragging = { d, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, h.point) };
      controls.enabled = false; el.style.cursor = "grabbing"; d.onStart?.(toLocal(h.point)); el.setPointerCapture(e.pointerId);
    }
  });
  el.addEventListener("pointermove", (e) => {
    aim(e);
    if (dragging) { const p = new THREE.Vector3(); if (ray.ray.intersectPlane(dragging.plane, p)) dragging.d.onMove?.(toLocal(p)); return; }
    if (e.buttons || flip.phase) return;
    const h = hitTest(), o = h?.object;
    el.style.cursor = !o ? "" : o.userData.drag ? "grab" : o === B.pageL ? "" : "pointer";
  });
  el.addEventListener("pointerup", (e) => {
    if (dragging) { dragging.d.onEnd?.(); dragging = null; controls.enabled = !CAPTURE; el.style.cursor = "grab"; syncBar(); return; }
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6 || flip.phase) return;
    aim(e); const h = hitTest(); if (!h) return;
    const o = h.object, sp = B.spreads[cur];
    if (o.userData.widget) { o.userData.widget.toggle(); sfx.click(); }
    else if (o === sp.flapMesh) { sp.open = !sp.open; sfx.paper(); }
    else if (o === B.pageL) { if (sp.pickAt(h.uv)) sfx.tick(); }
    else if (o.userData.drag) { A().K.click?.(o); }
    else { A().K.click?.(o); }
    syncBar();
  });

  // ———— 底部工具条：目录、翻页、课名、这一页的按钮、开始、重来、声音 ————
  const bar = document.getElementById("bar");
  function buildBar() {
    const def = A().def, m = def.meta;
    bar.innerHTML = `<button class="ico" title="目录">☰</button><button class="ico" data-nav="-1" title="上一页">‹</button>
      <span class="dots">${S.map((_, i) => `<i class="${i === cur ? "on" : ""}"></i>`).join("")}</span><button class="ico" data-nav="1" title="下一页">›</button>
      <span class="sep"></span><span class="title">${m.barTitle}</span><span class="sep"></span>
      ${(def.controls ?? []).map((c) => `<span class="grp">${c.label}${c.options.map(([t, v]) => `<button data-k="${c.key}" data-v='${JSON.stringify(v)}'>${t}</button>`).join("")}</span>`).join("")}
      ${m.goLabel === null ? "" : `<button class="go" id="go">${m.goLabel ?? "开始 ▶"}</button>`}<button class="ico" id="reset" title="重来">↺</button>
      <button class="ico" id="mute" title="声音">${isMuted() ? "🔇" : "🔊"}</button>`;
    syncBar();
  }
  bar.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    unlock(); sfx.click();
    const K = A().K;
    if (b.dataset.nav) goTo(cur + Number(b.dataset.nav));
    else if (b.dataset.k) K.set(b.dataset.k, JSON.parse(b.dataset.v));
    else if (b.id === "go") K.start();
    else if (b.id === "reset") { K.reset(); sfx.silence(); }
    else if (b.id === "mute") { setMuted(!isMuted()); b.textContent = isMuted() ? "🔇" : "🔊"; }
    syncBar();
  });
  function syncBar() {
    const K = A().K;
    bar.querySelectorAll("[data-k]").forEach((b) => b.classList.toggle("on", JSON.stringify(K.get(b.dataset.k)) === b.dataset.v));
    const go = document.getElementById("go"); if (go) go.disabled = !!K.busy?.() || !!flip.phase;
    bar.querySelectorAll("[data-nav]").forEach((b) => { const j = cur + Number(b.dataset.nav); b.disabled = j < 0 || j >= S.length; });
  }
  buildBar();

  // ———— 每一帧 ————
  let time = 0;
  // 合着的书翻开（开场“一本书翻开才是内容”）：closed 合上并藏起装置；openBook 用 0.9 秒翻开，翻平后装置照常弹起来
  let opening = null;
  function closeBook() { B.setOpen(0); A().pivot.visible = false; flip.phase = null; opening = null; }
  function openBook() { opening = { t: 0 }; sfx.page(); }
  function update(dt) {
    time += dt;
    if (opening) { opening.t += dt; const k = Math.min(1, opening.t / 0.9); B.setOpen(ease(k)); if (k >= 1) { opening = null; popIn(); } }
    if (flip.phase !== "fold" && flip.phase !== "turn") A().K.step(dt);
    for (const w of A().widgets) w.step(dt);
    A().K.energy?.time(time);
    stepFlip(dt);
    const sp = B.spreads[cur], goal = sp.open ? -1.95 : 0;
    sp.a += (goal - sp.a) * Math.min(1, dt * 7); sp.flap.rotation.x = sp.a;
    syncBar();
  }
  function render() {
    for (const b of billboards) b.quaternion.copy(camera.quaternion);
    A().K.energy?.updateSilhouettes(camera);
    A().K.frame?.(camera);
    renderer.render(scene, camera);
  }
  addEventListener("resize", () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); setLineRes(innerWidth, innerHeight); });
  setLineRes(innerWidth, innerHeight);

  if (!CAPTURE) {
    popIn();                                         // 打开时第一页也是“弹起来”的
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => { update(Math.min(clock.getDelta(), 0.05)); controls.update(); render(); });
  }

  // 录屏用的假鼠标：箭头 / 抓手，点击时一圈波纹（tools/rec.mjs 用）
  const fake = document.createElement("div");
  fake.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:50;display:none";
  fake.innerHTML = `<div class="rip" style="position:absolute;left:-22px;top:-22px;width:44px;height:44px;border-radius:50%;border:3px solid rgba(240,122,42,0.9);opacity:0"></div>
    <svg class="arrow" width="34" height="44" viewBox="0 0 17 22" style="position:absolute;left:-3px;top:-2px;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))"><path d="M1 1 L1 17 L5 13 L8 20 L11 19 L8 12 L14 12 Z" fill="#fff" stroke="#222" stroke-width="1.2" stroke-linejoin="round"/></svg>
    <svg class="grab" width="44" height="44" viewBox="0 0 24 24" style="position:absolute;left:-20px;top:-18px;display:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))"><path d="M7 11 V7.5 a1.4 1.4 0 0 1 2.8 0 V10 V6.5 a1.4 1.4 0 0 1 2.8 0 V10 V7 a1.4 1.4 0 0 1 2.8 0 V10.5 V9 a1.4 1.4 0 0 1 2.8 0 V14 c0 4 -2.6 6.5 -6.2 6.5 c-2.6 0 -4.3 -1.3 -5.6 -3.4 L4.6 13.4 a1.4 1.4 0 0 1 2.3 -1.6 Z" fill="#fff" stroke="#222" stroke-width="1.1" stroke-linejoin="round"/></svg>`;
  document.body.appendChild(fake);
  const dragOf = (n) => (typeof n === "string" ? A().drags.find((x) => x.name === n) : A().drags[n ?? 0]);
  function show(i) {                                   // 不翻页动画，直接切到第 i 个跨页
    if (i === cur) return;
    S[cur].pivot.visible = false; B.beginFlip(i); B.endFlip(i); cur = i;
    A().pivot.visible = true; A().pivot.rotation.x = 0; REVEAL.value = 1; flip.phase = null; buildBar();
  }

  // 截图 / 录屏接口（tools/shot.mjs、tools/clip.mjs、tools/rec.mjs 用）
  window.APP = {
    // 书上一点（书的本地坐标）→ 屏幕像素
    project(p) { const v = new THREE.Vector3(...p); B.book.localToWorld(v); v.project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; },
    // 假鼠标：{ x, y, mode: "arrow" | "grab" | "hide", click: 0–1（波纹进度） }
    cursor(o) {
      fake.style.display = o.mode === "hide" ? "none" : "block"; fake.style.transform = `translate(${o.x}px, ${o.y}px)`;
      fake.querySelector(".arrow").style.display = o.mode === "grab" ? "none" : "block"; fake.querySelector(".grab").style.display = o.mode === "grab" ? "block" : "none";
      const r = fake.querySelector(".rip"), k = o.click ?? 0; r.style.opacity = k > 0 && k < 1 ? String(1 - k) : "0"; r.style.transform = `scale(${0.4 + k * 1.4})`;
    },
    flapPoint() { const v = new THREE.Vector3(); B.spreads[cur].flapMesh.getWorldPosition(v); B.book.worldToLocal(v); return v.toArray(); },
    rect(sel) { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
    cams() { return { ...CAMS, ...(A().def.cams ?? {}) }; },
    ready: true, render, lesson: NAME, clip: L.clip ?? SP[0].clip ?? null, spreads: S.length,
    act(k, ...a) {
      const K = A().K;
      if (k === "cam") setCam(a[0]);
      else if (k === "camMix") { const P = camOf(a[0]), C = camOf(a[1]), t = ease(a[2]); const mix = (p, q) => p.map((v, i) => v + (q[i] - v) * t); setCam({ pos: mix(P.pos, C.pos), tgt: mix(P.tgt, C.tgt) }); }
      else if (k === "set") K.set(a[0], a[1]);
      else if (k === "start") K.start();
      else if (k === "reset") K.reset();
      else if (k === "pick") B.spreads[cur].setPick(a[0]);
      else if (k === "flap") B.spreads[cur].open = !!a[0];
      else if (k === "toggle") A().widgets[a[0] ?? 0]?.toggle();
      else if (k === "goto") { if (goTo(a[0])) for (let i = 0; i < 60 * 3 && flip.phase; i++) update(1 / 60); }
      else if (k === "flipTo") goTo(a[0]);                 // 只开始翻，配合 advance 截翻页中间的画面
      else if (k === "intro") popIn();
      else if (k === "closed") closeBook();
      else if (k === "openBook") openBook();
      else if (k === "show") show(a[0]);
      else if (k === "dragStart") dragOf(a[0])?.onStart?.(new THREE.Vector3(...a[1]));
      else if (k === "dragMove") dragOf(a[0])?.onMove?.(new THREE.Vector3(...a[1]));
      else if (k === "dragEnd") { dragOf(a[0])?.onEnd?.(); }
      else if (k === "drag") {                            // ["drag", 名字或序号, [[x,y,z], ...]]：模拟拖动
        const d = typeof a[0] === "string" ? A().drags.find((x) => x.name === a[0]) : A().drags[a[0] ?? 0];
        const pts = a[1].map((p) => new THREE.Vector3(...p));
        d?.onStart?.(pts[0]); for (const p of pts) d?.onMove?.(p); d?.onEnd?.();
      }
      else if (k === "advance") { const n = Math.round(a[0] * 60); for (let i = 0; i < n; i++) update(1 / 60); }
      else if (k === "run") { K.start(); for (let i = 0; i < 60 * (a[0] ?? 20) && !K.done(); i++) update(1 / 60); update(0.5); }
      syncBar();
      return { spread: cur, busy: !!K.busy?.(), done: !!K.done?.() };
    },
  };
}
