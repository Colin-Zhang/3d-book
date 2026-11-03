# 引擎接口

## 文件

```
template/
  index.html            页面（?lesson=<名字> 打开哪一课，默认 kinetic）
  src/boot.js           开发时的入口
  src/main.js           引擎：桌子、书、灯、窗光、镜头、翻页、弹起、拖拽、点选、底部工具条、截图接口（不改）
  src/book.js           书、书页排版（默认 / 课本样式）、翻页的纸（不改）
  src/widgets.js        书页上的拨动开关（不改）
  src/sfx.js            音效（Web Audio 现场合成，不改）
  src/energy.js         能量量筒（不改）
  src/hatch.js          排线材质、描边、画布贴图、标签（不改）
  src/lessons/*.js      每一课一个文件 ← 只写这里
  tools/shot.mjs        截图
  tools/clip.mjs        录视频（自检用）
  tools/build.mjs       打包成一个 HTML → dist/<名字>.html
  fonts/                霞鹜文楷（手写字，OFL 授权）
```

## 坐标

- 单位：米。书的本地坐标：右页 x 0–1、左页 x -1–0；z 朝镜头为正，页高 z -0.69–0.69。
- 书页表面高度：`FLAT`（从 `../book.js` 导入），装置放在 `y = FLAT` 上。靠近书脊（|x| < 0.1）书页往下弯，别放东西。
- `build()` 里所有东西加到传进来的 `book`（或你自己建的 group）上。

## 一课的文件长什么样

```js
import * as THREE from "three";
import { INK, HAND, hatchMat, edges, hull, polyline, lineMat, canvasTex, tagCard, label } from "../hatch.js";
import { FLAT } from "../book.js";
import { makeEnergy } from "../energy.js";

export const meta = { barTitle: "第 4 课 · ……", goLabel: "松手 ▶", pages: { /* 见 lesson-design.md §2 */ } };
export const controls = [{ key: "h", label: "高度", options: [["低", 0], ["高", 1]] }];
export const cams = { rig: { pos: [x, y, z], tgt: [x, y, z] }, rigWide: { ... }, energy: { ... } };
export const clip = { set: { h: 1 }, pick: 0, from: "rigWide", to: "rig", push: 1.6, startAt: 1.2, dur: 6 };

export function build(book, { billboard, camera, draggable, pageSwitch, sfx }) {
  // 1. 装置（hatchMat + edges / hull，castShadow）
  // 2. 能量量筒 const energy = makeEnergy(book, { kinds, pipes, max })
  // 3. 状态 st、物理 step(dt)、reset()
  return {
    st,                         // 状态
    step(dt) {},                // 每帧调用，dt 秒（演示时间，慢放自己乘）
    reset() {},                 // 回到 ready
    start() {},                 // “开始”按钮 / 点装置
    busy: () => false,          // 动作中返回 true（按钮变灰）
    done: () => false,          // 结束返回 true（截图的 run 跑到这里停）
    get: (key) => st[key],      // 底部按钮高亮用
    set(key, value) {},         // 底部按钮改参数（busy 时忽略，改完 reset）
    clickables: [],             // 能直接点的网格
    click(obj) {},              // 点到了哪个
    energy,                     // 有量筒就返回它（引擎每帧更新管子动画、轮廓）
    frame(camera) {},           // 可选：每次渲染前调用
  };
}
```

## 多个跨页

```js
const spreadA = { meta, controls, cams, build(book, ctx) { ... } };   // 和单跨页一样的几样
const spreadB = { ... };
export const title = "机械能及其转化";
export const spreads = [spreadA, spreadB];
export const clip = { ... };                                         // 录屏用第一个跨页
```

翻页时引擎会把这一页的装置折下去、翻纸、再把下一页的装置弹起来，装置先以线稿出现再上色——不用自己写。

## `build()` 拿到的 ctx

| 名字 | 用法 |
| --- | --- |
| `billboard(网格, 尺寸)` | 让手写字一直面向镜头 |
| `draggable(物体, { name, plane, onStart(点), onMove(点), onEnd() })` | 物体（可以是 Group）能用鼠标拖。点是书的本地坐标；`plane: "xy"`（默认，竖直面，适合摆、斜面、上下拖）或 `"xz"`（桌面）。小东西加一个看不见的大球当把手：`new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ visible: false }))` |
| `pageSwitch({ label, on, onChange(v) })` | 书页上的拨动开关，返回 `{ group, get, set, toggle }`；`group.position.set(x, FLAT, z)` 放好就行，点击、动画、声音引擎都管 |
| `sfx` | 一次性：`click / page / paper / knock(力度) / thud(力度) / tick / beep / ding / pop / creak`；持续：`sfx.loop("roll" / "whoosh" / "fizz" / "pour" / "sizzle").set(0–1)` |
| `camera` | 当前镜头（一般用不到） |

## 书页字段（`meta.pages`）

