# 3D 课本 · 化学科目包

3d-textbook skill 的化学部分：玻璃器皿、电子天平、酒精灯、铁架台、气泡、冒气、沉淀、变色，加一课范例（质量守恒）。

## 位置

已经放在 skill 的 `subjects/` 里：

```
3d-textbook/
  subjects/
    physics/
    chemistry/    ← 这里
```

之后对 agent 说“用 3d-textbook 把这两页化学课本做成一课 3D”就行。agent 会按 `subjects/chemistry/guide.md` 做，并把 `subjects/chemistry/src/` 拷进工作目录。

## 许可

和整个 skill 一样用 MIT 许可证（见 `3d-textbook/LICENSE`）。
