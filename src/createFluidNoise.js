/* =============================================================================
 * createFluidNoise — 可参数化的 WebGL 流体噪声背景引擎
 * A parameterized WebGL fluid-noise background engine.
 *
 * 受 federicopian.com 启发：3D Simplex 噪声 + 三点平均 + 缓慢域漂移，
 * 渲染为「浅色底 + 柔和饱和色块 + 轻微高光」的流体渐变（非黑底）。无第三方依赖。
 *
 * 用法 / Usage:
 *   const fx = createFluidNoise(canvasEl, { ...config });
 *   fx.update({ speed: 0.4, colorBright: "#ff9655" });
 *   fx.getConfig();   // 当前配置 / current config (JSON-friendly)
 *   fx.destroy();
 * ========================================================================== */

(function (global) {
  "use strict";

  /* ---- 默认配置 / Default config -------------------------------------
   * 配色模型（受 federicopian.com 启发）：
   *   底色 base  —— 占据画面绝大部分的浅色基底（不是黑！）
   *   流色 mid   —— 比底色更饱和的同系色，柔和地晕染成大色块（blob）
   *   高光 bright—— 略亮于底色的近白点缀，微弱地浮在表面
   * 即「浅底 + 柔和饱和色块 + 轻微高光」，而非「黑底→中间→高光」的火焰渐变。 */
  const DEFAULTS = {
    colorBright: "#f9f2ec", // 高光 / soft light accents
    colorMid: "#d9b6a0", // 流色 / saturated soft blobs
    colorBase: "#f5ece7", // 底色 / dominant light background
    speed: 0.16, // 流速 / animation speed
    scale: 1.4, // 尺度·频率 / spatial frequency（越小色块越大）
    flow: 0.4, // 漂移 / drift amount
    distort: 0.35, // 域扭曲·边缘起伏 / domain-warp amount（过大会拉成条形）
    density: 0.25, // 色块密度·覆盖率 / blob coverage（小=孤立圆斑）
    breath: 0.7, // 呼吸·淡入淡出 / breathing fade in-out
    contrast: 0.6, // 对比·色块饱满度 / blob fullness
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
    uniform vec3  u_color1;   // bright — soft highlight
    uniform vec3  u_color2;   // mid    — saturated blob
    uniform vec3  u_base;     // base   — light dominant background
    uniform float u_freq;
    uniform float u_flow;
    uniform float u_contrast;
    uniform float u_distort;
    uniform float u_density;  // 色块覆盖率 / blob coverage（小=孤立圆斑，大=连成片）
    uniform float u_breath;   // 呼吸·淡入淡出强度 / breathing fade in-out amount

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

      // 域扭曲 / domain warp：只施加「轻微、各向同性」的位移，
      // 让色块边缘有机起伏即可。旧版位移过大、且把采样点沿同一对角线
      // 偏移取平均，会把圆润色块拉成杂乱条形 —— 这正是"条形"的根源。
      // 这里位移幅度大幅缩小，x/y 用互相独立的噪声，保持各向同性。
      vec2 q = vec2(
        snoise(vec3(uv * 0.55 + 11.0, u_time * 0.6)),
        snoise(vec3(uv * 0.55 + 47.0, u_time * 0.6))
      );
      vec2 wuv = uv + q * (0.08 + 0.22 * u_distort);

      // 色块场 A：单层低频噪声 → 大而圆润的色块。
      // snoise 本身 C2 连续、足够平滑，无需再做方向性的多点平均。
      float nA = snoise(vec3(wuv, u_time * 2.0));

      // 高光场 B：与 A 解耦（不同频率与偏移），让高光浮在别处，
      // 而不是恰好长在色块中心 —— 更接近原站那种"另一处微亮"的呼吸感。
      float nB = snoise(vec3(wuv * 0.82 + 41.7, u_time * 2.1));

      float c = max(u_contrast, 0.04);
      float tMid = clamp(0.5 + 0.5 * nA / c, 0.0, 1.0);
      float tBri = clamp(0.5 + 0.5 * nB / c, 0.0, 1.0);

      // 关键①：底色占主导，流色只在「峰值」处晕开，覆盖率低 → 色块彼此
      //         分离、呈孤立的圆斑；若阈值降到中位（~50% 覆盖）色块会连成
      //         迷宫状的条带（这正是"不圆、相互挤压"的成因）。
      // 关键②：smoothstep 取较宽区间 = 较大羽化，让圆斑边缘柔和融入底色。
      // u_density 控制阈值高低：越大覆盖越多（越易连片），越小越孤立、越圆。
      float midLo = mix(0.66, 0.28, clamp(u_density, 0.0, 1.0));
      float midHi = min(midLo + 0.40, 1.0);
      float midMask = smoothstep(midLo, midHi, tMid);

      // 高光更克制：只在更高处出现、上限封顶，避免烧白；
      // 与流色之间因此是「底色 ↔ 流色」「底色 ↔ 高光」两段独立的柔和过渡，
      // 不再有旧版 mid→bright 直接相接的生硬色带。
      float briMask = smoothstep(0.58, 1.0, tBri) * 0.6;

      // 呼吸 / breathing：用一组「很慢、很大尺度」的独立噪声做不透明度包络，
      // 让每个色块按各自的节奏淡入淡出（fade in/out）。因为包络在空间上变化，
      // 不同位置的色块不会同步呼吸 —— 这正是原站气泡的呼吸感来源。
      float envA = snoise(vec3(wuv * 0.42 + 60.0, u_time * 0.45));
      float envB = snoise(vec3(wuv * 0.42 + 90.0, u_time * 0.55));
      float breathA = smoothstep(-0.25, 0.55, envA);
      float breathB = smoothstep(-0.25, 0.55, envB);
      midMask *= mix(1.0, breathA, u_breath);
      briMask *= mix(1.0, breathB, u_breath);

      // 在线性光空间分层叠色，过渡更干净（避免 sRGB 直混出现浑浊）。
      vec3 lin = toLinear(u_base);
      lin = mix(lin, toLinear(u_color2), midMask);
      lin = mix(lin, toLinear(u_color1), briMask);

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
        config.colorMid +
        ", " +
        config.colorBase +
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
      base: gl.getUniformLocation(prog, "u_base"),
      freq: gl.getUniformLocation(prog, "u_freq"),
      flow: gl.getUniformLocation(prog, "u_flow"),
      contrast: gl.getUniformLocation(prog, "u_contrast"),
      distort: gl.getUniformLocation(prog, "u_distort"),
      density: gl.getUniformLocation(prog, "u_density"),
      breath: gl.getUniformLocation(prog, "u_breath"),
    };

    function applyUniforms() {
      const c1 = hexToRgb01(config.colorBright);
      const c2 = hexToRgb01(config.colorMid);
      const cb = hexToRgb01(config.colorBase);
      gl.uniform3f(U.color1, c1[0], c1[1], c1[2]);
      gl.uniform3f(U.color2, c2[0], c2[1], c2[2]);
      gl.uniform3f(U.base, cb[0], cb[1], cb[2]);
      gl.uniform1f(U.freq, config.scale);
      gl.uniform1f(U.flow, config.flow);
      gl.uniform1f(U.contrast, config.contrast);
      gl.uniform1f(U.distort, config.distort);
      gl.uniform1f(U.density, config.density);
      gl.uniform1f(U.breath, config.breath);
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
