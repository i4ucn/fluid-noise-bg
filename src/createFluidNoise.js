/* =============================================================================
 * createFluidNoise — 可参数化的 WebGL 流体噪声背景引擎
 * A parameterized WebGL fluid-noise background engine.
 *
 * 受 federicopian.com 启发：3D Simplex 噪声 + 三点平均 + 缓慢域漂移，
 * 映射为「暖阴影 → 中间色 → 高光色」的不透明流体渐变。无第三方依赖。
 *
 * 用法 / Usage:
 *   const fx = createFluidNoise(canvasEl, { ...config });
 *   fx.update({ speed: 0.4, colorBright: "#ff9655" });
 *   fx.getConfig();   // 当前配置 / current config (JSON-friendly)
 *   fx.destroy();
 * ========================================================================== */

(function (global) {
  "use strict";

  /* ---- 默认配置 / Default config ------------------------------------- */
  const DEFAULTS = {
    colorBright: "#ff9655", // 高光色 / highlight (noise 峰)
    colorMid: "#b93c64", // 中间色 / midtone
    colorShadow: "#160a10", // 暖阴影 / warm shadow (noise 谷)
    speed: 0.2, // 流速 / animation speed
    scale: 1.9, // 尺度·频率 / spatial frequency
    flow: 0.5, // 漂移 / drift amount
    distort: 0.5, // 域扭曲·流体感 / domain-warp amount
    contrast: 0.52, // 对比·过渡范围 / smoothstep half-range
    animate: true, // 是否动画 / animate
  };

  function hexToRgb01(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return [0, 0, 0];
    const int = parseInt(m[1], 16);
    return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
  }

  const VERT = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  const FRAG = `
    precision highp float;
    varying vec2 vUv;
    uniform float u_time;
    uniform vec2  u_resolution;
    uniform vec3  u_color1;   // bright
    uniform vec3  u_color2;   // mid
    uniform vec3  u_shadow;   // shadow
    uniform float u_freq;
    uniform float u_flow;
    uniform float u_contrast;
    uniform float u_distort;

    /* Simplex 3D noise (Ashima Arts / Stefan Gustavson) */
    vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
    vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v){
      const vec2  C = vec2(1.0/6.0, 1.0/3.0);
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + 1.0 * C.xxx;
      vec3 x2 = x0 - i2 + 2.0 * C.xxx;
      vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
      i = mod(i, 289.0);
      vec4 p = permute(permute(permute(
                 i.z + vec4(0.0, i1.z, i2.z, 1.0))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0))
               + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 1.0/7.0;
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    // sRGB <-> 线性光：在线性空间插值，过渡更自然，
    // 避免 sRGB 直接混合在中间出现浑浊的暗色。
    vec3 toLinear(vec3 c){ return pow(c, vec3(2.2)); }
    vec3 toSrgb(vec3 c){ return pow(c, vec3(1.0 / 2.2)); }

    void main(){
      vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
      vec2 drift = vec2(u_time * u_flow, u_time * u_flow * 0.53);
      vec2 uv = vUv * aspect * u_freq + drift;

      // 域扭曲 / domain warp：用一层低频噪声去偏移采样坐标，
      // 让色块呈流动的丝缕/熔融状，而非规则圆斑 —— 流体感的关键。
      vec2 q = vec2(
        snoise(vec3(uv * 0.5 + 13.1, u_time * 1.3)),
        snoise(vec3(uv * 0.5 - 5.7,  u_time * 1.3))
      );
      vec2 wuv = uv + q * (0.35 + 0.45 * u_distort);

      // 多点采样取平均 → 更柔和、连续的噪声场
      float noise  = snoise(vec3(wuv,        u_time * 3.0));
      float noise1 = snoise(vec3(wuv + 0.12, u_time * 3.0));
      float noise2 = snoise(vec3(wuv - 0.12, u_time * 3.0));
      float n = (noise + noise1 + noise2) / 3.0;

      // 线性归一化到 [0,1]，避免在映射阶段就做 smoothstep（双重 smoothstep 会形成生硬的台阶/色带）
      float c = max(u_contrast, 0.02);
      float t = clamp(0.5 + 0.5 * n / c, 0.0, 1.0);

      // 阴影 → 中间 → 高光 的三段渐变。
      // 两段权重各自只在自己半区平滑过渡、在中点处导数为 0（C1 连续），
      // 因此中点不再出现"两段同时生效"的色带 —— 这正是之前过渡不自然的根源。
      float w1 = smoothstep(0.0, 1.0, clamp(t / 0.5, 0.0, 1.0));
      float w2 = smoothstep(0.0, 1.0, clamp((t - 0.5) / 0.5, 0.0, 1.0));

      vec3 lin = mix(toLinear(u_shadow), toLinear(u_color2), w1);
      lin = mix(lin, toLinear(u_color1), w2);

      gl_FragColor = vec4(toSrgb(lin), 1.0);
    }
  `;

  function createFluidNoise(canvas, options) {
    const config = Object.assign({}, DEFAULTS, options || {});

    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) {
      canvas.style.background =
        "radial-gradient(120% 120% at 30% 20%, " +
        config.colorBright +
        ", " +
        config.colorShadow +
        " 70%)";
      return {
        update: function () {},
        getConfig: function () {
          return Object.assign({}, config);
        },
        destroy: function () {},
        unsupported: true,
      };
    }

    function compile(type, src) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(prog));
      return { update: function () {}, getConfig: function () { return config; }, destroy: function () {} };
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const U = {
      time: gl.getUniformLocation(prog, "u_time"),
      resolution: gl.getUniformLocation(prog, "u_resolution"),
      color1: gl.getUniformLocation(prog, "u_color1"),
      color2: gl.getUniformLocation(prog, "u_color2"),
      shadow: gl.getUniformLocation(prog, "u_shadow"),
      freq: gl.getUniformLocation(prog, "u_freq"),
      flow: gl.getUniformLocation(prog, "u_flow"),
      contrast: gl.getUniformLocation(prog, "u_contrast"),
      distort: gl.getUniformLocation(prog, "u_distort"),
    };

    function applyUniforms() {
      const c1 = hexToRgb01(config.colorBright);
      const c2 = hexToRgb01(config.colorMid);
      const cs = hexToRgb01(config.colorShadow);
      gl.uniform3f(U.color1, c1[0], c1[1], c1[2]);
      gl.uniform3f(U.color2, c2[0], c2[1], c2[2]);
      gl.uniform3f(U.shadow, cs[0], cs[1], cs[2]);
      gl.uniform1f(U.freq, config.scale);
      gl.uniform1f(U.flow, config.flow);
      gl.uniform1f(U.contrast, config.contrast);
      gl.uniform1f(U.distort, config.distort);
    }

    function resize() {
      // 适度降采样：兼顾性能（域扭曲后每像素 5 次噪声）与原站柔焦质感
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(U.resolution, w, h);
    }
    window.addEventListener("resize", resize);

    applyUniforms();
    resize();

    /* 用时间累加器：仅在 animate 开启时推进，便于平滑变速与冻结 */
    let clockT = 0;
    let last = performance.now();
    let raf = 0;

    function frame(now) {
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      if (config.animate) clockT += dt * config.speed;
      gl.uniform1f(U.time, clockT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return {
      update: function (partial) {
        Object.assign(config, partial || {});
        applyUniforms();
      },
      resize: resize,
      getConfig: function () {
        return Object.assign({}, config);
      },
      destroy: function () {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
      },
    };
  }

  createFluidNoise.DEFAULTS = DEFAULTS;
  global.createFluidNoise = createFluidNoise;
})(typeof window !== "undefined" ? window : this);
