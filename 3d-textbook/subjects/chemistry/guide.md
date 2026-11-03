# 化学科目包

适用：初中、高中化学里能在桌上演的实验——溶液变色、产生气体、生成沉淀、加热、称量、酸碱指示剂。范例课：`src/lessons/mass.js`（质量守恒：锥形瓶放在电子天平上，铁钉 + 硫酸铜 / 碳酸钠 + 稀盐酸，敞口 / 塞紧）。

器材都在 `src/parts/chemistry.js`，课文件里这样引入：

```js
import { CHEM, beaker, flask, testTube, stopper, electronicBalance, alcoholLamp, ironStand, bubbles, gasPuffs, powder, nail, wire } from "../parts/chemistry.js";
```

## 1. 器材

| 器材 | 函数 | 常用的 |
| --- | --- | --- |
| 烧杯 / 锥形瓶 / 试管 | `beaker()`、`flask()`、`testTube()`；自定义形状用 `glassVessel(外壁轮廓)` | `v.userData.setLiquid(液面高度, 颜色)`、`mixColor(颜色1, 颜色2, 0–1)`、`top`（瓶口高度）、`rAt(y)`（这个高度的内径） |
| 橡胶塞 | `stopper()` | 放在 `top - 0.014` |
| 电子天平 | `electronicBalance()` | `userData.setReading(克)`、`plateY`、`plateZ`（秤盘位置） |
| 酒精灯 | `alcoholLamp()` | `lit(true)`、每帧 `step(dt)` |
| 铁架台 | `ironStand({ ringY })` | `ringTop`（铁圈上沿，放石棉网、烧杯） |
| 气泡 | `bubbles(容器)` | 每帧 `emit(个数, 出生点函数)`、`step(dt, 液面高度)` |
| 冒出来的气体 | `gasPuffs(组)` | `emit(个数, 瓶口位置)`、`step(dt)`；旁边配 `label("CO₂")` |
| 粉末 | `powder({ color })` | `setAmount(0–1)` 反应时变少 |
| 铁钉 | `nail()` | `setCopper(0–1)` 表面变红 |
| 吊绳 / 导管 | `wire(组)` | 每帧 `set([点, 点, ...])` |

- 器材比书页小，整体放进一个 group 再 `scale.setScalar(1.4–1.6)`（范例 1.5），装置才够大。
- 玻璃是透明的，**每帧要调用 `frame(camera)` 更新两侧轮廓线**：课的 `build()` 返回 `frame(camera) { 瓶.userData.frame(camera); ... }`。

## 2. 颜色（`CHEM`）

| 物质 | 颜色 |
| --- | --- |
| 水、稀盐酸、无色溶液 | `water` / `hcl`（很淡的蓝，看得出液面） |
| 硫酸铜溶液 | `cuso4` 蓝 |
| 硫酸亚铁溶液 | `feso4` 浅绿 |
| 氯化铁溶液 | `fecl3` 黄褐 |
| 高锰酸钾溶液 | `kmno4` 紫 |
| 酚酞遇碱 | `phenolBase` 粉红 |
| 石蕊遇酸 / 遇碱 | `litmusAcid` 红 / `litmusBase` 蓝 |
| 石灰水变浑浊 | `limewater` → `milky` |
| 铜、铁 | `copper` 红、`iron` 灰 |

颜色变化用 `mixColor(起, 止, 进度)`，进度按反应快慢来（先快后慢：`1 - exp(-k·t)`）。

## 3. 数据要对

- 用真实的化学方程式和相对分子质量算质量、体积（例：2.12 g 碳酸钠和足量稀盐酸反应，放出 0.88 g 二氧化碳）。数字写在课文件的常量里，旁边注释怎么算的。
- 现象要和真实一致：没有气体的反应不冒泡；生成气体的反应，敞口时质量会减少、塞紧时不变。
- 读数保留两位小数（电子天平），温度保留一位。
- **安全**：危险的实验（浓酸、可燃气体、加热高锰酸钾）照样可以演，但书页上的字不写“在家里试试”，提示写“实验要在老师指导下做”。

## 4. 能演出来的现象

| 现象 | 怎么演 |
| --- | --- |
| 溶液变色 | `mixColor` |
| 产生气体 | 液体里 `bubbles` + 瓶口 `gasPuffs` + `label("H₂")` 之类 |
| 生成沉淀 | 再放一个 `powder` 在瓶底，`setAmount` 从 0 长到 1，液体颜色变浑（`mixColor` 到 `milky`） |
| 固体溶解、反应掉 | `powder.setAmount` 变小 |
| 金属表面析出 | `nail.setCopper`，或者给别的金属件换颜色 |
| 加热 | `alcoholLamp` + 温度计读数卡 |
| 质量变化 | `electronicBalance.setReading` |
| 放热 / 吸热 | 可以借用引擎的能量量筒：化学能 `ch` → 内能 `q` |

## 5. 范例对照（`src/lessons/mass.js`）

| 课本 | 3D 里 |
| --- | --- |
| 质量守恒定律的验证实验 | 锥形瓶放在电子天平上，液晶屏显示读数 |
| 两个反应对比 | 底部“反应：铁钉+硫酸铜 / 碳酸钠+盐酸” |
| 敞口和密闭的区别 | 底部“容器：敞口 / 塞紧”，塞紧时瓶口有橡胶塞 |
| 结论 | 记录卡：铁钉·敞口 不变 / 碳酸钠·敞口 −0.88 g / 碳酸钠·塞紧 不变 |
