/* =============================================================================
 * app.js — 参数面板与引擎的连接 / wires the control panel to createFluidNoise
 * ========================================================================== */
(function () {
  "use strict";

  /* ---- 预设色板 / Preset palettes -----------------------------------
   * 规律（举一反三）：每个预设都是「浅底色 base + 更饱和的同系流色 mid
   * + 略亮于底色的近白高光 bright」。前三个忠实还原参考截图的背景色，
   * 后三个按同一规律外推到薄荷 / 紫霭 / 暖沙。 */
  const PRESETS = {
    cream:  { label: "奶杏 / Cream",  colorBase: "#f5ece7", colorMid: "#d9b6a0", colorBright: "#f9f2ec" }, // 参考图 2
    azure:  { label: "天青 / Azure",  colorBase: "#c3e7fb", colorMid: "#8c8db8", colorBright: "#e3f3fe" }, // 参考图 1
    blush:  { label: "胭粉 / Blush",  colorBase: "#f0cad7", colorMid: "#d67e90", colorBright: "#f8e8ee" }, // 参考图 3
    mint:   { label: "薄荷 / Mint",   colorBase: "#d8ece1", colorMid: "#84b39e", colorBright: "#eef7f1" },
    lilac:  { label: "紫霭 / Lilac",  colorBase: "#ddd7ef", colorMid: "#9182bf", colorBright: "#efeaf9" },
    sand:   { label: "暖沙 / Sand",   colorBase: "#f0e6d4", colorMid: "#c9a079", colorBright: "#f9f2e6" },
  };

  /* 仅由引擎使用的参数（其余 grain/overlay 走 CSS） */
  const ENGINE_KEYS = ["colorBright", "colorMid", "colorBase", "speed", "scale", "flow", "distort", "density", "breath", "contrast", "animate"];

  const canvas = document.getElementById("bg");
  const fx = createFluidNoise(canvas, {});
  window.fluidNoise = fx; // 暴露引擎实例，便于控制台调参 / expose for console tinkering

  /* 页面侧状态（CSS 叠加层）/ page-side state */
  const surface = { overlay: 0, grain: 0.22 };

  /* ---- 工具 / helpers ------------------------------------------------ */
  function setSurfaceVars() {
    document.documentElement.style.setProperty("--overlay-alpha", surface.overlay);
    document.documentElement.style.setProperty("--grain-opacity", surface.grain);
  }

  function currentConfig() {
    return Object.assign({}, fx.getConfig(), { overlay: surface.overlay, grain: surface.grain });
  }

  function renderConfigOut() {
    const c = currentConfig();
    const ordered = {
      colorBase: c.colorBase,
      colorMid: c.colorMid,
      colorBright: c.colorBright,
      speed: round(c.speed),
      scale: round(c.scale),
      flow: round(c.flow),
      distort: round(c.distort),
      density: round(c.density),
      breath: round(c.breath),
      contrast: round(c.contrast),
      animate: c.animate,
      overlay: round(c.overlay),
      grain: round(c.grain),
    };
    document.getElementById("configOut").textContent = JSON.stringify(ordered, null, 2);
  }
  function round(n) {
    return typeof n === "number" ? Math.round(n * 1000) / 1000 : n;
  }

  /* ---- 预设下拉 / preset select ------------------------------------- */
  const presetSelect = document.getElementById("presetSelect");
  Object.keys(PRESETS).forEach(function (key) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = PRESETS[key].label;
    presetSelect.appendChild(opt);
  });
  presetSelect.value = "cream";

  presetSelect.addEventListener("change", function () {
    const p = PRESETS[presetSelect.value];
    if (!p) return;
    fx.update({ colorBright: p.colorBright, colorMid: p.colorMid, colorBase: p.colorBase });
    ["colorBright", "colorMid", "colorBase"].forEach(function (k) {
      const input = document.querySelector('input[data-color="' + k + '"]');
      const code = document.querySelector('code[data-code="' + k + '"]');
      input.value = p[k];
      code.textContent = p[k];
    });
    renderConfigOut();
  });

  /* ---- 取色器 / color inputs ---------------------------------------- */
  document.querySelectorAll("input[data-color]").forEach(function (input) {
    input.addEventListener("input", function () {
      const key = input.getAttribute("data-color");
      const code = document.querySelector('code[data-code="' + key + '"]');
      if (code) code.textContent = input.value;
      const patch = {};
      patch[key] = input.value;
      fx.update(patch);
      renderConfigOut();
    });
  });

  /* ---- 滑块 / range inputs ------------------------------------------ */
  document.querySelectorAll("input[type=range][data-param]").forEach(function (input) {
    input.addEventListener("input", function () {
      const key = input.getAttribute("data-param");
      const val = parseFloat(input.value);
      const out = document.querySelector('output[data-out="' + key + '"]');
      if (out) out.textContent = val.toFixed(2);
      if (key === "overlay" || key === "grain") {
        surface[key] = val;
        setSurfaceVars();
      } else {
        const patch = {};
        patch[key] = val;
        fx.update(patch);
      }
      renderConfigOut();
    });
  });

  /* ---- 动画开关 / animate toggle ------------------------------------ */
  document.querySelectorAll("input[type=checkbox][data-param]").forEach(function (input) {
    input.addEventListener("change", function () {
      const patch = {};
      patch[input.getAttribute("data-param")] = input.checked;
      fx.update(patch);
      renderConfigOut();
    });
  });

  /* ---- 导出 / export ------------------------------------------------- */
  const status = document.getElementById("copyStatus");
  function flash(msg) {
    status.textContent = msg;
    clearTimeout(flash._t);
    flash._t = setTimeout(function () { status.textContent = ""; }, 1800);
  }
  document.getElementById("copyJson").addEventListener("click", function () {
    const text = document.getElementById("configOut").textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { flash("已复制到剪贴板 / Copied"); },
        function () { flash("复制失败，请手动选择 / Copy failed"); }
      );
    } else {
      flash("浏览器不支持自动复制 / Clipboard unavailable");
    }
  });
  document.getElementById("downloadJson").addEventListener("click", function () {
    const text = document.getElementById("configOut").textContent;
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fluid-noise-config.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flash("已下载 fluid-noise-config.json / Downloaded");
  });

  /* ---- 面板收起/展开 / collapse & expand ----------------------------- */
  const panel = document.getElementById("panel");
  const collapseBtn = document.getElementById("collapseBtn");
  const expandBtn = document.getElementById("expandBtn");
  function setCollapsed(collapsed) {
    panel.classList.toggle("collapsed", collapsed);
    panel.hidden = collapsed;
    expandBtn.hidden = !collapsed;
    collapseBtn.setAttribute("aria-expanded", String(!collapsed));
    expandBtn.setAttribute("aria-expanded", String(!collapsed));
  }
  collapseBtn.addEventListener("click", function () { setCollapsed(true); });
  expandBtn.addEventListener("click", function () { setCollapsed(false); });

  /* ---- 初始化 / init ------------------------------------------------- */
  setSurfaceVars();
  renderConfigOut();
})();
