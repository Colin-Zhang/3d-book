# 3D 课本（skill）

把一节课本的照片或截图发给 agent，它会做出一课能在浏览器里玩的 3D 立体书：书桌上摊开一本书，实验装置从书页里立起来，能量画成彩色液体在量筒之间流动；每课都是“先猜一猜 → 动手试 → 掀开看答案”，最后自动录一段演示视频。

## 安装

1. 把整个 `3d-textbook` 文件夹放进 agent 的 skills 目录（Claude Code 是 `~/.claude/skills/`）。
2. 电脑上要有：Node 18 以上、Chrome 或 Edge、ffmpeg（录视频用）。

## 科目

- 自带**物理**（`subjects/physics/`）和**化学**（`subjects/chemistry/`：玻璃器皿、电子天平、酒精灯等器材，加一课范例《质量守恒》）。
- 历史等别的科目：照 `subjects/` 里的结构加一个文件夹就能用。

## 用法

对 agent 说：“用 3d-textbook，把这两页课本做成一课 3D”，附上课本照片。它会：读页 → 写出三句话（问题、实验、结论）→ 写这一课 → 截三张图自检 → 录视频。

自带一课范例（人教版八年级下册《动能和势能》：钢球撞木块）。自己打开看：

```bash
cp -r 3d-textbook/template my-book && cd my-book && npm install
npm run preview      # 浏览器打开 http://localhost:5174/index.html?lesson=kinetic
```

## 说明

- 课本的版权归出版社。原件只给 agent 读知识点；做出来的课文是 agent 自己写的，不照搬课本原文和插图。
- 本 skill 用 MIT 许可证（见 `LICENSE`），可以随便用、随便商用，保留版权声明就行。
- 第三方：three.js（MIT）、puppeteer-core（Apache-2.0）、霞鹜文楷（SIL Open Font License 1.1，见 `template/fonts/OFL-LXGWWenKai.txt`；这里是网页用的常用字子集）。
