// ===== BLACK HOLE BACKGROUND =====
// Real-time ray-marched black hole with a thin accretion disk, inspired by
// Shadertoy "Kerr Newman Black Hole" (shadertoy.com/view/7XtXz2).
// Plain WebGL1, no libraries. Light rays are bent with the Schwarzschild photon
// equation (units where the event horizon radius = 1).
//
// Scroll moves the camera and slides the black hole left/right between sections,
// the mouse gently orbits the camera, and resolution adapts to keep 60fps.
(function () {
  const canvas = document.getElementById('bg');
  const gl = canvas && canvas.getContext('webgl', {
    antialias: false, alpha: false, depth: false, powerPreference: 'high-performance'
  });
  if (!gl) {
    document.body.classList.add('no-webgl');
    return;
  }

  const vertSrc = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const fragSrc = `
    precision highp float;
    uniform vec2  uRes;
    uniform float uTime;
    uniform float uScroll;   // 0..1 page progress
    uniform vec2  uMouse;    // -1..1, damped
    uniform vec2  uOffset;   // screen-space shift of the black hole
    uniform float uDim;      // overall brightness for readability

    const float RIN  = 2.6;   // inner disk edge (near ISCO)
    const float ROUT = 15.0;  // outer disk edge
    const int   STEPS = 180;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float hash31(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x),
                 mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 1.7; a *= 0.5; }
      return v;
    }

    // Star field + faint nebula, looked up by (lensed) ray direction
    vec3 sky(vec3 d) {
      vec3 col = vec3(0.0);
      for (int i = 0; i < 3; i++) {
        float sc = 70.0 + float(i) * 85.0;
        vec3 g  = d * sc;
        vec3 id = floor(g);
        vec3 f  = fract(g) - 0.5;
        float h = hash31(id + float(i) * 31.0);
        if (h > 0.93) {
          vec3 o = vec3(hash31(id + 3.1), hash31(id + 7.7), hash31(id + 1.3)) - 0.5;
          float s = smoothstep(0.22, 0.0, length(f - o * 0.5)) * (h - 0.93) / 0.07;
          // mostly blue-white, a few warm orange "sparks"
          vec3 tint = hash31(id + 11.0) > 0.85 ? vec3(1.0, 0.55, 0.25) : vec3(0.7, 0.82, 1.0);
          float tw = 0.65 + 0.35 * sin(uTime * (1.0 + h * 3.0) + h * 60.0);
          col += tint * s * tw * 1.6;
        }
      }
      vec2 q = d.xy * 2.0 + d.z;
      col += vec3(0.020, 0.035, 0.090) * fbm(q * 1.5);
      col += vec3(0.040, 0.016, 0.004) * pow(fbm(q * 2.5 + 4.0), 3.0) * 2.0;
      return col;
    }

    // Accretion disk emission at a point on the y = 0 plane
    vec4 disk(vec3 p, vec3 rd) {
      float r = length(p.xz);
      if (r < RIN || r > ROUT) return vec4(0.0);
      float ang   = atan(p.z, p.x);
      float omega = 1.4 / pow(r, 1.5);               // Keplerian spin
      float a2    = ang + uTime * omega;
      vec2  q     = vec2(cos(a2), sin(a2)) * r;
      // turbulent gas + thin orbital streaks
      float n  = fbm(q * 0.9 + vec2(0.0, uTime * 0.02));
      float st = fbm(vec2(r * 3.5, n * 3.0 + a2 * 0.5));
      float dens = smoothstep(0.15, 0.8, n * 0.65 + st * 0.55);

      float t = pow(RIN / r, 1.4);                   // temperature falloff
      vec3 hot  = vec3(0.92, 0.96, 1.00);
      vec3 mid  = vec3(0.22, 0.52, 1.00);
      vec3 cool = vec3(0.06, 0.14, 0.60);
      vec3 col  = mix(cool, mid, smoothstep(0.0, 0.45, t));
      col = mix(col, hot, smoothstep(0.45, 1.0, t));
      col += vec3(1.0, 0.45, 0.15) * 0.25 * smoothstep(0.6, 0.0, t) * st; // warm outer wisps

      // relativistic beaming: the side moving toward us is brighter
      vec3 vel = normalize(vec3(-p.z, 0.0, p.x));
      float beam = pow(clamp(1.0 + 0.75 * dot(vel, -rd) * sqrt(RIN / r), 0.2, 2.0), 3.0);

      float edge = smoothstep(RIN, RIN + 0.35, r) * smoothstep(ROUT, ROUT * 0.55, r);
      float I = (0.4 + 2.8 * t) * beam * (0.35 + 0.9 * dens);
      float alpha = clamp(edge * (0.25 + 0.75 * dens) * (0.55 + t), 0.0, 1.0);
      return vec4(col * I, alpha);
    }

    mat3 lookAt(vec3 ro, vec3 ta, float roll) {
      vec3 w = normalize(ta - ro);
      vec3 up = vec3(sin(roll), cos(roll), 0.0);
      vec3 u = normalize(cross(w, up));
      vec3 v = cross(u, w);
      return mat3(u, v, w);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
      uv -= uOffset;

      // Camera: orbits slowly, mouse adds parallax, scroll changes height/distance
      float s    = uScroll;
      float az   = 0.6 + uTime * 0.015 + uMouse.x * 0.35 + s * 1.2;
      float elev = 0.16 + uMouse.y * 0.10 + 0.22 * sin(s * 3.14159);
      float dist = 30.0 - 6.0 * sin(s * 3.14159);
      vec3 ro = dist * vec3(cos(elev) * cos(az), sin(elev), cos(elev) * sin(az));
      mat3 cam = lookAt(ro, vec3(0.0), -0.38 + s * 0.25);
      vec3 rd = normalize(cam * vec3(uv, 1.6));

      vec3 p = ro, v = rd;
      vec3 hv = cross(p, v);
      float h2 = dot(hv, hv);
      vec3 col = vec3(0.0);
      float trans = 1.0;
      float glow = 0.0;

      for (int i = 0; i < STEPS; i++) {
        float r = length(p);
        float dt = clamp(0.09 * r, 0.04, 1.6);
        // photon geodesic: a = -1.5 h^2 r_vec / r^5
        v += -1.5 * h2 * p / pow(r, 5.0) * dt;
        vec3 np = p + v * dt;

        if (p.y * np.y < 0.0) {                        // crossed the disk plane
          vec3 hit = mix(p, np, p.y / (p.y - np.y));
          vec4 d = disk(hit, normalize(v));
          col += trans * d.rgb * d.a;
          trans *= 1.0 - d.a;
        }
        // soft halo hugging the disk and photon ring
        float rr = length(np.xz);
        glow += dt * exp(-abs(np.y) * 3.0) * smoothstep(ROUT, RIN, rr) * step(RIN * 0.8, rr) * 0.012;
        glow += min(dt, 0.15) * 0.05 * exp(-abs(length(np) - 1.6) * 2.5);

        p = np;
        if (r < 1.0) { trans = 0.0; break; }           // fell into the horizon
        if (r > 80.0 || trans < 0.01) break;
      }

      col += trans * sky(normalize(v));
      col += vec3(0.30, 0.50, 1.00) * glow * 0.6;

      // tone map + grade toward deep navy shadows
      col = 1.0 - exp(-col * 1.8);
      col = pow(col, vec3(0.95, 0.97, 0.92));
      col += vec3(0.004, 0.007, 0.018);

      vec2 sv = gl_FragCoord.xy / uRes - 0.5;
      col *= 1.0 - 0.55 * dot(sv, sv) * 2.0;           // vignette
      col *= uDim;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }
  const vs = compile(gl.VERTEX_SHADER, vertSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
  const prog = gl.createProgram();
  if (!vs || !fs) { document.body.classList.add('no-webgl'); return; }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    document.body.classList.add('no-webgl');
    return;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ['uRes', 'uTime', 'uScroll', 'uMouse', 'uOffset', 'uDim'].forEach(n => U[n] = gl.getUniformLocation(prog, n));

  // ---- Resolution ----
  // The look is soft, so render a fixed pixel budget (~0.5 MP) and let CSS upscale.
  // It only ever steps down if frames are being dropped; it never ramps up, so the
  // canvas is not reallocated over and over (that caused hitching on fast screens).
  const PIXEL_BUDGET = window.innerWidth < 700 ? 0.22e6 : 0.5e6;
  let quality = 1, Q_MIN = 0.3;
  function budgetQuality() {
    const css = window.innerWidth * window.innerHeight;
    return Math.min(1, Math.sqrt(PIXEL_BUDGET / css));
  }
  quality = budgetQuality();

  function resize() {
    quality = Math.min(quality, budgetQuality());
    const w = Math.max(1, Math.floor(window.innerWidth * quality));
    const h = Math.max(1, Math.floor(window.innerHeight * quality));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  window.addEventListener('resize', () => { quality = budgetQuality(); resize(); });
  resize();

  // ---- Inputs ----
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', e => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  let scrollT = 0, scrollC = 0;
  function readScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollT = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
  }
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  // ---- Render loop ----
  let time = 8.0, last = performance.now();
  let frames = 0, frameAcc = 0;
  let running = true;

  const FRAME_MS = 1000 / 60;   // cap at 60fps: 120/144Hz laptop screens would double the GPU work

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (now - last < FRAME_MS - 2) return;
    // Nothing to draw while a full-screen overlay (dashboard, modal, profile page) covers it
    if (document.body.classList.contains('bg-paused')) { last = now; return; }
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt * (reduceMotion ? 0.15 : 1.0);

    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    scrollC += (scrollT - scrollC) * 0.06;

    // Hero: centered. Then the hole drifts right → left → back to center for the CTA.
    const wide = window.innerWidth > 900;
    const swing = wide ? Math.sin(scrollC * Math.PI * 2) * 0.48 : 0;
    const dim = 1.0 - 0.38 * Math.sin(Math.min(scrollC * 1.15, 1) * Math.PI);

    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uScroll, scrollC);
    gl.uniform2f(U.uMouse, mouse.x, mouse.y);
    gl.uniform2f(U.uOffset, swing, 0.0);
    gl.uniform1f(U.uDim, dim);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Every 90 frames: if we're clearly dropping frames, step resolution down once
    frameAcc += dt; frames++;
    if (frames >= 90) {
      const avg = frameAcc / frames;
      if (avg > 0.022 && quality > Q_MIN) { quality = Math.max(Q_MIN, quality * 0.85); resize(); }
      frames = 0; frameAcc = 0;
    }
  }

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { last = performance.now(); requestAnimationFrame(frame); }
  });
  requestAnimationFrame(frame);
})();
