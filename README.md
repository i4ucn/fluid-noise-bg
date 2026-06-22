# 流体噪声背景 / Fluid Noise Background

一个零依赖、可参数化的 **WebGL 流体噪声背景**，灵感来自 [federicopian.com](https://www.federicopian.com/)。
A dependency-free, parameterized **WebGL fluid-noise background**, inspired by [federicopian.com](https://www.federicopian.com/).

通过 3D Simplex 噪声 + 三点平均 + 缓慢域漂移，生成自然流动的暖色渐变；并提供一个实时参数面板（色板 / 运动 / 质感 / 导出）。
It uses 3D Simplex noise with multi-sample averaging and slow domain drift to produce a naturally flowing gradient, plus a live control panel (palette / motion / surface / export).

## ✨ 功能 / Features

- 🎨 **实时调色** — 高光 / 中间 / 阴影三色 + 6 套预设 / live palette with 3 colors and 6 presets
- 🌊 **运动参数** — 速度、尺度、漂移、对比，动画可开关 / speed, scale, flow, contrast, animate toggle
- 🎞️ **质感** — 暗化层 + 胶片颗粒强度可调 / adjustable dark overlay and film grain
- 📤 **导出** — 一键复制 / 下载当前配置 JSON / copy or download the config as JSON
- ♿ **可访问性** — 尊重 `prefers-reduced-motion`（减速而非冻结）/ respects reduced-motion (slows, not freezes)
- 📦 **零依赖** — 纯原生 WebGL，单文件引擎 / no dependencies, single-file engine

## 🚀 快速开始 / Quick start

直接用浏览器打开 `index.html` 即可（无需构建或服务器）。
Just open `index.html` in a browser — no build step or server required.

## 🔌 在你的项目中嵌入 / Embed in your project

```html
<canvas id="bg" style="position:fixed;inset:0;width:100%;height:100%;z-index:-1"></canvas>
<script src="src/createFluidNoise.js"></script>
<script>
  const fx = createFluidNoise(document.getElementById("bg"), {
    colorBright: "#ff9655",
    colorMid:    "#b93c64",
    colorShadow: "#160a10",
    speed: 0.2,
    scale: 2.1,
    flow: 0.6,
    contrast: 0.6,
    animate: true,
  });

  // 运行时更新任意参数 / update any param at runtime
  fx.update({ speed: 0.4, colorBright: "#41b9f5" });

  // 读取 / 销毁 / read or destroy
  fx.getConfig();
  // fx.destroy();
</script>
```

> 颗粒（`grain`）与暗化（`overlay`）是页面侧的 CSS 叠加层（见 `styles.css` 的 `.glass-overlay`），
> 通过 CSS 变量 `--grain-opacity` / `--overlay-alpha` 控制，不属于引擎参数。
> `grain` and `overlay` are page-side CSS layers (`.glass-overlay` in `styles.css`),
> driven by the CSS variables `--grain-opacity` / `--overlay-alpha`.

## ⚙️ 引擎参数 / Engine parameters

| 参数 / Param | 类型 | 默认 | 说明 / Description |
| --- | --- | --- | --- |
| `colorBright` | hex | `#ff9655` | 噪声峰值的高光色 / highlight color at noise peaks |
| `colorMid` | hex | `#b93c64` | 中间过渡色 / midtone |
| `colorShadow` | hex | `#160a10` | 噪声谷底的阴影色 / shadow at noise valleys |
| `speed` | 0–1.2 | `0.2` | 动画速度 / animation speed |
| `scale` | 0.8–6 | `2.1` | 空间频率（越大越细碎）/ spatial frequency |
| `flow` | 0–2 | `0.6` | 域漂移强度（平移感）/ domain drift (translation) |
| `contrast` | 0.15–1 | `0.6` | 色彩过渡范围（越小越硬）/ transition range |
| `animate` | bool | `true` | 是否播放动画 / play animation |

## 📁 结构 / Structure

```
index.html              演示页 + 参数面板 / demo page + control panel
styles.css              页面与面板样式 / page & panel styles
app.js                  面板逻辑、预设、导出 / panel logic, presets, export
src/createFluidNoise.js 可复用的噪声引擎 / reusable noise engine
assets/background-noise.png  胶片颗粒贴图 / film-grain texture
```

## 🧠 技术 / How it works

- **3D Simplex noise**（Ashima Arts / Stefan Gustavson 的经典 GLSL 实现）替代 Perlin，梯度更自然。
- 在 3 个微偏移点采样后取平均，得到更柔和的噪声场。
- 时间项驱动噪声的第三维（z）形成形态翻涌，外加 `flow` 的 XY 域漂移形成流动感。
- 噪声值经 `smoothstep` 映射为「阴影 → 中间 → 高光」的不透明三段渐变。

## 📄 许可 / License

[MIT](./LICENSE)
