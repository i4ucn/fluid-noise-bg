# 流体噪声背景 / Fluid Noise Background

一个零依赖、可参数化的 **WebGL 流体噪声背景**，灵感来自 [federicopian.com](https://www.federicopian.com/)。
A dependency-free, parameterized **WebGL fluid-noise background**, inspired by [federicopian.com](https://www.federicopian.com/).

配色模型为「**浅色底 + 柔和饱和色块 + 轻微高光**」（非黑底）：用 3D Simplex 噪声生成大而圆润、彼此分离的色块，并让它们缓慢漂移、各自淡入淡出（呼吸感）；并提供一个实时参数面板（色板 / 运动 / 质感 / 导出）。
The palette model is "**light base + soft saturated blobs + subtle highlights**" (not black-based): 3D Simplex noise forms large, round, separated blobs that slowly drift and independently fade in/out (breathing), with a live control panel (palette / motion / surface / export).

展示页面：https://i4ucn.github.io/fluid-noise-bg/ 

## ✨ 功能 / Features

- 🎨 **实时调色** — 底色 / 流色 / 高光三色 + 6 套预设 / 3 colors + 6 presets 
- 🫧 **圆润色块** — `density` 控制覆盖率，低覆盖 → 孤立圆斑而非杂乱条带 / `density` controls coverage: low → isolated round blobs, not tangled bands
- 🌬️ **呼吸感** — `breath` 让每个色块按各自节奏淡入淡出 / `breath` fades each blob in and out on its own rhythm
- 🌊 **运动参数** — 速度、尺度、漂移、扰动、对比，动画可开关 / speed, scale, flow, distort, contrast, animate toggle
- 🎞️ **质感** — 暗化层 + 胶片颗粒强度可调 / adjustable dim overlay and film grain
- 📤 **导出** — 一键复制 / 下载当前配置 JSON / copy or download the config as JSON
- ♿ **可访问性** — 尊重 `prefers-reduced-motion` / respects reduced-motion
- 📦 **零依赖** — 纯原生 WebGL，单文件引擎 / no dependencies, single-file engine

## 🚀 快速开始 / Quick start

直接用浏览器打开 `index.html`（带参数面板）或 `demo.html`（极简、纯背景）即可，无需构建或服务器。
Open `index.html` (with control panel) or `demo.html` (minimal, background-only) in a browser — no build step or server required.

## 🔌 在你的项目中嵌入 / Embed in your project

```html
<canvas id="bg" style="position:fixed;inset:0;width:100%;height:100%;z-index:-1"></canvas>
<script src="src/createFluidNoise.js"></script>
<script>
  const fx = createFluidNoise(document.getElementById("bg"), {
    colorBase:   "#f5ece7",
    colorMid:    "#d9b6a0",
    colorBright: "#f9f2ec",
    speed: 0.16,
    scale: 1.4,
    flow: 0.4,
    distort: 0.35,
    density: 0.25,
    breath: 0.7,
    contrast: 0.6,
    animate: true,
  });

  // 运行时更新任意参数 / update any param at runtime
  fx.update({ speed: 0.4, colorMid: "#8c8db8" });

  // 读取 / 销毁 / read or destroy
  fx.getConfig();
  // fx.destroy();
</script>
```

> 颗粒（`grain`）与暗化（`overlay`）是页面侧的 CSS 叠加层（见 `styles.css` 的 `.glass-overlay`），
> 通过 CSS 变量 `--grain-opacity` / `--overlay-alpha` 控制，不属于引擎参数。
> `grain` and `overlay` are page-side CSS layers (`.glass-overlay` in `styles.css`),
> driven by the CSS variables `--grain-opacity` / `--overlay-alpha`.

## 🧪 应用导出的 JSON / Apply an exported config

在参数面板调好效果后，用「导出 / Export」复制 JSON，直接喂给引擎即可。
`demo.html` 就是这样一个极简示例：整页只有一个流动背景，配置全部来自一段导出的 JSON。
Tune it in the panel, copy the JSON via **Export**, and hand it straight to the engine.
`demo.html` is exactly this — a minimal, background-only page driven entirely by an exported config.

```js
const CONFIG = /* 粘贴导出的 JSON / paste exported JSON */;
createFluidNoise(document.getElementById("bg"), CONFIG); // 引擎参数 / engine params
// overlay / grain 为页面侧叠加层 / page-side layers:
document.documentElement.style.setProperty("--grain-opacity", CONFIG.grain);
document.documentElement.style.setProperty("--overlay-alpha", CONFIG.overlay);
```

## ⚙️ 引擎参数 / Engine parameters

| 参数 / Param | 类型 | 默认 | 说明 / Description |
| --- | --- | --- | --- |
| `colorBase` | hex | `#f5ece7` | 占主导的浅色底（不是黑）/ dominant light background |
| `colorMid` | hex | `#d9b6a0` | 更饱和的同系流色色块 / saturated soft blobs |
| `colorBright` | hex | `#f9f2ec` | 略亮于底色的近白高光 / soft light highlights |
| `speed` | 0–1.2 | `0.16` | 动画速度 / animation speed |
| `scale` | 0.8–6 | `1.4` | 空间频率（越小色块越大）/ spatial frequency |
| `flow` | 0–2 | `0.4` | 域漂移强度（平移感）/ domain drift (translation) |
| `distort` | 0–1.4 | `0.35` | 域扭曲·边缘起伏（过大→条形）/ domain-warp edge wobble |
| `density` | 0–1 | `0.25` | 色块覆盖率（小=孤立圆斑，大=连成片）/ blob coverage |
| `breath` | 0–1 | `0.7` | 呼吸·淡入淡出强度 / breathing fade in-out |
| `contrast` | 0.15–1 | `0.6` | 色块饱满度（越小越柔）/ blob fullness |
| `animate` | bool | `true` | 是否播放动画 / play animation |

## 📁 结构 / Structure

```
index.html              演示页 + 参数面板 / demo page + control panel
demo.html               极简示例：纯背景，由导出的 JSON 驱动 / minimal background-only demo
styles.css              页面与面板样式 / page & panel styles
app.js                  面板逻辑、预设、导出 / panel logic, presets, export
src/createFluidNoise.js 可复用的噪声引擎 / reusable noise engine
assets/background-noise.png  胶片颗粒贴图 / film-grain texture
```

## 🧠 技术 / How it works

- **3D Simplex noise**（Ashima Arts / Stefan Gustavson 的经典 GLSL 实现）替代 Perlin，梯度更自然。
- 时间项驱动噪声的第三维（z）形成形态翻涌，外加 `flow` 的 XY 域漂移形成流动感；轻微、各向同性的域扭曲（`distort`）只让色块边缘有机起伏，过大才会拉成条形。
- 配色为「浅色底 + 柔和饱和色块（流色）+ 轻微高光」：底色占主导，流色用很宽的 `smoothstep` 羽化晕开融入底色，高光由另一组解耦噪声场克制地点缀。所有混色在线性光空间完成，过渡更干净。
- 色块形状由 `density`（覆盖率）决定：覆盖率低时只有噪声「峰值」露出，是孤立的圆斑；覆盖率接近 50% 时等值线会连成迷宫状条带（不再圆）。这就是 `density` 越小越圆、越大越连片的原因。
- 呼吸感（`breath`）由一组「很慢、很大尺度」的独立噪声做不透明度包络：每个色块按各自节奏淡入淡出，且因包络随位置变化，不同色块不会同步呼吸 —— 对应原站气泡的 fade in/out。
- 引擎实例挂在 `window.fluidNoise` 上，可在控制台用 `fluidNoise.update({ density: 0.15 })` 实时调参。

## 📄 许可 / License

[MIT](./LICENSE)