`style: "textbook"` 时用 `section: { no, title }`（左页蓝色节号标签）、`subtitle`、`predict`（“问题”框）、`body`、`try`（“想想做做”框）、`answer`、`chapter`、`lessonNo`、`pageNo`、`right: { header, caption, hint, figure }`、可选 `accent`（主色）。字数上限见 `lesson-design.md` §3。

## 按块排版（照原书）

```js
pages: {
  style: "textbook", section: { no: "第4节", title: "机械能及其转化" },
  chapter: "96　物理　八年级下册", lessonNo: "第十一章　功和机械能", pageNo: [96, ""],
  blocks: [
    { q: "原书的问题……", options: ["会", "不会", "说不准"] },   // “问题”框；options 可选（预测勾选）
    { p: "原书的一段正文……" },                                  // 正文段，首行缩进两字；{ p, w: 900 } 限定宽度
    { h: "机械能及其转化" },                                    // 蓝色小标题
    { act: ["1. ……", "2. ……"] },                              // “想想做做”框
    { note: "原书的结论……" },                                   // 结论框
    { cap: "图11.4-3　动能和势能的转化" },                       // 单独一行图注
    { fig(ctx, o) { ... }, h: 260, caption: "图……" },           // 印在书页上的小线描
    { flap: "铁锁为什么碰不到鼻子？" },                         // 答案贴纸，答案写在 pages.answer.text
  ],
  answer: { text: "……" },
  right: { header: ["……", "……"], top: 1450, blocks: [{ p: "接着排的原文……" }], figure(ctx, o) {}, hint: "……" },
}
```

左页或右页排不下时，截图会报“左页字太多 / 右页字太多”：把一部分挪到另一页，或者把这一页拆成两个跨页。

## 工具函数（`hatch.js`）

| 函数 | 用途 |
| --- | --- |
| `hatchMat({ color, mode, freq, amt, angle, uvScale, metal, rough })` | 排线材质。`mode: "uv"` 给球、圆柱；`freq` 线密度（默认 230）；`amt` 线的浓淡 |
| `edges(mesh, { width })` | 棱角描边 |
| `hull(mesh, { scale })` | 圆东西的外轮廓 |
| `polyline(points, { color, width, opacity })` | 一条折线（刻度、虚线、绳子） |
| `lineMat(color, width)` | 线材质，配 `LineSegments2` 做会变的线（比如绳子跟着摆动：每帧 `geometry.setPositions`） |
| `canvasTex(w, h, draw)` | 画布贴图；`tex.userData.redraw(fn)` 重画 |
| `tagCard({ lines, w, h, sizes, bg })` | 立在桌上的手写卡片；`card.userData.set(lines)` 改字 |
| `label(text, { color })` | 透明底手写字；配 `billboard(mesh, 尺寸)` 面向镜头；`m.userData.set(text)` 改字 |

## 能量量筒（`energy.js`）

```js
const energy = makeEnergy(parent, {
  kinds: [{ key: "pe", name: "重力势能" }, { key: "ke", name: "动能" }, { key: "q", name: "内能" }],
  pipes: [[0, 1], [1, 2]],   // 管子：第 0 只 → 第 1 只……
  max: 0.6,                  // 装满是多少焦
  x0: 0.52, dx: 0.18, z: -0.2,
});
energy.set({ pe: 0.3, ke: 0.1, q: 0 });   // 每帧
energy.flow(0, 0.8);                      // 第 0 根管子的流量（0–1），倒着流：flow(0, 0.8, -1)
```

## 截图和录屏

```bash
node tools/shot.mjs --lesson <名字> --out shots/1-overview.png
node tools/shot.mjs --lesson <名字> --out shots/2-moving.png --steps '[["cam","rig"],["set","h",1],["start"],["advance",0.8]]'
node tools/shot.mjs --lesson <名字> --out shots/3-done.png   --steps '[["cam","rig"],["pick",0],["run"]]'
node tools/clip.mjs --lesson <名字> --out shots/<名字>.mp4
node tools/rec.mjs shots/<镜头表>.json   # 做讲解视频：按镜头表逐帧录一段，带假鼠标（拖铁锁、点按钮、掀答案）；镜头表格式见 rec.mjs 开头
```

`--steps` 里能用：`["cam", 镜头名]`、`["set", 参数, 值]`、`["start"]`、`["advance", 秒]`、`["run"]`（跑到 `done()`）、`["pick", 预测选项序号]`、`["flap", true]`（掀开答案）、`["reset"]`、`["goto", 跨页序号]`（翻到第几个跨页，动画跑完）、`["flipTo", 序号]` + `["advance", 0.7]`（截翻页的中间）、`["drag", 名字, [[x,y,z], ...]]`（模拟拖动，最后一个点松手）、`["toggle", 第几个开关]`。

打包：`node tools/build.mjs --lesson <名字>` → `dist/<名字>.html`，双击就能打开（three.js、代码、字体都在里面）。
开发时预览：`npm run preview`，浏览器打开 `http://localhost:5174/index.html?lesson=<名字>`。
